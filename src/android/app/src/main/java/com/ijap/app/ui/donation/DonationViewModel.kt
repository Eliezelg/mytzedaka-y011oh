package com.ijap.app.ui.donation

import androidx.lifecycle.ViewModel // v2.6.1
import androidx.lifecycle.viewModelScope // v2.6.1
import androidx.work.WorkManager // v2.8.1
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.workDataOf
import com.ijap.app.data.repository.DonationRepository
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.CurrencyUtils
import com.ijap.app.data.models.Donation
import com.ijap.app.data.models.PaymentMethod
import javax.inject.Inject // v1.0
import kotlinx.coroutines.flow.MutableStateFlow // v1.7.0
import kotlinx.coroutines.flow.StateFlow // v1.7.0
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collect
import java.math.BigDecimal
import java.util.TimeZone
import java.util.UUID

/**
 * ViewModel managing donation form state, business logic, and secure payment processing
 * with comprehensive cultural considerations for Jewish charitable giving.
 *
 * Features:
 * - Secure payment processing with field-level encryption
 * - Offline support with background synchronization
 * - Shabbat-compliant donation scheduling
 * - Chai (חי) amount validation and formatting
 * - Multi-currency support with proper conversion
 */
class DonationViewModel @Inject constructor(
    private val donationRepository: DonationRepository,
    private val securityUtils: SecurityUtils,
    private val workManager: WorkManager
) : ViewModel() {

    private val _uiState = MutableStateFlow<DonationUiState>(DonationUiState.Loading)
    val uiState: StateFlow<DonationUiState> = _uiState.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    private val _supportedCurrencies = MutableStateFlow<List<String>>(listOf())
    private val _processingDonation = MutableStateFlow(false)

    init {
        setupOfflineSupport()
        loadSupportedCurrencies()
    }

    /**
     * Creates a new donation with comprehensive validation and security measures
     */
    fun createDonation(
        amount: BigDecimal,
        currency: String,
        associationId: String,
        paymentMethod: PaymentMethod,
        isAnonymous: Boolean = false,
        isRecurring: Boolean = false,
        isChaiAmount: Boolean = false,
        isShabbatCompliant: Boolean = false,
        dedication: Donation.DonationDedication? = null
    ) {
        if (_processingDonation.value) return

        viewModelScope.launch {
            try {
                _processingDonation.value = true
                _uiState.value = DonationUiState.Processing

                // Validate amount and cultural requirements
                if (!validateDonationAmount(amount, currency)) {
                    _uiState.value = DonationUiState.Error("Invalid donation amount")
                    return@launch
                }

                // Create donation object with security metadata
                val donation = Donation(
                    id = UUID.randomUUID().toString(),
                    userId = securityUtils.secureTokenStorage.getUserId(),
                    associationId = associationId,
                    amount = amount.toDouble(),
                    currency = currency,
                    paymentMethodId = paymentMethod.id,
                    paymentType = paymentMethod.type,
                    status = Donation.DonationStatus.PENDING,
                    isAnonymous = isAnonymous,
                    isRecurring = isRecurring,
                    isChaiAmount = isChaiAmount,
                    isShabbatCompliant = isShabbatCompliant,
                    dedication = dedication,
                    auditTrail = createAuditMetadata()
                )

                // Process donation through repository
                donationRepository.createDonation(donation)
                    .catch { error ->
                        handleDonationError(error)
                    }
                    .collect { result ->
                        handleDonationSuccess(result)
                        scheduleBackgroundSync()
                    }

            } catch (e: Exception) {
                handleDonationError(e)
            } finally {
                _processingDonation.value = false
            }
        }
    }

    /**
     * Validates donation amount with cultural and security considerations
     */
    private fun validateDonationAmount(amount: BigDecimal, currency: String): Boolean {
        // Basic amount validation
        if (amount <= BigDecimal.ZERO) return false

        // Validate against currency-specific rules
        if (!CurrencyUtils.validateAmount(amount.toDouble(), currency)) return false

        // Validate chai amount if specified
        if (_uiState.value.isChaiAmount && amount.remainder(BigDecimal("18")) != BigDecimal.ZERO) {
            return false
        }

        return true
    }

    /**
     * Creates secure audit metadata for donation tracking
     */
    private fun createAuditMetadata(): Donation.AuditMetadata {
        return Donation.AuditMetadata(
            ipAddress = securityUtils.secureTokenStorage.getLastKnownIp(),
            deviceId = securityUtils.secureTokenStorage.getDeviceId(),
            userAgent = "IJAP-Android",
            securityMetadata = mapOf(
                "encryption_version" to "1.0",
                "timezone" to TimeZone.getDefault().id,
                "hebrew_date" to getHebrewDate()
            ),
            events = listOf()
        )
    }

    /**
     * Handles successful donation processing
     */
    private fun handleDonationSuccess(donation: Donation) {
        viewModelScope.launch {
            _uiState.value = DonationUiState.Success(
                donationId = donation.id,
                amount = CurrencyUtils.formatCurrency(
                    amount = donation.amount,
                    currencyCode = donation.currency,
                    useChaiNotation = donation.isChaiAmount
                ),
                receiptNumber = donation.receiptNumber
            )
        }
    }

    /**
     * Handles donation processing errors with proper user feedback
     */
    private fun handleDonationError(error: Throwable) {
        val errorMessage = when (error) {
            is SecurityException -> "Security validation failed"
            is IllegalArgumentException -> error.message ?: "Invalid donation parameters"
            else -> "Failed to process donation"
        }
        _uiState.value = DonationUiState.Error(errorMessage)
    }

    /**
     * Sets up offline support with WorkManager
     */
    private fun setupOfflineSupport() {
        viewModelScope.launch {
            val syncWorkRequest = OneTimeWorkRequestBuilder<DonationSyncWorker>()
                .setInputData(workDataOf(
                    "last_sync" to System.currentTimeMillis()
                ))
                .build()
            workManager.enqueue(syncWorkRequest)
        }
    }

    /**
     * Schedules background synchronization for offline donations
     */
    private fun scheduleBackgroundSync() {
        if (_isOffline.value) {
            val syncWorkRequest = OneTimeWorkRequestBuilder<DonationSyncWorker>()
                .build()
            workManager.enqueue(syncWorkRequest)
        }
    }

    /**
     * Gets current Hebrew date for donation metadata
     */
    private fun getHebrewDate(): String {
        // Implementation would use Hebrew calendar conversion
        return ""
    }
}

/**
 * Sealed class representing donation UI states
 */
sealed class DonationUiState {
    object Loading : DonationUiState()
    object Processing : DonationUiState()
    
    data class Success(
        val donationId: String,
        val amount: String,
        val receiptNumber: String?
    ) : DonationUiState()
    
    data class Error(val message: String) : DonationUiState()
}