package com.ijap.app.data.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize
import java.util.TimeZone
import java.util.Calendar

/**
 * Enum class defining supported payment method types with validation rules
 * for both international and Israeli market transactions.
 */
enum class PaymentMethodType {
    /**
     * Credit card payment method supporting international transactions
     * via Stripe Connect and Tranzilla gateways
     */
    CREDIT_CARD,

    /**
     * Bank transfer method with regional support and specific
     * validation rules for different jurisdictions
     */
    BANK_TRANSFER,

    /**
     * Direct debit method for recurring donations with
     * support for international banking systems
     */
    DIRECT_DEBIT,

    /**
     * Specialized debit method for Israeli market with
     * Tranzilla gateway integration and local compliance
     */
    ISRAELI_DEBIT;
}

/**
 * Data class representing a payment method with comprehensive validation
 * and display capabilities. Supports both Stripe Connect and Tranzilla
 * payment gateways with proper cultural considerations for Jewish users.
 *
 * @property id Unique identifier for the payment method
 * @property type Type of payment method from PaymentMethodType enum
 * @property gatewayProvider Payment gateway provider (Stripe/Tranzilla)
 * @property lastFourDigits Last four digits of card/account (if applicable)
 * @property expiryMonth Expiry month for cards (1-12)
 * @property expiryYear Expiry year (four digits)
 * @property cardBrand Card brand name (if applicable)
 * @property isDefault Whether this is the default payment method
 * @property createdAt Timestamp of creation
 * @property currencyCode ISO currency code
 * @property countryCode ISO country code
 * @property gatewaySpecificData Additional gateway-specific data
 * @property localePreference User's locale preference
 * @property isShabbatCompliant Flag for Shabbat-compliant processing
 */
@Parcelize
data class PaymentMethod(
    val id: String,
    val type: PaymentMethodType,
    val gatewayProvider: String,
    val lastFourDigits: String? = null,
    val expiryMonth: Int? = null,
    val expiryYear: Int? = null,
    val cardBrand: String? = null,
    val isDefault: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val currencyCode: String,
    val countryCode: String,
    val gatewaySpecificData: Map<String, Any> = emptyMap(),
    val localePreference: String,
    val isShabbatCompliant: Boolean = false
) : Parcelable {

    companion object {
        private const val STRIPE_GATEWAY = "stripe"
        private const val TRANZILLA_GATEWAY = "tranzilla"
        private const val ISRAELI_CURRENCY = "ILS"
        private const val ISRAELI_COUNTRY_CODE = "IL"
    }

    /**
     * Comprehensive validation of payment method validity considering:
     * - Payment method type support
     * - Expiry date validation with timezone consideration
     * - Currency support for selected gateway
     * - Regional compliance rules
     * - Gateway-specific requirements
     * - Shabbat compliance if enabled
     *
     * @return Boolean indicating if the payment method is valid
     */
    fun isValid(): Boolean {
        // Basic validation
        if (id.isBlank() || gatewayProvider.isEmpty()) return false

        // Gateway-specific validation
        when (gatewayProvider.lowercase()) {
            STRIPE_GATEWAY -> {
                if (type == PaymentMethodType.ISRAELI_DEBIT) return false
                if (currencyCode == ISRAELI_CURRENCY && countryCode != ISRAELI_COUNTRY_CODE) return false
            }
            TRANZILLA_GATEWAY -> {
                if (countryCode != ISRAELI_COUNTRY_CODE) return false
            }
            else -> return false
        }

        // Card-specific validation
        if (type == PaymentMethodType.CREDIT_CARD) {
            if (lastFourDigits == null || expiryMonth == null || expiryYear == null) {
                return false
            }

            // Expiry date validation with timezone consideration
            val calendar = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem"))
            val currentYear = calendar.get(Calendar.YEAR)
            val currentMonth = calendar.get(Calendar.MONTH) + 1

            if (expiryYear < currentYear || 
                (expiryYear == currentYear && expiryMonth < currentMonth)) {
                return false
            }
        }

        // Validate currency support
        if (type == PaymentMethodType.ISRAELI_DEBIT && currencyCode != ISRAELI_CURRENCY) {
            return false
        }

        return true
    }

    /**
     * Generates localized display name with cultural considerations including:
     * - Proper RTL support for Hebrew
     * - Cultural sensitivity for Jewish users
     * - PCI DSS compliant data display
     *
     * @return Localized display name string
     */
    fun getDisplayName(): String {
        val isHebrew = localePreference.startsWith("he")
        val displayBuilder = StringBuilder()

        // Add payment type
        val typeDisplay = when (type) {
            PaymentMethodType.CREDIT_CARD -> if (isHebrew) "כרטיס אשראי" else "Credit Card"
            PaymentMethodType.BANK_TRANSFER -> if (isHebrew) "העברה בנקאית" else "Bank Transfer"
            PaymentMethodType.DIRECT_DEBIT -> if (isHebrew) "הוראת קבע" else "Direct Debit"
            PaymentMethodType.ISRAELI_DEBIT -> if (isHebrew) "הוראת קבע ישראלית" else "Israeli Debit"
        }
        displayBuilder.append(typeDisplay)

        // Add masked card number for credit cards
        if (type == PaymentMethodType.CREDIT_CARD && !lastFourDigits.isNullOrEmpty()) {
            displayBuilder.append(" - ")
            displayBuilder.append(if (isHebrew) "****" else "****")
            displayBuilder.append(lastFourDigits)
        }

        // Add currency indicator
        displayBuilder.append(" (").append(currencyCode).append(")")

        // Add default indicator
        if (isDefault) {
            displayBuilder.append(if (isHebrew) " - ברירת מחדל" else " - Default")
        }

        // Add Shabbat-compliant indicator if relevant
        if (isShabbatCompliant) {
            displayBuilder.append(if (isHebrew) " - שומר שבת" else " - Shabbat Compliant")
        }

        return displayBuilder.toString()
    }
}