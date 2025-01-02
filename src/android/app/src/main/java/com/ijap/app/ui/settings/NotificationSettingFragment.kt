package com.ijap.app.ui.settings

import android.Manifest
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import androidx.activity.result.contract.ActivityResultContracts
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.PreferenceManager
import androidx.preference.SwitchPreferenceCompat
import com.google.android.material.snackbar.Snackbar
import com.ijap.app.R
import com.ijap.app.utils.Constants.PREF_NOTIFICATIONS_ENABLED
import com.ijap.app.utils.Constants.PREF_DONATION_NOTIFICATIONS
import com.ijap.app.utils.Constants.PREF_CAMPAIGN_NOTIFICATIONS
import com.ijap.app.utils.Constants.PREF_NOTIFICATION_PERMISSION_REQUESTED
import dagger.hilt.android.AndroidEntryPoint

/**
 * Fragment responsible for managing notification preferences in the IJAP Android application.
 * Handles Android 13+ runtime notification permissions and preference state management.
 * 
 * @version 1.0.0
 */
@AndroidEntryPoint
class NotificationSettingFragment : PreferenceFragmentCompat() {

    private lateinit var mainNotificationSwitch: SwitchPreferenceCompat
    private lateinit var donationNotificationSwitch: SwitchPreferenceCompat
    private lateinit var campaignNotificationSwitch: SwitchPreferenceCompat
    private lateinit var sharedPreferences: SharedPreferences

    // Permission launcher for Android 13+ notification permission
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        handleNotificationPermissionResult(isGranted)
    }

    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        setPreferencesFromResource(R.xml.preferences_notifications, rootKey)
        sharedPreferences = PreferenceManager.getDefaultSharedPreferences(requireContext())

        // Initialize preference switches
        mainNotificationSwitch = findPreference(PREF_NOTIFICATIONS_ENABLED)!!
        donationNotificationSwitch = findPreference(PREF_DONATION_NOTIFICATIONS)!!
        campaignNotificationSwitch = findPreference(PREF_CAMPAIGN_NOTIFICATIONS)!!

        // Check for Android 13+ notification permission
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val permissionRequested = sharedPreferences.getBoolean(
                PREF_NOTIFICATION_PERMISSION_REQUESTED, 
                false
            )
            if (!permissionRequested) {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        setupPreferenceChangeListeners()
        restorePreferenceStates()
    }

    private fun setupPreferenceChangeListeners() {
        mainNotificationSwitch.setOnPreferenceChangeListener { _, newValue ->
            val enabled = newValue as Boolean
            if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                false
            } else {
                updateDependentPreferences(enabled)
                true
            }
        }

        donationNotificationSwitch.setOnPreferenceChangeListener { _, newValue ->
            val enabled = newValue as Boolean
            if (enabled && !mainNotificationSwitch.isChecked) {
                showNotificationDisabledMessage()
                false
            } else {
                true
            }
        }

        campaignNotificationSwitch.setOnPreferenceChangeListener { _, newValue ->
            val enabled = newValue as Boolean
            if (enabled && !mainNotificationSwitch.isChecked) {
                showNotificationDisabledMessage()
                false
            } else {
                true
            }
        }
    }

    private fun restorePreferenceStates() {
        val notificationsEnabled = sharedPreferences.getBoolean(PREF_NOTIFICATIONS_ENABLED, true)
        updateDependentPreferences(notificationsEnabled)
    }

    private fun updateDependentPreferences(enabled: Boolean) {
        donationNotificationSwitch.isEnabled = enabled
        campaignNotificationSwitch.isEnabled = enabled

        if (!enabled) {
            donationNotificationSwitch.isChecked = false
            campaignNotificationSwitch.isChecked = false
        }
    }

    private fun handleNotificationPermissionResult(isGranted: Boolean) {
        sharedPreferences.edit().putBoolean(PREF_NOTIFICATION_PERMISSION_REQUESTED, true).apply()

        mainNotificationSwitch.isChecked = isGranted
        updateDependentPreferences(isGranted)

        if (isGranted) {
            showPermissionGrantedMessage()
        } else {
            showPermissionDeniedMessage()
        }
    }

    private fun showNotificationDisabledMessage() {
        Snackbar.make(
            requireView(),
            R.string.notification_main_switch_disabled_message,
            Snackbar.LENGTH_LONG
        ).show()
    }

    private fun showPermissionGrantedMessage() {
        Snackbar.make(
            requireView(),
            R.string.notification_permission_granted_message,
            Snackbar.LENGTH_SHORT
        ).show()
    }

    private fun showPermissionDeniedMessage() {
        Snackbar.make(
            requireView(),
            R.string.notification_permission_denied_message,
            Snackbar.LENGTH_LONG
        ).setAction(R.string.settings) {
            // Open app settings
            startActivity(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS.apply {
                putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, requireContext().packageName)
            })
        }.show()
    }

    companion object {
        fun newInstance() = NotificationSettingFragment()
    }
}