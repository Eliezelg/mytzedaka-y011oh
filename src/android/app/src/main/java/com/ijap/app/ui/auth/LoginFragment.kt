package com.ijap.app.ui.auth

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import com.google.android.material.textfield.TextInputLayout
import com.ijap.app.R
import com.ijap.app.data.repository.AuthRepository
import com.ijap.app.databinding.FragmentLoginBinding
import com.ijap.app.utils.BiometricUtils
import com.ijap.app.utils.SecurityUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.Locale
import javax.inject.Inject

/**
 * Fragment implementing secure login functionality with email/password and biometric authentication.
 * Supports RTL layouts and multiple languages for the IJAP Android application.
 * Version: 1.0.0
 */
@AndroidEntryPoint
class LoginFragment : Fragment() {

    private var _binding: FragmentLoginBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var authRepository: AuthRepository

    @Inject
    lateinit var securityUtils: SecurityUtils

    @Inject
    lateinit var biometricUtils: BiometricUtils

    private val viewModel: LoginViewModel by viewModels()

    private var loginAttempts = 0
    private val maxLoginAttempts = 3
    private var isBiometricEnabled = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLoginBinding.inflate(inflater, container, false)

        // Setup RTL support based on locale
        val isRTL = Locale.getDefault().language == "he"
        binding.root.layoutDirection = if (isRTL) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR

        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupUI()
        setupBiometricAuth()
        observeAuthState()
    }

    private fun setupUI() {
        with(binding) {
            // Configure input validation with cultural considerations
            emailInput.apply {
                addTextChangedListener(EmailValidator())
                setOnFocusChangeListener { _, hasFocus ->
                    if (!hasFocus) validateEmail()
                }
            }

            passwordInput.apply {
                addTextChangedListener(PasswordValidator())
                setOnFocusChangeListener { _, hasFocus ->
                    if (!hasFocus) validatePassword()
                }
            }

            loginButton.setOnClickListener {
                if (validateInputs()) {
                    handleLogin(
                        emailInput.text.toString(),
                        passwordInput.text.toString()
                    )
                }
            }

            biometricButton.isVisible = isBiometricEnabled
            biometricButton.setOnClickListener {
                authenticateWithBiometric()
            }

            forgotPasswordButton.setOnClickListener {
                findNavController().navigate(R.id.action_loginFragment_to_forgotPasswordFragment)
            }

            registerButton.setOnClickListener {
                findNavController().navigate(R.id.action_loginFragment_to_registerFragment)
            }
        }
    }

    private fun setupBiometricAuth() {
        lifecycleScope.launch {
            when (biometricUtils.canAuthenticateWithBiometrics(requireContext())) {
                BiometricUtils.BiometricCapability.AVAILABLE -> {
                    isBiometricEnabled = true
                    binding.biometricButton.isVisible = true
                }
                else -> {
                    isBiometricEnabled = false
                    binding.biometricButton.isVisible = false
                }
            }
        }
    }

    private fun handleLogin(email: String, password: String) {
        if (loginAttempts >= maxLoginAttempts) {
            showTemporaryLockout()
            return
        }

        binding.loginProgress.isVisible = true
        binding.loginButton.isEnabled = false

        lifecycleScope.launch {
            try {
                // Encrypt sensitive data before transmission
                val encryptedEmail = securityUtils.encryptData(email, "login_email")
                val hashedPassword = securityUtils.hashPassword(password)

                authRepository.login(encryptedEmail, hashedPassword)
                    .collectLatest { result ->
                        result.fold(
                            onSuccess = { user ->
                                when {
                                    user.isTwoFactorEnabled -> {
                                        navigateToTwoFactor()
                                    }
                                    else -> {
                                        setupBiometricForNextLogin()
                                        navigateToDashboard()
                                    }
                                }
                            },
                            onFailure = { exception ->
                                handleLoginError(exception)
                            }
                        )
                    }
            } catch (e: Exception) {
                handleLoginError(e)
            } finally {
                binding.loginProgress.isVisible = false
                binding.loginButton.isEnabled = true
            }
        }
    }

    private fun authenticateWithBiometric() {
        biometricUtils.showBiometricPrompt(
            activity = requireActivity(),
            title = getString(R.string.biometric_login_title),
            subtitle = getString(R.string.biometric_login_subtitle),
            onSuccess = { token ->
                lifecycleScope.launch {
                    viewModel.handleBiometricLogin(token)
                }
            },
            onError = { errorCode, message, remainingAttempts ->
                handleBiometricError(errorCode, message, remainingAttempts)
            }
        )
    }

    private fun validateInputs(): Boolean {
        var isValid = true

        if (!validateEmail()) {
            isValid = false
            binding.emailLayout.error = getString(R.string.invalid_email)
        }

        if (!validatePassword()) {
            isValid = false
            binding.passwordLayout.error = getString(R.string.invalid_password)
        }

        return isValid
    }

    private fun validateEmail(): Boolean {
        val email = binding.emailInput.text.toString()
        return email.matches(Regex("[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}"))
    }

    private fun validatePassword(): Boolean {
        return securityUtils.validatePassword(binding.passwordInput.text.toString())
    }

    private fun handleLoginError(error: Throwable) {
        loginAttempts++
        val remainingAttempts = maxLoginAttempts - loginAttempts

        val errorMessage = when {
            error is AuthRepository.AuthException -> error.message
            remainingAttempts > 0 -> getString(
                R.string.login_attempts_remaining,
                remainingAttempts
            )
            else -> getString(R.string.account_locked)
        }

        Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()

        if (remainingAttempts <= 0) {
            showTemporaryLockout()
        }
    }

    private fun handleBiometricError(errorCode: Int, message: String, remainingAttempts: Int) {
        val errorMessage = when (errorCode) {
            BiometricUtils.BiometricPrompt.ERROR_LOCKOUT -> getString(R.string.biometric_lockout)
            BiometricUtils.BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> getString(R.string.biometric_lockout_permanent)
            else -> getString(R.string.biometric_error_template, message, remainingAttempts)
        }

        Toast.makeText(context, errorMessage, Toast.LENGTH_LONG).show()
    }

    private fun showTemporaryLockout() {
        binding.loginButton.isEnabled = false
        binding.biometricButton.isEnabled = false
        
        // Show lockout countdown
        viewModel.startLockoutTimer()
    }

    private fun observeAuthState() {
        viewLifecycleOwner.lifecycleScope.launch {
            authRepository.authState.collectLatest { state ->
                when (state) {
                    is AuthRepository.AuthState.Authenticated -> {
                        navigateToDashboard()
                    }
                    is AuthRepository.AuthState.RequiresTwoFactor -> {
                        navigateToTwoFactor()
                    }
                    is AuthRepository.AuthState.Error -> {
                        handleLoginError(Exception(state.message))
                    }
                    else -> {
                        // Handle other states
                    }
                }
            }
        }
    }

    private fun setupBiometricForNextLogin() {
        if (isBiometricEnabled) {
            lifecycleScope.launch {
                try {
                    val token = securityUtils.generateSecureToken(32)
                    securityUtils.encryptData(token, "biometric_token")
                    // Store encrypted token for next biometric login
                } catch (e: Exception) {
                    // Handle biometric setup error
                }
            }
        }
    }

    private fun navigateToDashboard() {
        findNavController().navigate(R.id.action_loginFragment_to_dashboardFragment)
    }

    private fun navigateToTwoFactor() {
        findNavController().navigate(R.id.action_loginFragment_to_twoFactorFragment)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val LOCKOUT_DURATION_MINUTES = 30
        
        fun newInstance() = LoginFragment()
    }
}