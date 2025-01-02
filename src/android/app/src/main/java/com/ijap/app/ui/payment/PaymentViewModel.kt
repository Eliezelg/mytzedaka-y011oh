package com.ijap.app.ui.payment

import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ijap.app.data.api.ApiService
import com.ijap.app.data.models.PaymentMethod
import com.ijap.app.data.models.PaymentMethodType
import com.ijap.app.data.models.Donation
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.CurrencyUtils
import java.math.BigDecimal
import javax.inject.Inject
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.TimeZone

/**
 * ViewModel managing payment operations with enhanced security and cultural considerations
 * for Jewish charitable donations. Supports both international (Stripe) and Israeli (Tranzilla)
 * payment processing with Shabbat compliance.
 */
class PaymentViewModel @Inject constructor(
    private val apiService: ApiService,
    private val securityUtils: SecurityUtils
) : ViewModel() {

    private val _paymentMethods = MutableLiveData<List<PaymentMethod>>()
    val paymentMethods: LiveData<List<PaymentMethod>> = _paymentMethods

    private val _selectedPaymentMethod = MutableLiveData<PaymentMethod>()
    val selectedPaymentMethod: LiveData<PaymentMethod> = _selectedPaymentMethod

    private val _loading = MutableLiveData<Boolean>()
    val loading: LiveData<Boolean> = _loading

    private val _error = MutableLiveData<String>()
    val error: LiveData<String> = _error

    private val _isShabbat = MutableLiveData<Boolean>()
    private val _selectedCurrency = MutableLiveData<String>()

    init {
        _selectedCurrency.value = "USD"
        checkShabbatStatus()
    }

    /**
     * Loads available payment methods with security validation and cultural considerations
     */
    fun loadPaymentMethods() {
        viewModelScope.launch {
            try {
                _loading.value = true
                _error.value = null

                val response = apiService.getPaymentMethods(
                    currency = _selectedCurrency.value ?: "USD",
                    country = if (_selectedCurrency.value == "ILS") "IL" else "US"
                ).blockingGet()

                // Filter and validate payment methods
                val validMethods = response.filter { method ->
                    method.isValid() && 
                    (_isShabbat.value != true || method.isShabbatCompliant)
                }

                _paymentMethods.value = validMethods
            } catch (e: Exception) {
                _error.value = "Failed to load payment methods: ${e.message}"
            } finally {
                _loading.value = false
            }
        }
    }

    /**
     * Validates donation amount according to Jewish customs and currency rules
     */
    fun validateDonationAmount(amount: BigDecimal, currency: String): Boolean {
        if (amount <= BigDecimal.ZERO) return false

        // Validate against currency-specific rules
        if (!CurrencyUtils.validateAmount(amount.toDouble(), currency)) {
            return false
        }

        // Check for Chai (חי) multiples in appropriate currencies
        if (currency in listOf("USD", "ILS", "EUR")) {
            val chaiValue = when (currency) {
                "ILS" -> 18.0
                "USD" -> 18.0
                "EUR" -> 18.0
                else -> return true
            }
            
            if (amount.remainder(BigDecimal(chaiValue)) != BigDecimal.ZERO) {
                _error.value = "Consider donating in multiples of ${CurrencyUtils.formatCurrency(chaiValue, currency)}"
                return false
            }
        }

        return true
    }

    /**
     * Processes payment with comprehensive security measures and cultural considerations
     */
    fun processPayment(donation: Donation): LiveData<PaymentResult> {
        val result = MutableLiveData<PaymentResult>()

        viewModelScope.launch {
            try {
                _loading.value = true
                _error.value = null

                // Validate Shabbat compliance
                if (_isShabbat.value == true && !donation.isShabbatCompliant) {
                    throw SecurityException("Payment processing not allowed during Shabbat")
                }

                // Validate payment method
                selectedPaymentMethod.value?.let { paymentMethod ->
                    if (!paymentMethod.isValid()) {
                        throw SecurityException("Invalid payment method")
                    }

                    // Encrypt sensitive payment data
                    val encryptedDonation = donation.copy(
                        paymentMethodId = securityUtils.encryptData(
                            donation.paymentMethodId,
                            "payment_method_key"
                        )
                    )

                    // Process payment through appropriate gateway
                    val response = apiService.createDonation(encryptedDonation).blockingGet()
                    
                    result.value = PaymentResult(
                        success = true,
                        transactionId = response.transactionId,
                        receiptNumber = response.receiptNumber
                    )
                } ?: throw IllegalStateException("No payment method selected")

            } catch (e: Exception) {
                _error.value = "Payment processing failed: ${e.message}"
                result.value = PaymentResult(
                    success = false,
                    error = e.message ?: "Unknown error occurred"
                )
            } finally {
                _loading.value = false
            }
        }

        return result
    }

    /**
     * Updates selected payment method with validation
     */
    fun selectPaymentMethod(paymentMethod: PaymentMethod) {
        if (paymentMethod.isValid() && 
            (_isShabbat.value != true || paymentMethod.isShabbatCompliant)) {
            _selectedPaymentMethod.value = paymentMethod
            _error.value = null
        } else {
            _error.value = "Invalid payment method selection"
        }
    }

    /**
     * Updates selected currency with validation
     */
    fun updateCurrency(currency: String) {
        if (currency in listOf("USD", "EUR", "ILS")) {
            _selectedCurrency.value = currency
            loadPaymentMethods()
        }
    }

    /**
     * Checks if current time is during Shabbat
     */
    private fun checkShabbatStatus() {
        viewModelScope.launch {
            try {
                val jerusalemTimeZone = TimeZone.getTimeZone("Asia/Jerusalem")
                val calendar = Calendar.getInstance(jerusalemTimeZone)
                
                val response = apiService.validateShabbatCompliance(
                    timestamp = calendar.timeInMillis,
                    timezone = jerusalemTimeZone.id
                ).blockingGet()

                _isShabbat.value = response.isCompliant
            } catch (e: Exception) {
                _error.value = "Failed to check Shabbat status: ${e.message}"
            }
        }
    }
}

/**
 * Data class representing payment processing result
 */
data class PaymentResult(
    val success: Boolean,
    val transactionId: String? = null,
    val receiptNumber: String? = null,
    val error: String? = null
)