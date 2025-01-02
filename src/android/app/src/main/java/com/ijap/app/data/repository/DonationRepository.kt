package com.ijap.app.data.repository

import javax.inject.Inject // v1.0
import javax.inject.Singleton // v1.0
import kotlinx.coroutines.CoroutineScope // v1.7.0
import kotlinx.coroutines.Dispatchers // v1.7.0
import kotlinx.coroutines.flow.Flow // v1.7.0
import kotlinx.coroutines.flow.flow // v1.7.0
import kotlinx.coroutines.flow.flowOn // v1.7.0
import kotlinx.coroutines.flow.map // v1.7.0
import kotlinx.coroutines.launch // v1.7.0
import com.ijap.app.data.db.dao.DonationDao
import com.ijap.app.data.api.ApiService
import com.ijap.app.data.models.Donation
import com.ijap.app.data.db.entities.DonationEntity
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.CurrencyUtils
import java.util.Calendar
import java.util.TimeZone
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Repository class implementing secure donation data management with comprehensive
 * cultural considerations for Jewish charitable giving.
 *
 * Features:
 * - Field-level encryption for sensitive data
 * - Offline-first architecture with sync
 * - Shabbat-compliant processing
 * - Chai amount validation
 * - Multi-currency support
 * - Comprehensive audit logging
 */
@Singleton
class DonationRepository @Inject constructor(
    private val donationDao: DonationDao,
    private val apiService: ApiService
) {
    private val coroutineScope = CoroutineScope(Dispatchers.IO)
    private val isSyncing = AtomicBoolean(false)
    private val hebrewCalendar = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem"))

    /**
     * Creates a new donation with comprehensive validation and security measures
     */
    suspend fun createDonation(donation: Donation): Flow<Donation> = flow {
        // Validate donation amount and cultural requirements
        validateDonationRequirements(donation)

        // Check Shabbat compliance if enabled
        if (donation.isShabbatCompliant) {
            val shabbatValidation = apiService.validateShabbatCompliance(
                System.currentTimeMillis(),
                TimeZone.getDefault().id
            ).blockingGet()

            if (!shabbatValidation.isCompliant) {
                throw IllegalStateException("Transaction not allowed during Shabbat")
            }
        }

        try {
            // Create donation through API
            val createdDonation = apiService.createDonation(donation).blockingGet()

            // Cache in local database
            val donationEntity = DonationEntity.fromDonation(createdDonation)
            donationDao.insertDonation(donationEntity)

            // Log audit trail
            logDonationAudit(createdDonation, "CREATED")

            emit(createdDonation)
        } catch (e: Exception) {
            // Cache failed donation for retry
            val pendingEntity = DonationEntity.fromDonation(donation.copy(
                status = Donation.DonationStatus.PENDING
            ))
            donationDao.insertDonation(pendingEntity)
            throw e
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Retrieves donation by ID with offline support
     */
    fun getDonationById(donationId: String): Flow<Donation?> {
        return donationDao.getDonationById(donationId)
            .map { entity -> 
                entity?.let {
                    // Decrypt sensitive data
                    it.toDonation()
                }
            }
            .flowOn(Dispatchers.IO)
    }

    /**
     * Retrieves donations for a user with security and cultural considerations
     */
    fun getUserDonations(
        userId: String,
        includeShabbat: Boolean = false
    ): Flow<List<Donation>> {
        return if (includeShabbat) {
            donationDao.getDonationsForUser(userId)
        } else {
            donationDao.getDonationsExcludingShabbat(userId)
        }.map { entities ->
            entities.map { it.toDonation() }
        }.flowOn(Dispatchers.IO)
    }

    /**
     * Retrieves chai amount donations (multiples of 18)
     */
    fun getChaiDonations(userId: String): Flow<List<Donation>> {
        return donationDao.getChaiDonations(userId)
            .map { entities ->
                entities.map { it.toDonation() }
            }
            .flowOn(Dispatchers.IO)
    }

    /**
     * Synchronizes local donations with server
     */
    suspend fun syncDonations() {
        if (isSyncing.getAndSet(true)) return

        try {
            // Get pending sync donations
            val pendingDonations = donationDao.getPendingSyncDonations()
                .map { entities -> entities.map { it.toDonation() } }
                .flowOn(Dispatchers.IO)
                .blockingFirst()

            // Sync each pending donation
            pendingDonations.forEach { donation ->
                try {
                    val syncedDonation = apiService.createDonation(donation).blockingGet()
                    val syncedEntity = DonationEntity.fromDonation(syncedDonation)
                    donationDao.updateDonationSync(syncedEntity)
                    logDonationAudit(syncedDonation, "SYNCED")
                } catch (e: Exception) {
                    // Log sync failure but keep donation in pending state
                    logDonationAudit(donation, "SYNC_FAILED", e.message)
                }
            }
        } finally {
            isSyncing.set(false)
        }
    }

    /**
     * Validates donation requirements including:
     * - Amount validation
     * - Currency support
     * - Chai amount rules
     * - Cultural considerations
     */
    private fun validateDonationRequirements(donation: Donation) {
        // Validate amount
        if (!CurrencyUtils.validateAmount(donation.amount, donation.currency)) {
            throw IllegalArgumentException("Invalid donation amount for currency ${donation.currency}")
        }

        // Validate chai amount if specified
        if (donation.isChaiAmount && donation.amount % 18.0 != 0.0) {
            throw IllegalArgumentException("Chai donations must be multiples of 18")
        }

        // Validate payment method
        if (!donation.isValidForProcessing()) {
            throw IllegalArgumentException("Invalid payment method configuration")
        }
    }

    /**
     * Logs donation audit trail with security metadata
     */
    private fun logDonationAudit(
        donation: Donation,
        action: String,
        details: String? = null
    ) {
        val auditEvent = Donation.AuditMetadata.AuditEvent(
            timestamp = System.currentTimeMillis(),
            eventType = action,
            details = details ?: ""
        )

        coroutineScope.launch(Dispatchers.IO) {
            // Update audit trail in local database
            val updatedDonation = donation.copy(
                auditTrail = donation.auditTrail.copy(
                    events = donation.auditTrail.events + auditEvent
                )
            )
            donationDao.updateDonation(DonationEntity.fromDonation(updatedDonation))
        }
    }
}