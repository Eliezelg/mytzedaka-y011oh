package com.ijap.app.ui.profile

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputLayout
import com.ijap.app.databinding.FragmentProfileEditBinding
import com.ijap.app.ui.common.ViewUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.util.regex.Pattern

/**
 * Fragment for editing user profile information with enhanced security,
 * accessibility support, and cultural considerations for Jewish users.
 * Implements WCAG 2.1 Level AA compliance and RTL layout support.
 *
 * @since 1.0.0
 */
@AndroidEntryPoint
class ProfileEditFragment : Fragment() {

    private var _binding: FragmentProfileEditBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ProfileViewModel by viewModels()
    
    private var isOfflineMode = false
    private var isSyncing = false
    private val validationState = mutableMapOf<String, Boolean>()

    // Hebrew name validation pattern
    private val hebrewNamePattern = Pattern.compile("^[\\u0590-\\u05FF\\s]+$")
    
    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileEditBinding.inflate(inflater, container, false)
        binding.lifecycleOwner = viewLifecycleOwner
        binding.viewModel = viewModel

        // Setup RTL support for Hebrew
        setupRtlSupport()
        
        // Initialize accessibility features
        setupAccessibility()

        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        setupValidation()
        setupSaveButton()
        observeViewModelState()
        setupOfflineSupport()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private fun setupRtlSupport() {
        context?.let { ctx ->
            ViewUtils.setRtlLayoutDirection(binding.root, viewModel.userProfile.value?.preferredLanguage == "he")
            
            // Apply RTL-aware margins and paddings
            listOf(
                binding.firstNameInput,
                binding.lastNameInput,
                binding.phoneNumberInput
            ).forEach { input ->
                input.layoutDirection = View.LAYOUT_DIRECTION_LOCALE
                input.textDirection = View.TEXT_DIRECTION_LOCALE
            }
        }
    }

