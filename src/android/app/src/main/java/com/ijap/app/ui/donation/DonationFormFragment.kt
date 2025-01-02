package com.ijap.app.ui.donation

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.biometric.BiometricPrompt // v1.2.0
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.work.WorkManager // v2.8.1
import com.google.android.gms.safetynet.SafetyNet // v18.0.1
import com.ijap.app.R
import com.ijap.app.databinding.FragmentDonationFormBinding
import com.ijap.app.data.models.Donation
import com.ijap.app.data.models.PaymentMethod
import com.ijap.app.utils.CurrencyUtils
import com.ijap.app.utils.SecurityUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import java.math.BigDecimal
import java.util.Currency
import javax.inject.Inject

/**
 * Fragment implementing a culturally-aware donation form with secure payment processing,
 * offline support, and RTL layout compatibility.
 *
 * Features:
 * - Chai (חי) amount support with multiples of 18
 * - Multi-currency handling (USD, EUR, ILS)
 * - Shabbat-compliant donation scheduling
 * - Biometric authentication for payments
 * - Offline mode with background sync
 * - RTL layout support for Hebrew
 */
@AndroidEntryPoint
class DonationFormFragment : Fragment() {

    private var _binding: FragmentDonationFormBinding? = null
    private val binding get() = _binding!!

    private val viewModel: DonationViewModel by viewModels()
    
    @Inject
    lateinit var workManager: WorkManager
    
