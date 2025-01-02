package com.ijap.app.ui.auth

import android.os.Bundle
import android.text.Editable
import android.text.TextWatcher
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
import com.ijap.app.databinding.FragmentRegisterBinding
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.BiometricUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.regex.Pattern
import javax.inject.Inject

/**
 * Fragment handling user registration with comprehensive security validation,
 * cultural support, and RTL layout handling.
 */
@AndroidEntryPoint
class RegisterFragment : Fragment() {

    private var _binding: FragmentRegisterBinding? = null
    private val binding get() = _binding!!

    @Inject
    lateinit var securityUtils: SecurityUtils

    private val viewModel: AuthViewModel by viewModels()

    // Email validation pattern with Unicode support for Hebrew domains
    private val EMAIL_PATTERN = Pattern.compile(
        "[a-zA-Z0-9+._%\\-]{1,256}" +
        "@" +
        "[a-zA-Z0-9][a-zA-Z0-9\\-]{0,64}" +
        "(" +
        "\\." +
        "[a-zA-Z0-9][a-zA-Z0-9\\-]{0,25}" +
        ")+"
    )

    // Hebrew name pattern allowing Hebrew characters and spaces
    private val HEBREW_NAME_PATTERN = Pattern.compile("^[\\u0590-\\u05FF\\s]{1,50}$")

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRegisterBinding.inflate(inflater, container, false)
        return binding.root.apply {
            // Enable RTL layout support
            layoutDirection = View.LAYOUT_DIRECTION_LOCALE
        }
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupFormValidation()
        setupSubmitButton()
        observeRegistrationState()
        setupDeviceSecurity()
    }

    private fun setupFormValidation() {
        // Email validation
        binding.emailInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                validateEmail(s.toString())
            }
        })

        // Password validation with security requirements
        binding.passwordInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                validatePassword(s.toString())
            }
        })

        // Name validation with Hebrew support
        binding.firstNameInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                validateName(s.toString(), binding.firstNameLayout, true)
            }
        })

        binding.lastNameInput.addTextChangedListener(object : TextWatcher {
            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
            override fun afterTextChanged(s: Editable?) {
                validateName(s.toString(), binding.lastNameLayout, false)
            }
        })
    }

    private fun validateEmail(email: String) {
        binding.emailLayout.error = when {
            email.isEmpty() -> getString(R.string.error_email_required)
            !EMAIL_PATTERN.matcher(email).matches() -> getString(R.string.error_invalid_email)
            else -> null
        }
        updateSubmitButtonState()
    }

    private fun validatePassword(password: String) {
        binding.passwordLayout.error = when {
            password.isEmpty() -> getString(R.string.error_password_required)
            !securityUtils.validatePassword(password) -> getString(R.string.error_password_requirements)
            else -> null
        }
        updateSubmitButtonState()
    }

    private fun validateName(name: String, layout: TextInputLayout, isFirstName: Boolean) {
        layout.error = when {
            name.isEmpty() -> getString(
                if (isFirstName) R.string.error_first_name_required 
                else R.string.error_last_name_required
            )
            !isValidName(name) -> getString(R.string.error_invalid_name)
            else -> null
        }
        updateSubmitButtonState()
    }

    private fun isValidName(name: String): Boolean {
        return name.isNotEmpty() && (
            name.matches(Regex("^[a-zA-Z\\s]{1,50}$")) || 
            HEBREW_NAME_PATTERN.matcher(name).matches()
        )
    }

    private fun setupSubmitButton() {
        binding.registerButton.setOnClickListener {
            if (validateForm()) {
                handleRegistration()
            }
        }
    }

    private fun updateSubmitButtonState() {
        binding.registerButton.isEnabled = validateForm()
    }

    private fun validateForm(): Boolean {
        return binding.emailLayout.error == null &&
                binding.passwordLayout.error == null &&
                binding.firstNameLayout.error == null &&
                binding.lastNameLayout.error == null &&
                binding.emailInput.text?.isNotEmpty() == true &&
                binding.passwordInput.text?.isNotEmpty() == true &&
                binding.firstNameInput.text?.isNotEmpty() == true &&
                binding.lastNameInput.text?.isNotEmpty() == true
    }

    private fun setupDeviceSecurity() {
        lifecycleScope.launch {
            if (!securityUtils.checkDeviceSecurity()) {
                showSecurityWarning()
            }
        }
    }

    private fun handleRegistration() {
        binding.progressBar.isVisible = true
        binding.registerButton.isEnabled = false

        val email = binding.emailInput.text.toString()
        val password = binding.passwordInput.text.toString()
        val firstName = binding.firstNameInput.text.toString()
        val lastName = binding.lastNameInput.text.toString()

        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.register(
                email = securityUtils.sanitizeUserInput(email),
                password = password,
                firstName = securityUtils.sanitizeUserInput(firstName),
                lastName = securityUtils.sanitizeUserInput(lastName)
            )
        }
    }

    private fun observeRegistrationState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.registrationState.collectLatest { state ->
                binding.progressBar.isVisible = false
                when (state) {
                    is AuthRepository.AuthState.Success -> {
                        findNavController().navigate(
                            RegisterFragmentDirections.actionRegisterToVerification()
                        )
                    }
                    is AuthRepository.AuthState.Error -> {
                        binding.registerButton.isEnabled = true
                        showError(state.message)
                    }
                    else -> {
                        binding.registerButton.isEnabled = true
                    }
                }
            }
        }
    }

    private fun showSecurityWarning() {
        Toast.makeText(
            requireContext(),
            getString(R.string.warning_device_security),
            Toast.LENGTH_LONG
        ).show()
    }

    private fun showError(message: String) {
        Toast.makeText(requireContext(), message, Toast.LENGTH_LONG).show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        fun newInstance() = RegisterFragment()
    }
}