    private fun setupValidation() {
        // First Name validation
        binding.firstNameInput.editText?.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                validateFirstName()
            }
        }

        // Last Name validation
        binding.lastNameInput.editText?.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                validateLastName()
            }
        }

        // Phone Number validation
        binding.phoneNumberInput.editText?.setOnFocusChangeListener { _, hasFocus ->
            if (!hasFocus) {
                validatePhoneNumber()
            }
        }
    }

    private fun validateFirstName(): Boolean {
        val firstName = binding.firstNameInput.editText?.text.toString()
        val isValid = when {
            firstName.isBlank() -> {
                showFieldError(binding.firstNameInput, "First name is required")
                false
            }
            firstName.length > 50 -> {
                showFieldError(binding.firstNameInput, "First name is too long")
                false
            }
            viewModel.userProfile.value?.preferredLanguage == "he" && !hebrewNamePattern.matcher(firstName).matches() -> {
                showFieldError(binding.firstNameInput, "Please enter a valid Hebrew name")
                false
            }
            else -> {
                binding.firstNameInput.error = null
                true
            }
        }
        validationState["firstName"] = isValid
        return isValid
    }

    private fun validateLastName(): Boolean {
        val lastName = binding.lastNameInput.editText?.text.toString()
        val isValid = when {
            lastName.isBlank() -> {
                showFieldError(binding.lastNameInput, "Last name is required")
                false
            }
            lastName.length > 50 -> {
                showFieldError(binding.lastNameInput, "Last name is too long")
                false
            }
            viewModel.userProfile.value?.preferredLanguage == "he" && !hebrewNamePattern.matcher(lastName).matches() -> {
                showFieldError(binding.lastNameInput, "Please enter a valid Hebrew name")
                false
            }
            else -> {
                binding.lastNameInput.error = null
                true
            }
        }
        validationState["lastName"] = isValid
        return isValid
    }

    private fun validatePhoneNumber(): Boolean {
        val phoneNumber = binding.phoneNumberInput.editText?.text.toString()
        val isValid = when {
            phoneNumber.isNotBlank() && !isValidPhoneNumber(phoneNumber) -> {
                showFieldError(binding.phoneNumberInput, "Please enter a valid phone number")
                false
            }
            else -> {
                binding.phoneNumberInput.error = null
                true
            }
        }
        validationState["phoneNumber"] = isValid
        return isValid
    }

    private fun setupSaveButton() {
        binding.saveButton.setOnClickListener {
            if (validateAllFields()) {
                lifecycleScope.launch {
                    saveProfile()
                }
            }
        }
    }

    private fun observeViewModelState() {
        viewLifecycleOwner.lifecycleScope.launch {
            // Observe offline mode
            viewModel.isOffline.collectLatest { offline ->
                isOfflineMode = offline
                handleOfflineMode(offline)
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe sync state
            viewModel.isSyncing.collectLatest { syncing ->
                isSyncing = syncing
                binding.syncProgressIndicator.visibility = if (syncing) View.VISIBLE else View.GONE
            }
        }
    }

    private suspend fun saveProfile() {
        binding.saveButton.isEnabled = false
        binding.progressBar.visibility = View.VISIBLE

        try {
            val success = viewModel.updateProfile(
                firstName = binding.firstNameInput.editText?.text.toString(),
                lastName = binding.lastNameInput.editText?.text.toString(),
                phoneNumber = binding.phoneNumberInput.editText?.text.toString().takeIf { it.isNotBlank() }
            )

            if (success) {
                if (!isOfflineMode) {
                    // Navigate back on success if online
                    requireActivity().onBackPressed()
                } else {
                    // Show offline save confirmation
                    showOfflineSaveConfirmation()
                }
            }
        } finally {
            binding.saveButton.isEnabled = true
            binding.progressBar.visibility = View.GONE
        }
    }

    private fun setupAccessibility() {
        // Set content descriptions
        ViewUtils.setAccessibilityText(
            binding.firstNameInput,
            "Enter your first name",
            true
        )
        ViewUtils.setAccessibilityText(
            binding.lastNameInput,
            "Enter your last name",
            true
        )
        ViewUtils.setAccessibilityText(
            binding.phoneNumberInput,
            "Enter your phone number (optional)",
            true
        )

        // Set traversal order
        binding.firstNameInput.accessibilityTraversalBefore = binding.lastNameInput.id
        binding.lastNameInput.accessibilityTraversalBefore = binding.phoneNumberInput.id
        binding.phoneNumberInput.accessibilityTraversalBefore = binding.saveButton.id
    }

    private fun handleOfflineMode(offline: Boolean) {
        binding.offlineIndicator.visibility = if (offline) View.VISIBLE else View.GONE
        
        // Update save button text
        binding.saveButton.text = if (offline) {
            "Save (Offline)"
        } else {
            "Save"
        }

        // Show offline mode message
        if (offline) {
            binding.offlineMessage.visibility = View.VISIBLE
            ViewUtils.setAccessibilityText(
                binding.offlineMessage,
                "You are currently offline. Changes will be saved locally and synced when online.",
                true
            )
        } else {
            binding.offlineMessage.visibility = View.GONE
        }
    }

    private fun showFieldError(input: TextInputLayout, error: String) {
        input.error = error
        ViewUtils.setAccessibilityText(input, "$error. Please correct this field.", true)
    }

    private fun validateAllFields(): Boolean {
        return validateFirstName() && 
               validateLastName() && 
               validatePhoneNumber()
    }

    private fun showOfflineSaveConfirmation() {
        binding.offlineSaveMessage.visibility = View.VISIBLE
        ViewUtils.setAccessibilityText(
            binding.offlineSaveMessage,
            "Changes saved offline. Will sync when connection is restored.",
            true
        )
    }

    private fun isValidPhoneNumber(phone: String): Boolean {
        // Implement phone number validation based on country format
        val phonePattern = Pattern.compile("^\\+?[1-9]\\d{1,14}$")
        return phonePattern.matcher(phone).matches()
    }

    companion object {
        private const val TAG = "ProfileEditFragment"
    }
}