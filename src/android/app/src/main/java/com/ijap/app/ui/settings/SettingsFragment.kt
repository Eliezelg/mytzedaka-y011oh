package com.ijap.app.ui.settings

import android.os.Bundle
import android.view.ViewGroup
import androidx.fragment.app.commit
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.PreferenceScreen
import com.google.android.material.transition.MaterialFadeThrough
import com.ijap.app.R
import com.ijap.app.ui.settings.LanguageSettingFragment
import com.ijap.app.ui.settings.NotificationSettingFragment
import com.ijap.app.utils.Constants
import com.ijap.app.utils.LocaleUtils
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Main settings fragment that serves as the container for all application settings
 * with enhanced support for RTL layouts and cultural sensitivity.
 *
 * @version 1.0.0
 */
@AndroidEntryPoint
class SettingsFragment : PreferenceFragmentCompat() {

    private companion object {
        private const val TAG = "SettingsFragment"
        private const val FRAGMENT_TAG_LANGUAGE = "language_settings"
        private const val FRAGMENT_TAG_NOTIFICATIONS = "notification_settings"
        private const val ANIMATION_DURATION = 300L
    }

    private lateinit var languagePreference: Preference
    private lateinit var notificationPreference: Preference
    private lateinit var themePreference: Preference
    private lateinit var preferenceScreen: PreferenceScreen

    @Inject
    lateinit var preferenceCache: PreferenceCache

    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        // Set preferences from XML with RTL support
        setPreferencesFromResource(R.xml.preferences_main, rootKey)
        
        // Initialize preferences with cultural sensitivity
        initializePreferences()
        
        // Setup preference navigation with RTL-aware transitions
        setupPreferenceNavigation()
        
        // Apply RTL layout if needed
        applyRTLLayoutIfNeeded()
    }

    private fun initializePreferences() {
        preferenceScreen = preferenceManager.createPreferenceScreen(requireContext())

        // Language preference with cultural sensitivity
        languagePreference = findPreference<Preference>(Constants.PREF_LANGUAGE)?.apply {
            icon = requireContext().getDrawable(R.drawable.ic_language)
            isIconSpaceReserved = true
            summary = LocaleUtils.getCurrentLocale(requireContext()).displayName
        } ?: throw IllegalStateException("Language preference not found")

        // Notification preference
        notificationPreference = findPreference<Preference>(Constants.PREF_NOTIFICATIONS)?.apply {
            icon = requireContext().getDrawable(R.drawable.ic_notifications)
            isIconSpaceReserved = true
        } ?: throw IllegalStateException("Notification preference not found")

        // Theme preference with cultural considerations
        themePreference = findPreference<Preference>(Constants.PREF_THEME)?.apply {
            icon = requireContext().getDrawable(R.drawable.ic_theme)
            isIconSpaceReserved = true
        } ?: throw IllegalStateException("Theme preference not found")
    }

    private fun setupPreferenceNavigation() {
        languagePreference.setOnPreferenceClickListener {
            navigateToLanguageSettings()
            true
        }

        notificationPreference.setOnPreferenceClickListener {
            navigateToNotificationSettings()
            true
        }
    }

    private fun navigateToLanguageSettings() {
        val languageFragment = LanguageSettingFragment.newInstance()
        
        // Setup RTL-aware transitions
        languageFragment.apply {
            enterTransition = MaterialFadeThrough().apply {
                duration = ANIMATION_DURATION
            }
            exitTransition = MaterialFadeThrough().apply {
                duration = ANIMATION_DURATION
            }
        }

        // Perform fragment transaction with RTL consideration
        parentFragmentManager.commit {
            setCustomAnimations(
                if (LocaleUtils.isRTL(requireContext())) R.anim.slide_in_right else R.anim.slide_in_left,
                if (LocaleUtils.isRTL(requireContext())) R.anim.slide_out_left else R.anim.slide_out_right
            )
            replace(R.id.settings_container, languageFragment, FRAGMENT_TAG_LANGUAGE)
            addToBackStack(FRAGMENT_TAG_LANGUAGE)
        }
    }

    private fun navigateToNotificationSettings() {
        val notificationFragment = NotificationSettingFragment.newInstance()
        
        // Setup material transitions
        notificationFragment.apply {
            enterTransition = MaterialFadeThrough().apply {
                duration = ANIMATION_DURATION
            }
            exitTransition = MaterialFadeThrough().apply {
                duration = ANIMATION_DURATION
            }
        }

        // Perform fragment transaction
        parentFragmentManager.commit {
            setCustomAnimations(
                if (LocaleUtils.isRTL(requireContext())) R.anim.slide_in_right else R.anim.slide_in_left,
                if (LocaleUtils.isRTL(requireContext())) R.anim.slide_out_left else R.anim.slide_out_right
            )
            replace(R.id.settings_container, notificationFragment, FRAGMENT_TAG_NOTIFICATIONS)
            addToBackStack(FRAGMENT_TAG_NOTIFICATIONS)
        }
    }

    private fun applyRTLLayoutIfNeeded() {
        if (LocaleUtils.isRTL(requireContext())) {
            view?.layoutDirection = ViewGroup.LAYOUT_DIRECTION_RTL
            preferenceScreen.layoutDirection = ViewGroup.LAYOUT_DIRECTION_RTL
        }
    }

    override fun onResume() {
        super.onResume()
        // Update preference summaries with current values
        updatePreferenceSummaries()
    }

    private fun updatePreferenceSummaries() {
        languagePreference.summary = LocaleUtils.getCurrentLocale(requireContext()).displayName
        
        // Update other preference summaries as needed
        notificationPreference.summary = if (NotificationSettingFragment.checkNotificationPermissions(requireContext())) {
            getString(R.string.notifications_enabled)
        } else {
            getString(R.string.notifications_disabled)
        }
    }

    companion object {
        fun newInstance() = SettingsFragment()
    }
}