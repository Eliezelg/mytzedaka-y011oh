package com.ijap.app.data.db.entities

import androidx.room.Entity // v2.6.0
import androidx.room.PrimaryKey // v2.6.0
import androidx.room.ColumnInfo // v2.6.0
import androidx.room.ForeignKey // v2.6.0
import androidx.room.TypeConverters // v2.6.0
import androidx.security.crypto.EncryptedSharedPreferences // v1.1.0
import com.ijap.app.data.models.Donation
import com.ijap.app.data.models.DonationDedication
import com.ijap.app.utils.SecurityUtils
import java.util.UUID

/**
 * Room database entity representing a secure donation transaction with comprehensive
 * cultural and religious considerations for Jewish charitable giving.
 *
 * Features:
 * - Field-level encryption for sensitive data
 * - Shabbat-compliant processing support
 * - Chai (חי) amount validation
 * - Multi-currency support
 * - Comprehensive audit trail
 */
@Entity(
    tableName = "donations",
    foreignKeys = [
        ForeignKey(
            entity = AssociationEntity::class,
            parentColumns = ["id"],
            childColumns = ["association_id"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [
        Index(value = ["user_id"]),
        Index(value = ["association_id"]),
        Index(value = ["campaign_id"]),
        Index(value = ["created_at"])
    ]
)
@TypeConverters(DonationConverters::class)
data class DonationEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String = UUID.randomUUID().toString(),

    @ColumnInfo(name = "user_id")
    val userId: String,

    @ColumnInfo(name = "association_id")
    val associationId: String,

    @ColumnInfo(name = "campaign_id")
    val campaignId: String?,

    @ColumnInfo(name = "amount")
    val amount: Double,

    @ColumnInfo(name = "currency")
    val currency: String,

    @ColumnInfo(name = "payment_method_id")
    val paymentMethodId: String,

    @ColumnInfo(name = "payment_type")
    val paymentType: String,

    @ColumnInfo(name = "payment_gateway")
    val paymentGateway: String,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "transaction_id")
    val transactionId: String?,

    @ColumnInfo(name = "receipt_number")
    val receiptNumber: String?,

    @ColumnInfo(name = "is_anonymous")
    val isAnonymous: Boolean = false,

    @ColumnInfo(name = "is_recurring")
    val isRecurring: Boolean = false,

    @ColumnInfo(name = "recurring_frequency")
    val recurringFrequency: String?,

    @ColumnInfo(name = "dedication")
    val dedication: DonationDedication?,

    @ColumnInfo(name = "is_chai_amount")
    val isChaiAmount: Boolean = false,

    @ColumnInfo(name = "is_shabbat_compliant")
    val isShabbatCompliant: Boolean = false,

    @ColumnInfo(name = "hebrew_date")
    val hebrewDate: String?,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "security_metadata")
    val securityMetadata: Map<String, String>,

    @ColumnInfo(name = "sync_status")
    val syncStatus: String = "PENDING"
) {

    /**
     * Converts the entity to a domain model with proper decryption
     * and cultural considerations.
     *
     * @return Decrypted Donation domain model instance
     */
    fun toDonation(): Donation {
        val decryptedAmount = SecurityUtils.decryptData(
            amount.toString(),
            "donation_amount_${id}"
        ).toDouble()

        val decryptedTransactionId = transactionId?.let {
            SecurityUtils.decryptData(it, "transaction_${id}")
        }

        return Donation(
            id = id,
            userId = userId,
            associationId = associationId,
            campaignId = campaignId,
            amount = decryptedAmount,
            currency = currency,
            paymentMethodId = paymentMethodId,
            paymentType = Donation.PaymentMethodType.valueOf(paymentType),
            status = Donation.DonationStatus.valueOf(status),
            transactionId = decryptedTransactionId,
            receiptNumber = receiptNumber,
            isAnonymous = isAnonymous,
            isRecurring = isRecurring,
            recurringFrequency = recurringFrequency?.let {
                Donation.RecurringFrequency.valueOf(it)
            },
            isShabbatCompliant = isShabbatCompliant,
            isChaiAmount = isChaiAmount,
            dedication = dedication,
            auditTrail = AuditMetadata(
                ipAddress = securityMetadata["ip_address"] ?: "",
                deviceId = securityMetadata["device_id"] ?: "",
                userAgent = securityMetadata["user_agent"] ?: "",
                securityMetadata = securityMetadata,
                events = listOf()
            ),
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }

    /**
     * Validates the entity data against business rules including:
     * - Amount validation
     * - Currency support
     * - Shabbat compliance
     * - Cultural considerations
     *
     * @return ValidationResult containing any validation errors
     */
    fun validate(): ValidationResult {
        val errors = mutableListOf<String>()

        // Validate amount
        if (!CurrencyUtils.validateAmount(amount, currency)) {
            errors.add("Invalid amount for currency $currency")
        }

        // Validate chai amount if specified
        if (isChaiAmount && amount % 18.0 != 0.0) {
            errors.add("Amount must be a multiple of 18 for chai donation")
        }

        // Validate Shabbat compliance
        if (isShabbatCompliant && status != "SCHEDULED") {
            errors.add("Shabbat-compliant donations must be scheduled")
        }

        // Validate payment gateway based on currency
        val validGateway = when (currency) {
            "ILS" -> paymentGateway == "tranzilla"
            else -> paymentGateway == "stripe"
        }
        if (!validGateway) {
            errors.add("Invalid payment gateway for currency $currency")
        }

        return ValidationResult(errors.isEmpty(), errors)
    }

    companion object {
        /**
         * Creates a secure entity instance from a domain model with proper
         * encryption and security metadata.
         *
         * @param donation Domain model instance
         * @return Encrypted entity instance
         */
        fun fromDonation(donation: Donation): DonationEntity {
            val encryptedAmount = SecurityUtils.encryptData(
                donation.amount.toString(),
                "donation_amount_${donation.id}"
            )

            val encryptedTransactionId = donation.transactionId?.let {
                SecurityUtils.encryptData(it, "transaction_${donation.id}")
            }

            val securityMetadata = mutableMapOf<String, String>()
            securityMetadata.putAll(donation.auditTrail.securityMetadata)
            securityMetadata["encryption_version"] = "1.0"
            securityMetadata["key_rotation_date"] = System.currentTimeMillis().toString()

            return DonationEntity(
                id = donation.id,
                userId = donation.userId,
                associationId = donation.associationId,
                campaignId = donation.campaignId,
                amount = encryptedAmount.toDouble(),
                currency = donation.currency,
                paymentMethodId = donation.paymentMethodId,
                paymentType = donation.paymentType.name,
                paymentGateway = if (donation.currency == "ILS") "tranzilla" else "stripe",
                status = donation.status.name,
                transactionId = encryptedTransactionId,
                receiptNumber = donation.receiptNumber,
                isAnonymous = donation.isAnonymous,
                isRecurring = donation.isRecurring,
                recurringFrequency = donation.recurringFrequency?.name,
                dedication = donation.dedication,
                isChaiAmount = donation.isChaiAmount,
                isShabbatCompliant = donation.isShabbatCompliant,
                hebrewDate = donation.auditTrail.securityMetadata["hebrew_date"],
                createdAt = donation.createdAt,
                updatedAt = donation.updatedAt,
                securityMetadata = securityMetadata,
                syncStatus = "PENDING"
            )
        }
    }
}

/**
 * Data class representing validation results for donation entities
 */
data class ValidationResult(
    val isValid: Boolean,
    val errors: List<String>
)