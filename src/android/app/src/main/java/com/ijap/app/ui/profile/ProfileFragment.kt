package com.ijap.app.ui.profile

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.ijap.app.databinding.FragmentProfileBinding
import com.ijap.app.ui.common.ViewUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Fragment responsible for displaying and managing user profile information.
 * Implements secure data handling, accessibility features, and offline support.
 * Version: 1.0.0
 */
@AndroidEntryPoint
class ProfileFragment : Fragment() {

    private var _binding: FragmentProfileBinding? = null
    private val binding get() = _binding!!

    private val viewModel: ProfileViewModel by viewModels()
    
    private var isSecureFieldsVisible = false
    private var isOffline = false

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentProfileBinding.inflate(inflater, container, false)
        setupAccessibility()
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupUserInterface()
        setupDataCollectors()
        setupErrorHandling()
        setupOfflineSupport()
    }

    private fun setupUserInterface() {
        with(binding) {
            // Configure secure field toggles
            toggleSecureFieldsButton.setOnClickListener {
                toggleSecureFieldVisibility()
            }

            // Setup language selection
            languageSelector.setOnItemSelectedListener { position ->
                val language = when(position) {
                    0 -> "en"
                    1 -> "he"
                    2 -> "fr"
                    else -> "en"
                }
                lifecycleScope.launch {
                    viewModel.updateLanguagePreference(language)
                }
                updateLayoutDirection(language)
            }

            // Setup currency selection
            currencySelector.setOnItemSelectedListener { position ->
                val currency = when(position) {
                    0 -> "USD"
                    1 -> "ILS"
                    2 -> "EUR"
                    else -> "USD"
                }
                lifecycleScope.launch {
                    viewModel.updateCurrencyPreference(currency)
                }
            }

            // Setup notification toggle
            notificationSwitch.setOnCheckedChangeListener { _, isChecked ->
                lifecycleScope.launch {
                    viewModel.updateNotificationPreference(isChecked)
                }
            }

            // Setup profile update button
            updateProfileButton.setOnClickListener {
                updateProfile()
            }
        }
    }

    private fun setupDataCollectors() {
        viewLifecycleOwner.lifecycleScope.launch {
            // Collect user profile updates
            viewModel.userProfile.collectLatest { user ->
                user?.let { 
                    updateProfileUI(it)
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Collect loading state
            viewModel.isLoading.collectLatest { isLoading ->
                binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
                binding.contentLayout.alpha = if (isLoading) 0.5f else 1.0f
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Collect offline state
            viewModel.isOffline.collectLatest { offline ->
                isOffline = offline
                handleOfflineMode(offline)
            }
        }
    }

    private fun updateProfileUI(user: User) {
        with(binding) {
            // Update profile fields with proper security masking
            emailText.text = user.email
            
            if (isSecureFieldsVisible) {
                nameText.text = "${user.firstName} ${user.lastName}"
                phoneText.text = user.phoneNumber ?: getString(R.string.no_phone_number)
            } else {
                nameText.text = "••••••"
                phoneText.text = "••••••"
            }

            // Update preference selections
            languageSelector.setSelection(when(user.preferredLanguage) {
                "he" -> 1
                "fr" -> 2
                else -> 0
            })

            currencySelector.setSelection(when(user.preferredCurrency) {
                "ILS" -> 1
                "EUR" -> 2
                else -> 0
            })

            notificationSwitch.isChecked = user.isNotificationsEnabled

            // Update accessibility labels
            ViewUtils.setAccessibilityText(
                nameText,
                getString(R.string.profile_name_accessibility, user.fullName),
                true
            )
        }
    }

    private fun toggleSecureFieldVisibility() {
        isSecureFieldsVisible = !isSecureFieldsVisible
        viewModel.userProfile.value?.let { user ->
            updateProfileUI(user)
        }
        
        // Update accessibility announcement
        val announcement = if (isSecureFieldsVisible) {
            getString(R.string.secure_fields_visible)
        } else {
            getString(R.string.secure_fields_hidden)
        }
        binding.root.announceForAccessibility(announcement)
    }

    private fun handleOfflineMode(offline: Boolean) {
        with(binding) {
            // Show offline banner
            offlineBanner.visibility = if (offline) View.VISIBLE else View.GONE
            
            // Disable network-dependent features
            updateProfileButton.isEnabled = !offline
            languageSelector.isEnabled = !offline
            currencySelector.isEnabled = !offline
            
            // Show sync button when offline
            syncButton.apply {
                visibility = if (offline) View.VISIBLE else View.GONE
                setOnClickListener {
                    lifecycleScope.launch {
                        viewModel.syncProfile()
                    }
                }
            }

            // Update accessibility
            ViewUtils.setAccessibilityText(
                offlineBanner,
                getString(R.string.offline_mode_active),
                true
            )
        }
    }

    private fun updateProfile() {
        with(binding) {
            val firstName = firstNameInput.text.toString()
            val lastName = lastNameInput.text.toString()
            val phone = phoneInput.text.toString().takeIf { it.isNotBlank() }

            lifecycleScope.launch {
                val success = viewModel.updateProfile(firstName, lastName, phone)
                if (success) {
                    ViewUtils.fadeIn(updateSuccessMessage)
                    lifecycleScope.launch {
                        kotlinx.coroutines.delay(3000)
                        ViewUtils.fadeOut(updateSuccessMessage)
                    }
                }
            }
        }
    }

    private fun setupAccessibility() {
        with(binding) {
            ViewUtils.setAccessibilityText(
                toggleSecureFieldsButton,
                getString(R.string.toggle_secure_fields_accessibility)
            )
            
            ViewUtils.setAccessibilityText(
                languageSelector,
                getString(R.string.language_selector_accessibility)
            )

            ViewUtils.setAccessibilityText(
                currencySelector,
                getString(R.string.currency_selector_accessibility)
            )

            ViewUtils.setAccessibilityText(
                notificationSwitch,
                getString(R.string.notifications_toggle_accessibility)
            )
        }
    }

    private fun updateLayoutDirection(language: String) {
        ViewUtils.setRtlLayoutDirection(binding.root, language == "he")
    }

    private fun setupErrorHandling() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.error.collectLatest { error ->
                error?.let {
                    binding.errorMessage.apply {
                        text = it
                        visibility = View.VISIBLE
                        ViewUtils.fadeIn(this)
                        announceForAccessibility(it)
                    }
                    viewModel.clearError()
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}