    private lateinit var biometricPrompt: BiometricPrompt
    private var isOfflineMode = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDonationFormBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupSecurePayment()
        setupCulturalFeatures()
        setupAmountSelection()
        setupPaymentMethods()
        observeUiState()
        handleOfflineMode()
    }

    private fun setupSecurePayment() {
        biometricPrompt = BiometricPrompt(
            this,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    processDonation()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    showError(errString.toString())
                }
            }
        )

        binding.btnDonate.setOnClickListener {
            if (validateForm()) {
                authenticateAndDonate()
            }
        }
    }

    private fun setupCulturalFeatures() {
        // Setup RTL support
        binding.root.layoutDirection = if (resources.configuration.locale.language == "he") {
            View.LAYOUT_DIRECTION_RTL
        } else {
            View.LAYOUT_DIRECTION_LTR
        }

        // Setup Chai amount options
        setupChaiAmounts()

        // Setup Shabbat compliance
        binding.switchShabbatCompliant.setOnCheckedChangeListener { _, isChecked ->
            binding.scheduledDonationGroup.visibility = if (isChecked) View.VISIBLE else View.GONE
        }
    }

    private fun setupChaiAmounts() {
        val currency = binding.spinnerCurrency.selectedItem.toString()
        
        // Setup predefined Chai amounts (multiples of 18)
        binding.apply {
            radioAmount1.text = CurrencyUtils.formatCurrency(18.0, currency, useChaiNotation = true)
            radioAmount2.text = CurrencyUtils.formatCurrency(36.0, currency, useChaiNotation = true)
            radioAmount3.text = CurrencyUtils.formatCurrency(180.0, currency, useChaiNotation = true)
            radioAmount4.text = CurrencyUtils.formatCurrency(360.0, currency, useChaiNotation = true)
        }

        // Custom amount validation for Chai
        binding.editCustomAmount.doAfterTextChanged { text ->
            if (binding.switchChaiAmount.isChecked) {
                val amount = text.toString().toDoubleOrNull() ?: 0.0
                if (amount % 18.0 != 0.0) {
                    binding.editCustomAmount.error = getString(R.string.error_chai_amount)
                }
            }
        }
    }

    private fun setupAmountSelection() {
        binding.radioGroupAmount.setOnCheckedChangeListener { _, checkedId ->
            when (checkedId) {
                R.id.radioAmount1 -> setAmount(18.0)
                R.id.radioAmount2 -> setAmount(36.0)
                R.id.radioAmount3 -> setAmount(180.0)
                R.id.radioAmount4 -> setAmount(360.0)
                R.id.radioCustom -> binding.editCustomAmount.visibility = View.VISIBLE
            }
        }

        binding.spinnerCurrency.onItemSelectedListener = object : android.widget.AdapterView.OnItemSelectedListener {
            override fun onItemSelected(parent: android.widget.AdapterView<*>?, view: View?, position: Int, id: Long) {
                updateCurrencyDisplay()
            }
            override fun onNothingSelected(parent: android.widget.AdapterView<*>?) {}
        }
    }

    private fun setupPaymentMethods() {
        // Initialize payment method selection based on currency
        val currency = binding.spinnerCurrency.selectedItem.toString()
        val isIsraeliCurrency = currency == "ILS"

        binding.paymentMethodGroup.visibility = View.VISIBLE
        binding.israeliPaymentGroup.visibility = if (isIsraeliCurrency) View.VISIBLE else View.GONE
    }

    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is DonationUiState.Loading -> showLoading()
                    is DonationUiState.Success -> handleSuccess(state)
                    is DonationUiState.Error -> showError(state.message)
                    is DonationUiState.Processing -> showProcessing()
                }
            }
        }
    }

    private fun handleOfflineMode() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.checkOfflineMode().collect { offline ->
                isOfflineMode = offline
                binding.offlineModeIndicator.visibility = if (offline) View.VISIBLE else View.GONE
                binding.btnDonate.isEnabled = !offline || binding.switchAllowOffline.isChecked
            }
        }
    }

    private fun authenticateAndDonate() {
        if (requiresAuthentication()) {
            val promptInfo = BiometricPrompt.PromptInfo.Builder()
                .setTitle(getString(R.string.biometric_prompt_title))
                .setSubtitle(getString(R.string.biometric_prompt_subtitle))
                .setNegativeButtonText(getString(R.string.biometric_prompt_cancel))
                .build()

            biometricPrompt.authenticate(promptInfo)
        } else {
            processDonation()
        }
    }

    private fun processDonation() {
        val amount = getSelectedAmount()
        val currency = binding.spinnerCurrency.selectedItem.toString()
        val paymentMethod = getSelectedPaymentMethod()
        
        viewModel.createDonation(
            amount = BigDecimal(amount),
            currency = currency,
            associationId = requireArguments().getString("associationId")!!,
            paymentMethod = paymentMethod,
            isAnonymous = binding.switchAnonymous.isChecked,
            isRecurring = binding.switchRecurring.isChecked,
            isChaiAmount = binding.switchChaiAmount.isChecked,
            isShabbatCompliant = binding.switchShabbatCompliant.isChecked
        )
    }

    private fun validateForm(): Boolean {
        var isValid = true

        // Validate amount
        val amount = getSelectedAmount()
        if (!viewModel.validateDonationAmount(BigDecimal(amount), 
            binding.spinnerCurrency.selectedItem.toString())) {
            binding.editCustomAmount.error = getString(R.string.error_invalid_amount)
            isValid = false
        }

        // Validate payment method
        if (getSelectedPaymentMethod() == null) {
            showError(getString(R.string.error_select_payment))
            isValid = false
        }

        return isValid
    }

    private fun getSelectedAmount(): Double {
        return when (binding.radioGroupAmount.checkedRadioButtonId) {
            R.id.radioAmount1 -> 18.0
            R.id.radioAmount2 -> 36.0
            R.id.radioAmount3 -> 180.0
            R.id.radioAmount4 -> 360.0
            else -> binding.editCustomAmount.text.toString().toDoubleOrNull() ?: 0.0
        }
    }

    private fun getSelectedPaymentMethod(): PaymentMethod? {
        // Implementation would get selected payment method from UI
        return null
    }

    private fun requiresAuthentication(): Boolean {
        val amount = getSelectedAmount()
        val currency = binding.spinnerCurrency.selectedItem.toString()
        
        // Require authentication for large amounts
        return when (currency) {
            "USD" -> amount >= 1000.0
            "EUR" -> amount >= 850.0
            "ILS" -> amount >= 3500.0
            else -> true
        }
    }

    private fun showLoading() {
        binding.progressBar.visibility = View.VISIBLE
        binding.btnDonate.isEnabled = false
    }

    private fun showProcessing() {
        binding.progressBar.visibility = View.VISIBLE
        binding.btnDonate.isEnabled = false
        binding.processingMessage.visibility = View.VISIBLE
    }

    private fun handleSuccess(state: DonationUiState.Success) {
        binding.progressBar.visibility = View.GONE
        binding.successGroup.visibility = View.VISIBLE
        binding.donationId.text = state.donationId
        binding.receiptNumber.text = state.receiptNumber
    }

    private fun showError(message: String) {
        binding.progressBar.visibility = View.GONE
        binding.errorMessage.text = message
        binding.errorMessage.visibility = View.VISIBLE
        binding.btnDonate.isEnabled = true
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        fun newInstance(associationId: String) = DonationFormFragment().apply {
            arguments = Bundle().apply {
                putString("associationId", associationId)
            }
        }
    }
}