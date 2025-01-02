package com.ijap.app.utils

import java.text.NumberFormat
import java.text.ParseException
import java.util.Currency
import java.util.Locale
import java.math.BigDecimal
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs

/**
 * Utility object providing comprehensive currency handling for Jewish donations
 * with support for international currencies, Israeli Shekel, and culturally significant amount handling.
 *
 * @version 1.0
 */
object CurrencyUtils {

    // Minimum donation amounts per currency
    private val MIN_DONATION_AMOUNTS = mapOf(
        "USD" to 18.0,
        "EUR" to 16.0,
        "ILS" to 60.0
    )

    // Maximum donation amounts per currency
    private val MAX_DONATION_AMOUNTS = mapOf(
        "USD" to 1000000.0,
        "EUR" to 850000.0,
        "ILS" to 3500000.0
    )

    private const val DEFAULT_CURRENCY = "USD"
    private val SUPPORTED_CURRENCIES = setOf("USD", "EUR", "ILS")
    private const val DECIMAL_PLACES = 2

    // Thread-safe cache for NumberFormat instances
    private val CURRENCY_FORMAT_CACHE = ConcurrentHashMap<String, NumberFormat>()

    /**
     * Formats a numeric amount to a localized currency string with RTL support and cultural considerations.
     *
     * @param amount The numeric amount to format
     * @param currencyCode The ISO 4217 currency code (USD, EUR, ILS)
     * @param locale Optional locale override (defaults to system locale)
     * @param useChaiNotation Whether to use chai notation for multiples of 18
     * @return Formatted currency string with proper symbol placement and RTL support
     * @throws IllegalArgumentException if currency code is not supported
     */
    @Throws(IllegalArgumentException::class)
    fun formatCurrency(
        amount: Double,
        currencyCode: String,
        locale: String? = null,
        useChaiNotation: Boolean = false
    ): String {
        require(SUPPORTED_CURRENCIES.contains(currencyCode)) {
            "Unsupported currency code: $currencyCode"
        }

        val formattingLocale = locale?.let { Locale(it) } ?: when (currencyCode) {
            "ILS" -> Locale("he", "IL")
            else -> Locale.getDefault()
        }

        val formatter = CURRENCY_FORMAT_CACHE.getOrPut(currencyCode) {
            NumberFormat.getCurrencyInstance(formattingLocale).apply {
                currency = Currency.getInstance(currencyCode)
                minimumFractionDigits = DECIMAL_PLACES
                maximumFractionDigits = DECIMAL_PLACES
            }
        }

        // Handle chai notation if requested and amount is a multiple of 18
        if (useChaiNotation && abs(amount % 18.0) < 0.001) {
            val chaiMultiple = (amount / 18.0).toInt()
            return "${formatter.format(amount)} (${chaiMultiple}×ח״י)"
        }

        return formatter.format(amount)
    }

    /**
     * Parses a currency string with support for cultural notations and multiple formats.
     *
     * @param currencyString The string to parse
     * @param currencyCode The expected currency code
     * @return Parsed amount with proper precision
     * @throws ParseException if the string cannot be parsed
     */
    @Throws(ParseException::class)
    fun parseCurrencyString(currencyString: String, currencyCode: String): Double {
        require(SUPPORTED_CURRENCIES.contains(currencyCode)) {
            "Unsupported currency code: $currencyCode"
        }

        // Remove cultural and religious notations
        val cleanString = currencyString
            .replace(Regex("\\(.*?\\)"), "") // Remove parenthetical notes
            .replace("ח״י", "") // Remove chai symbol
            .replace(Regex("[^0-9.,\\-]"), "") // Keep only numbers and decimal separator

        val formatter = CURRENCY_FORMAT_CACHE.getOrPut(currencyCode) {
            NumberFormat.getCurrencyInstance().apply {
                currency = Currency.getInstance(currencyCode)
            }
        }

        val parsedAmount = try {
            BigDecimal(cleanString).setScale(DECIMAL_PLACES, BigDecimal.ROUND_HALF_UP).toDouble()
        } catch (e: NumberFormatException) {
            throw ParseException("Unable to parse currency string: $currencyString", 0)
        }

        if (!validateAmount(parsedAmount, currencyCode)) {
            throw ParseException("Amount outside valid range for $currencyCode", 0)
        }

        return parsedAmount
    }

    /**
     * Validates donation amount against currency-specific rules and cultural requirements.
     *
     * @param amount The amount to validate
     * @param currencyCode The currency code for validation rules
     * @return True if amount meets all validation criteria
     */
    fun validateAmount(amount: Double, currencyCode: String): Boolean {
        if (!SUPPORTED_CURRENCIES.contains(currencyCode)) {
            return false
        }

        val minAmount = MIN_DONATION_AMOUNTS[currencyCode] ?: return false
        val maxAmount = MAX_DONATION_AMOUNTS[currencyCode] ?: return false

        return amount >= minAmount && 
               amount <= maxAmount && 
               BigDecimal(amount).scale() <= DECIMAL_PLACES
    }

    /**
     * Converts amounts between currencies with caching and fallback mechanisms.
     *
     * @param amount The amount to convert
     * @param fromCurrency Source currency code
     * @param toCurrency Target currency code
     * @return Converted amount with proper precision
     * @throws CurrencyConversionException if conversion fails
     */
    @Throws(CurrencyConversionException::class)
    fun convertCurrency(amount: Double, fromCurrency: String, toCurrency: String): Double {
        require(SUPPORTED_CURRENCIES.contains(fromCurrency)) {
            "Unsupported source currency: $fromCurrency"
        }
        require(SUPPORTED_CURRENCIES.contains(toCurrency)) {
            "Unsupported target currency: $toCurrency"
        }

        if (fromCurrency == toCurrency) {
            return amount
        }

        try {
            // Note: Actual exchange rate fetching would be implemented here
            // This is a simplified implementation
            val rate = when {
                fromCurrency == "USD" && toCurrency == "ILS" -> 3.5
                fromCurrency == "ILS" && toCurrency == "USD" -> 1/3.5
                fromCurrency == "EUR" && toCurrency == "USD" -> 1.1
                fromCurrency == "USD" && toCurrency == "EUR" -> 1/1.1
                fromCurrency == "EUR" && toCurrency == "ILS" -> 3.85
                fromCurrency == "ILS" && toCurrency == "EUR" -> 1/3.85
                else -> throw CurrencyConversionException("Unsupported conversion pair")
            }

            return BigDecimal(amount)
                .multiply(BigDecimal(rate))
                .setScale(DECIMAL_PLACES, BigDecimal.ROUND_HALF_UP)
                .toDouble()
        } catch (e: Exception) {
            throw CurrencyConversionException("Failed to convert currency", e)
        }
    }

    class CurrencyConversionException : Exception {
        constructor(message: String) : super(message)
        constructor(message: String, cause: Throwable) : super(message, cause)
    }
}