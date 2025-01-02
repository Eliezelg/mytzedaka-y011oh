package com.ijap.app.ui.payment

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ProgressBar
import android.widget.TextView
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.button.MaterialButton
import com.google.android.material.snackbar.Snackbar
import com.ijap.app.R
import com.ijap.app.data.models.PaymentMethod
import com.ijap.app.data.models.PaymentMethodType
import com.ijap.app.utils.SecurityUtils
import java.util.Locale

/**
 * Fragment responsible for managing and displaying payment methods with enhanced security,
 * cultural considerations, and dual gateway support for Stripe Connect and Tranzilla.
 * Implements Shabbat-compliant payment scheduling and RTL layout support.
 */
class PaymentMethodFragment : Fragment() {

    private val viewModel: PaymentViewModel by viewModels()
    private lateinit var recyclerView: RecyclerView
    private lateinit var addPaymentMethodButton: MaterialButton
    private lateinit var progressBar: ProgressBar
    private lateinit var emptyStateText: TextView
    private lateinit var paymentAdapter: PaymentMethodAdapter

    private var isRtlLayout: Boolean = false

    companion object {
        private const val TAG = "PaymentMethodFragment"

        fun newInstance() = PaymentMethodFragment()
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        return inflater.inflate(R.layout.fragment_payment_methods, container, false).apply {
            initializeViews(this)
            setupSecurePaymentDisplay()
            observeViewModel()
        }
    }

    private fun initializeViews(view: View) {
        // Initialize views with RTL support
        isRtlLayout = Locale.getDefault().language == "he"
        view.layoutDirection = if (isRtlLayout) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR

        recyclerView = view.findViewById<RecyclerView>(R.id.payment_methods_recycler_view).apply {
            layoutManager = LinearLayoutManager(context)
            layoutDirection = if (isRtlLayout) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
        }

        addPaymentMethodButton = view.findViewById<MaterialButton>(R.id.add_payment_method_button).apply {
            text = if (isRtlLayout) "הוסף אמצעי תשלום" else "Add Payment Method"
            contentDescription = if (isRtlLayout) "כפתור להוספת אמצעי תשלום" else "Button to add payment method"
        }

        progressBar = view.findViewById(R.id.progress_bar)
        emptyStateText = view.findViewById(R.id.empty_state_text)
    }

    private fun setupSecurePaymentDisplay() {
        paymentAdapter = PaymentMethodAdapter(
            onPaymentMethodSelected = { paymentMethod ->
                if (viewModel.isShabbatMode.value == true && !paymentMethod.isShabbatCompliant) {
                    showShabbatComplianceMessage()
                } else {
                    handlePaymentMethodSelection(paymentMethod)
                }
            },
            onDeletePaymentMethod = { paymentMethod ->
                showDeleteConfirmation(paymentMethod)
            }
        )

        recyclerView.adapter = paymentAdapter

        addPaymentMethodButton.setOnClickListener {
            if (viewModel.isShabbatMode.value == true) {
                showShabbatComplianceMessage()
            } else {
                navigateToAddPaymentMethod()
            }
        }
    }

    private fun observeViewModel() {
        viewModel.paymentMethods.observe(viewLifecycleOwner) { methods ->
            updatePaymentMethodsDisplay(methods)
        }

        viewModel.loading.observe(viewLifecycleOwner) { isLoading ->
            progressBar.isVisible = isLoading
            addPaymentMethodButton.isEnabled = !isLoading
        }

        viewModel.isShabbatMode.observe(viewLifecycleOwner) { isShabbat ->
            handleShabbatMode(isShabbat)
        }
    }

    private fun updatePaymentMethodsDisplay(methods: List<PaymentMethod>) {
        paymentAdapter.submitList(methods)
        emptyStateText.isVisible = methods.isEmpty()
        emptyStateText.text = if (isRtlLayout) {
            "לא נמצאו אמצעי תשלום"
        } else {
            "No payment methods found"
        }
    }

    private fun handlePaymentMethodSelection(paymentMethod: PaymentMethod) {
        // Validate payment method security before selection
        if (!paymentMethod.isValid()) {
            showSecurityError()
            return
        }

        // Handle gateway-specific validation
        when (paymentMethod.gatewayProvider.lowercase()) {
            "stripe" -> validateStripePaymentMethod(paymentMethod)
            "tranzilla" -> validateTranzillaPaymentMethod(paymentMethod)
            else -> showUnsupportedGatewayError()
        }
    }

    private fun validateStripePaymentMethod(paymentMethod: PaymentMethod) {
        if (paymentMethod.type == PaymentMethodType.ISRAELI_DEBIT) {
            showUnsupportedPaymentTypeError()
            return
        }

        // Proceed with Stripe payment method selection
        viewModel.selectPaymentMethod(paymentMethod)
    }

    private fun validateTranzillaPaymentMethod(paymentMethod: PaymentMethod) {
        if (paymentMethod.countryCode != "IL") {
            showUnsupportedCountryError()
            return
        }

        // Proceed with Tranzilla payment method selection
        viewModel.selectPaymentMethod(paymentMethod)
    }

    private fun handleShabbatMode(isShabbat: Boolean) {
        addPaymentMethodButton.isEnabled = !isShabbat
        
        val message = if (isShabbat) {
            if (isRtlLayout) {
                "מצב שבת פעיל - עיבוד תשלומים מושהה"
            } else {
                "Shabbat mode active - payment processing delayed"
            }
        } else {
            null
        }

        message?.let {
            Snackbar.make(requireView(), it, Snackbar.LENGTH_LONG).show()
        }

        // Update payment method display for Shabbat compliance
        paymentAdapter.setShabbatMode(isShabbat)
    }

    private fun showDeleteConfirmation(paymentMethod: PaymentMethod) {
        // Implement secure deletion confirmation dialog
        // with proper cultural considerations
    }

    private fun navigateToAddPaymentMethod() {
        // Navigate to add payment method screen
        // with proper security context
    }

    private fun showSecurityError() {
        val message = if (isRtlLayout) {
            "שגיאת אבטחה - אנא נסה שנית"
        } else {
            "Security error - please try again"
        }
        Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
    }

    private fun showShabbatComplianceMessage() {
        val message = if (isRtlLayout) {
            "פעולה זו אינה זמינה במהלך השבת"
        } else {
            "This action is not available during Shabbat"
        }
        Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
    }

    private fun showUnsupportedGatewayError() {
        val message = if (isRtlLayout) {
            "שער תשלומים לא נתמך"
        } else {
            "Unsupported payment gateway"
        }
        Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
    }

    private fun showUnsupportedPaymentTypeError() {
        val message = if (isRtlLayout) {
            "סוג תשלום לא נתמך"
        } else {
            "Unsupported payment type"
        }
        Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
    }

    private fun showUnsupportedCountryError() {
        val message = if (isRtlLayout) {
            "מדינה לא נתמכת עבור שער תשלומים זה"
        } else {
            "Unsupported country for this payment gateway"
        }
        Snackbar.make(requireView(), message, Snackbar.LENGTH_LONG).show()
    }
}