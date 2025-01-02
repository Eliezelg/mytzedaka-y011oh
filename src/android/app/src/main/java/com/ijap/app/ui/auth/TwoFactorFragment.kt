package com.ijap.app.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.biometric.BiometricPrompt
import androidx.core.widget.doAfterTextChanged
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.ijap.app.data.repository.AuthRepository
import com.ijap.app.databinding.FragmentTwoFactorBinding
import com.ijap.app.ui.common.ViewUtils
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.BiometricUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.util.concurrent.Executors

/**
 * Fragment handling secure two-factor authentication with comprehensive security features,
 * accessibility support, and RTL layout compatibility.
 */
@AndroidEntryPoint
class TwoFactorFragment : Fragment() {

    private var _binding: FragmentTwoFactorBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var securityUtils: SecurityUtils

    private var remainingAttempts = 3
    private var isSmsEnabled = false
    private var isProcessing = false

    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var biometricPrompt: BiometricPrompt

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentTwoFactorBinding.inflate(inflater, container, false)
        setupUI()
        setupAccessibility()
        setupBiometricAuth()
        return binding.root
    }

    private fun setupUI() {
        with(binding) {
            // Configure OTP input with validation
            etOtpCode.doAfterTextChanged { text ->
                btnVerify.isEnabled = text?.length == 6 && !isProcessing
                tilOtpCode.error = null
            }

            // Set up verify button
            btnVerify.setOnClickListener {
                verifyCode(etOtpCode.text.toString())
            }

            // Configure SMS fallback
            btnSendSms.setOnClickListener {
                handleSmsFailover()
            }

            // Configure recovery code option
            btnUseRecoveryCode.setOnClickListener {
                showRecoveryCodeDialog()
            }
        }
    }

    private fun setupAccessibility() {
        with(binding) {
            // Set content descriptions
            tvTitle.contentDescription = getString(R.string.two_factor_title_description)
            tvDescription.contentDescription = getString(R.string.two_factor_description_accessibility)
            
            // Configure input field accessibility
            tilOtpCode.apply {
                setAccessibilityDelegate(object : View.AccessibilityDelegate() {
                    override fun onPopulateAccessibilityEvent(host: View, event: AccessibilityEvent) {
                        super.onPopulateAccessibilityEvent(host, event)
                        if (event.eventType == AccessibilityEvent.TYPE_VIEW_FOCUSED) {
                            event.text.add(getString(R.string.two_factor_code_accessibility_hint))
                        }
                    }
                })
            }

            // Set RTL layout support
            ViewUtils.setRtlLayoutDirection(root, resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL)
        }
    }

    private fun setupBiometricAuth() {
        if (BiometricUtils.canAuthenticateWithBiometrics(requireContext()) == BiometricUtils.BiometricCapability.AVAILABLE) {
            biometricPrompt = BiometricPrompt(this, executor,
                object : BiometricPrompt.AuthenticationCallback() {
                    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                        super.onAuthenticationSucceeded(result)
                        // Handle successful biometric authentication
                        lifecycleScope.launch {
                            handleBiometricSuccess()
                        }
                    }

                    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                        super.onAuthenticationError(errorCode, errString)
                        showError(errString.toString())
                    }
                })
        }
    }

    private fun verifyCode(code: String) {
        if (isProcessing) return

        // Validate input
        if (!securityUtils.validateInput(code)) {
            showError(getString(R.string.two_factor_invalid_code))
            return
        }

        isProcessing = true
        showLoading(true)

        lifecycleScope.launch {
            try {
                authRepository.verifyTwoFactor(code, getVerificationToken())
                    .collect { result ->
                        result.onSuccess {
                            handleVerificationSuccess()
                        }.onFailure { error ->
                            handleVerificationError(error)
                        }
                    }
            } catch (e: Exception) {
                handleVerificationError(e)
            } finally {
                isProcessing = false
                showLoading(false)
            }
        }
    }

    private fun handleSmsFailover() {
        if (isProcessing || !isSmsEnabled) return

        isProcessing = true
        showLoading(true)

        lifecycleScope.launch {
            try {
                authRepository.requestSmsCode()
                    .collect { result ->
                        result.onSuccess {
                            showSuccess(getString(R.string.two_factor_sms_sent))
                            isSmsEnabled = false // Prevent multiple SMS requests
                        }.onFailure { error ->
                            showError(error.message ?: getString(R.string.two_factor_sms_error))
                        }
                    }
            } catch (e: Exception) {
                showError(e.message ?: getString(R.string.two_factor_sms_error))
            } finally {
                isProcessing = false
                showLoading(false)
            }
        }
    }

    private fun showRecoveryCodeDialog() {
        // Implementation of recovery code dialog with accessibility support
        // would go here
    }

    private fun handleBiometricSuccess() {
        // Handle successful biometric authentication
        // Implementation would go here
    }

    private fun handleVerificationSuccess() {
        // Navigate to next screen or finish authentication
        // Implementation would go here
    }

    private fun handleVerificationError(error: Throwable) {
        remainingAttempts--
        val errorMessage = when {
            remainingAttempts <= 0 -> getString(R.string.two_factor_max_attempts)
            else -> getString(R.string.two_factor_attempts_remaining, remainingAttempts)
        }
        showError(errorMessage)
    }

    private fun showLoading(show: Boolean) {
        with(binding) {
            progressIndicator.visibility = if (show) View.VISIBLE else View.GONE
            btnVerify.isEnabled = !show
            btnSendSms.isEnabled = !show && isSmsEnabled
            btnUseRecoveryCode.isEnabled = !show

            // Accessibility announcement
            if (show) {
                progressIndicator.announceForAccessibility(
                    getString(R.string.two_factor_verifying)
                )
            }
        }
    }

    private fun showError(message: String) {
        with(binding) {
            tvError.text = message
            tvError.visibility = View.VISIBLE
            ViewUtils.fadeIn(tvError)
            
            // Accessibility announcement
            tvError.announceForAccessibility(message)
        }
    }

    private fun showSuccess(message: String) {
        with(binding) {
            tvError.visibility = View.GONE
            // Show success message with accessibility support
            ViewUtils.setAccessibilityText(root, message, true)
        }
    }

    private fun getVerificationToken(): String {
        return arguments?.getString(ARG_VERIFICATION_TOKEN)
            ?: throw IllegalStateException("Verification token not provided")
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_VERIFICATION_TOKEN = "verification_token"

        fun newInstance(verificationToken: String): TwoFactorFragment {
            return TwoFactorFragment().apply {
                arguments = Bundle().apply {
                    putString(ARG_VERIFICATION_TOKEN, verificationToken)
                }
            }
        }
    }
}