package com.ijap.app.ui.auth

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.SavedStateHandle
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import com.ijap.app.R
import com.ijap.app.databinding.ActivityAuthBinding
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.BiometricUtils
import com.ijap.app.utils.Constants
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

/**
 * Activity managing authentication flow with enhanced security validation,
 * biometric authentication, accessibility support, and state preservation.
 * Supports RTL layouts and multiple languages.
 */
@AndroidEntryPoint
class AuthActivity : AppCompatActivity() {

    private lateinit var binding: ActivityAuthBinding
    private lateinit var navController: NavController
    private lateinit var savedStateHandle: SavedStateHandle

    @Inject
    lateinit var securityUtils: SecurityUtils

    @Inject
    lateinit var biometricUtils: BiometricUtils

    companion object {
        private const val KEY_AUTH_STATE = "auth_state"
        private const val KEY_NAVIGATION_STATE = "navigation_state"
        private const val SECURITY_CHECK_DELAY = 1000L
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Initialize view binding
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Configure RTL support based on locale
        binding.root.layoutDirection = View.LAYOUT_DIRECTION_LOCALE

        // Set up navigation
        setupNavigation()

        // Validate device security
        validateDeviceSecurity()

        // Configure accessibility
        setupAccessibility()

        // Restore saved state
        savedInstanceState?.let { restoreState(it) }

        // Handle deep links
        handleDeepLink(intent)
    }

    private fun setupNavigation() {
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHostFragment.navController

        // Configure navigation graph
        navController.setGraph(R.navigation.auth_navigation)

        // Set up navigation listeners
        navController.addOnDestinationChangedListener { _, destination, _ ->
            updateAccessibilityAnnouncement(destination.label.toString())
        }
    }

    private fun validateDeviceSecurity() {
        if (!securityUtils.validateDeviceSecurity()) {
            showSecurityWarning()
            return
        }

        // Periodic security validation
        binding.root.postDelayed({
            validateDeviceSecurity()
        }, SECURITY_CHECK_DELAY)
    }

    private fun setupAccessibility() {
        binding.root.apply {
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
            contentDescription = getString(R.string.auth_screen_description)
        }
    }

    private fun showSecurityWarning() {
        // Show security warning dialog with accessibility support
        // Implementation would go here
    }

    private fun updateAccessibilityAnnouncement(screenName: String) {
        binding.root.announceForAccessibility(
            getString(R.string.screen_changed_announcement, screenName)
        )
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.apply {
            putString(KEY_AUTH_STATE, navController.currentDestination?.id.toString())
            putBundle(KEY_NAVIGATION_STATE, navController.saveState())
        }
    }

    private fun restoreState(savedState: Bundle) {
        navController.restoreState(savedState.getBundle(KEY_NAVIGATION_STATE))
        savedState.getString(KEY_AUTH_STATE)?.let { destinationId ->
            navigateToSavedDestination(destinationId)
        }
    }

    fun navigateToLogin() {
        // Validate security before navigation
        if (!securityUtils.validateDeviceSecurity()) {
            showSecurityWarning()
            return
        }

        // Check biometric capability
        when (biometricUtils.canAuthenticateWithBiometrics(this)) {
            BiometricUtils.BiometricCapability.AVAILABLE -> {
                setupBiometricAuth()
            }
            else -> {
                proceedToLogin()
            }
        }
    }

    private fun setupBiometricAuth() {
        biometricUtils.showBiometricPrompt(
            activity = this,
            title = getString(R.string.biometric_prompt_title),
            subtitle = getString(R.string.biometric_prompt_subtitle),
            onSuccess = { token ->
                handleBiometricSuccess(token)
            },
            onError = { errorCode, message, remainingAttempts ->
                handleBiometricError(errorCode, message, remainingAttempts)
            }
        )
    }

    private fun proceedToLogin() {
        navController.navigate(R.id.action_global_to_login) {
            popUpTo(R.id.auth_navigation) {
                inclusive = true
            }
        }
    }

    fun navigateToRegister() {
        navController.navigate(R.id.action_global_to_register)
    }

    fun navigateToTwoFactor() {
        // Validate security state
        if (!securityUtils.validateDeviceSecurity()) {
            showSecurityWarning()
            return
        }

        navController.navigate(R.id.action_global_to_two_factor)
    }

    private fun handleBiometricSuccess(token: String) {
        // Handle successful biometric authentication
        // Implementation would go here
    }

    private fun handleBiometricError(errorCode: Int, message: String, remainingAttempts: Int) {
        // Handle biometric authentication error
        // Implementation would go here
    }

    private fun navigateToSavedDestination(destinationId: String) {
        try {
            navController.navigate(destinationId.toInt())
        } catch (e: Exception) {
            // Handle navigation error
            navigateToLogin()
        }
    }

    private fun handleDeepLink(intent: android.content.Intent) {
        navController.handleDeepLink(intent)
    }
}