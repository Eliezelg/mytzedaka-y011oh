package com.ijap.app.ui.donation

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.accessibility.AccessibilityManager
import android.widget.Toast
import androidx.core.view.ViewCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.ijap.app.R
import com.ijap.app.databinding.FragmentDonationConfirmationBinding
import com.ijap.app.data.models.Donation
import com.ijap.app.utils.CurrencyUtils
import com.ijap.app.utils.SecurityUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import java.util.TimeZone
import javax.inject.Inject

/**
 * Fragment displaying donation confirmation details with enhanced security,
 * cultural sensitivity, and accessibility support for Jewish charitable giving.
 *
 * Features:
 * - Secure payment confirmation
 * - Chai amount validation
 * - Shabbat compliance checking
 * - RTL support for Hebrew
 * - Comprehensive error handling
 * - Accessibility support
 *
 * @version 1.0
 */
@AndroidEntryPoint
class DonationConfirmationFragment : Fragment() {

    private val viewModel: DonationViewModel by viewModels()
    private var _binding: FragmentDonationConfirmationBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var securityUtils: SecurityUtils

    @Inject
    lateinit var accessibilityManager: AccessibilityManager

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDonationConfirmationBinding.inflate(inflater, container, false)
        setupView()
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        observeUiState()
        setupAccessibility()
        setupSecurityFeatures()
    }

    private fun setupView() {
        with(binding) {
            // Configure RTL support
            ViewCompat.setLayoutDirection(root, ViewCompat.LAYOUT_DIRECTION_LOCALE)

            // Setup confirmation button with security checks
            confirmButton.setOnClickListener {
                if (validateConfirmation()) {
                    processDonation()
                }
            }

            // Setup cancel button
            cancelButton.setOnClickListener {
                findNavController().navigateUp()
            }
        }
    }

    private fun setupAccessibility() {
        with(binding) {
            // Set content descriptions
            confirmButton.contentDescription = getString(R.string.confirm_donation_accessibility)
            cancelButton.contentDescription = getString(R.string.cancel_donation_accessibility)

            // Configure TalkBack support
            if (accessibilityManager.isEnabled) {
                donationSummaryContainer.importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
                amountLabel.accessibilityTraversalBefore = confirmButton.id
            }
        }
    }

    private fun setupSecurityFeatures() {
        // Configure security-related UI elements
        with(binding) {
            // Add secure flag to sensitive views
            amountValue.setSecureMode(true)
            paymentMethodValue.setSecureMode(true)

            // Setup biometric confirmation if needed
            if (requiresBiometricAuth()) {
                securityUtils.showBiometricPrompt(
                    requireActivity(),
                    object : SecurityUtils.BiometricAuthCallback {
                        override fun onAuthSuccess() {
                            enableConfirmation()
                        }

                        override fun onAuthError(errorCode: Int, errorMessage: String, remainingRetries: Int) {
                            handleBiometricError(errorCode, errorMessage, remainingRetries)
                        }
                    }
                )
            }
        }
    }

    private fun observeUiState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collect { state ->
                when (state) {
                    is DonationUiState.Loading -> showLoading()
                    is DonationUiState.Success -> handleSuccess(state)
                    is DonationUiState.Error -> handleError(state.message)
                    is DonationUiState.Processing -> showProcessing()
                }
            }
        }
    }

    private fun processDonation() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                // Validate cultural compliance
                if (!validateCulturalCompliance()) {
                    return@launch
                }

                // Process the donation
                binding.confirmButton.isEnabled = false
                viewModel.createDonation(
                    amount = getValidatedAmount(),
                    currency = binding.currencyValue.text.toString(),
                    associationId = arguments?.getString(ARG_ASSOCIATION_ID)
                        ?: throw IllegalStateException("Association ID required"),
                    paymentMethod = getSelectedPaymentMethod(),
                    isAnonymous = binding.anonymousCheckbox.isChecked,
                    isRecurring = binding.recurringCheckbox.isChecked,
                    isChaiAmount = binding.chaiAmountCheckbox.isChecked,
                    isShabbatCompliant = binding.shabbatCompliantCheckbox.isChecked,
                    dedication = getDedicationDetails()
                )
            } catch (e: Exception) {
                handleError(e.message ?: getString(R.string.generic_error))
            }
        }
    }

    private fun validateCulturalCompliance(): Boolean {
        val amount = getValidatedAmount()
        
        // Validate chai amount if selected
        if (binding.chaiAmountCheckbox.isChecked && amount % 18.0 != 0.0) {
            showError(getString(R.string.invalid_chai_amount))
            return false
        }

        // Check Shabbat compliance if enabled
        if (binding.shabbatCompliantCheckbox.isChecked) {
            val timezone = TimeZone.getDefault().id
            if (!viewModel.checkShabbatCompliance(System.currentTimeMillis(), timezone)) {
                showError(getString(R.string.shabbat_compliance_error))
                return false
            }
        }

        return true
    }

    private fun validateConfirmation(): Boolean {
        // Validate required fields
        if (getValidatedAmount() <= 0) {
            showError(getString(R.string.invalid_amount))
            return false
        }

        // Validate payment method
        if (getSelectedPaymentMethod() == null) {
            showError(getString(R.string.invalid_payment_method))
            return false
        }

        // Additional security validations
        if (!securityUtils.validateTransaction()) {
            showError(getString(R.string.security_validation_failed))
            return false
        }

        return true
    }

    private fun handleSuccess(state: DonationUiState.Success) {
        with(binding) {
            progressBar.visibility = View.GONE
            successGroup.visibility = View.VISIBLE
            
            // Format receipt number with cultural considerations
            receiptNumberValue.text = state.receiptNumber
            
            // Format amount with proper currency and chai notation
            amountValue.text = CurrencyUtils.formatCurrency(
                amount = state.amount.toDouble(),
                currencyCode = binding.currencyValue.text.toString(),
                useChaiNotation = binding.chaiAmountCheckbox.isChecked
            )
        }

        // Navigate to success screen after delay
        view?.postDelayed({
            findNavController().navigate(
                R.id.action_donationConfirmation_to_donationSuccess,
                Bundle().apply {
                    putString("donationId", state.donationId)
                }
            )
        }, SUCCESS_DELAY_MS)
    }

    private fun handleError(message: String) {
        binding.progressBar.visibility = View.GONE
        binding.confirmButton.isEnabled = true
        showError(message)
    }

    private fun showError(message: String) {
        Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
        binding.errorText.apply {
            text = message
            visibility = View.VISIBLE
        }
    }

    private fun showLoading() {
        binding.progressBar.visibility = View.VISIBLE
        binding.confirmButton.isEnabled = false
    }

    private fun showProcessing() {
        binding.progressBar.visibility = View.VISIBLE
        binding.processingText.visibility = View.VISIBLE
        binding.confirmButton.isEnabled = false
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_ASSOCIATION_ID = "association_id"
        private const val SUCCESS_DELAY_MS = 2000L
    }
}