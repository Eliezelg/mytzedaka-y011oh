package com.ijap.app.data.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize // v1.9.0
import com.google.gson.annotations.SerializedName // v2.10.1
import com.ijap.security.annotations.Encrypted // v1.0.0
import java.util.UUID

/**
 * Data class representing a secure donation transaction with comprehensive cultural
 * and religious considerations for Jewish charitable giving.
 *
 * Features:
 * - Field-level encryption for sensitive data
 * - Shabbat-compliant processing support
 * - Chai (חי) amount validation
 * - Multi-currency support with proper formatting
 * - Comprehensive audit trail
 */
@Parcelize
data class Donation(
    @SerializedName("id")
    val id: String = UUID.randomUUID().toString(),

    @Encrypted
    @SerializedName("user_id")
    val userId: String,

    @SerializedName("association_id")
    val associationId: String,

    @SerializedName("campaign_id")
    val campaignId: String?,

    @Encrypted
    @SerializedName("amount")
    val amount: Double,

    @SerializedName("currency")
    val currency: String,

    @Encrypted
    @SerializedName("payment_method_id")
    val paymentMethodId: String,

    @SerializedName("payment_type")
    val paymentType: PaymentMethodType,

    @SerializedName("status")
    val status: DonationStatus,

    @Encrypted
    @SerializedName("transaction_id")
    val transactionId: String?,

    @SerializedName("receipt_number")
    val receiptNumber: String?,

    @SerializedName("is_anonymous")
    val isAnonymous: Boolean = false,

    @SerializedName("is_recurring")
    val isRecurring: Boolean = false,

    @SerializedName("recurring_frequency")
    val recurringFrequency: RecurringFrequency? = null,

    @SerializedName("is_shabbat_compliant")
    val isShabbatCompliant: Boolean = false,

    @SerializedName("is_chai_amount")
    val isChaiAmount: Boolean = false,

    @SerializedName("dedication")
    val dedication: DonationDedication? = null,

    @SerializedName("audit_trail")
    val auditTrail: AuditMetadata,

    @SerializedName("created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @SerializedName("updated_at")
    val updatedAt: Long = System.currentTimeMillis()
) : Parcelable {

    /**
     * Enum class defining possible donation statuses with proper handling
     * of processing states and Shabbat considerations
     */
    enum class DonationStatus {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        REFUNDED,
        SCHEDULED, // For Shabbat-compliant delayed processing
        CANCELLED
    }

    /**
     * Enum class defining recurring donation frequencies with
     * cultural considerations
     */
    enum class RecurringFrequency {
        WEEKLY,
        MONTHLY,
        QUARTERLY,
        ANNUALLY,
        CUSTOM
    }

    /**
     * Formats the donation amount with proper currency symbol and optional
     * chai notation based on cultural preferences
     *
     * @return Formatted amount string with currency and optional chai notation
     */
    fun getFormattedAmount(): String {
        return CurrencyUtils.formatCurrency(
            amount = amount,
            currencyCode = currency,
            useChaiNotation = isChaiAmount
        )
    }

    /**
     * Validates if the donation is ready for processing considering:
     * - Payment method validity
     * - Amount validation
     * - Shabbat compliance
     * - Association status
     *
     * @return Boolean indicating if donation can be processed
     */
    fun isValidForProcessing(): Boolean {
        // Validate payment method
        val paymentMethod = PaymentMethod(
            id = paymentMethodId,
            type = paymentType,
            gatewayProvider = if (currency == "ILS") "tranzilla" else "stripe",
            currencyCode = currency,
            countryCode = if (currency == "ILS") "IL" else "US",
            isShabbatCompliant = isShabbatCompliant
        )

        if (!paymentMethod.isValid()) {
            return false
        }

        // Validate amount
        if (!CurrencyUtils.validateAmount(amount, currency)) {
            return false
        }

        // Check Shabbat compliance if enabled
        if (isShabbatCompliant && status != DonationStatus.SCHEDULED) {
            return false
        }

        return true
    }

    companion object {
        const val MIN_AMOUNT = 1.0
        const val CHAI_VALUE = 18.0
    }
}

/**
 * Data class representing donation dedication information with
 * support for Hebrew names and memorial tributes
 */
@Parcelize
data class DonationDedication(
    @SerializedName("type")
    val type: String, // "HONOR" or "MEMORY"

    @SerializedName("name")
    val name: String,

    @SerializedName("hebrew_name")
    val hebrewName: String?,

    @SerializedName("message")
    val message: String?,

    @SerializedName("notify_recipient")
    val notifyRecipient: Boolean = false,

    @Encrypted
    @SerializedName("recipient_email")
    val recipientEmail: String?
) : Parcelable

/**
 * Data class for comprehensive audit trail information with
 * enhanced security tracking
 */
@Parcelize
data class AuditMetadata(
    @SerializedName("ip_address")
    val ipAddress: String,

    @SerializedName("device_id")
    val deviceId: String,

    @SerializedName("user_agent")
    val userAgent: String,

    @SerializedName("security_metadata")
    val securityMetadata: Map<String, String>,

    @SerializedName("events")
    val events: List<AuditEvent>
) : Parcelable {

    @Parcelize
    data class AuditEvent(
        @SerializedName("timestamp")
        val timestamp: Long,

        @SerializedName("event_type")
        val eventType: String,

        @SerializedName("details")
        val details: String
    ) : Parcelable
}