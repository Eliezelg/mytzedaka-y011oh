package com.ijap.app.utils

import android.content.Context
import android.os.Build
import androidx.annotation.RequiresApi
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import java.security.InvalidKeyException

/**
 * Enterprise-grade biometric authentication utility class for the IJAP Android application.
 * Provides secure biometric authentication with enhanced security features and cryptographic validation.
 * Version: 1.0.0
 */
object BiometricUtils {

    // Authentication configuration constants
    private const val BIOMETRIC_STRONG = BiometricManager.Authenticators.BIOMETRIC_STRONG
    private const val DEVICE_CREDENTIAL = BiometricManager.Authenticators.DEVICE_CREDENTIAL
    private const val MAX_RETRY_ATTEMPTS = 3
    private const val AUTHENTICATION_TIMEOUT = 30000L // 30 seconds

    /**
     * Enhanced check for biometric authentication capability with hardware validation
     * @param context Application context
     * @return BiometricCapability indicating detailed biometric status
     */
    fun canAuthenticateWithBiometrics(context: Context): BiometricCapability {
        val biometricManager = BiometricManager.from(context)
        
        return when (biometricManager.canAuthenticate(BIOMETRIC_STRONG)) {
            BiometricManager.BIOMETRIC_SUCCESS ->
                BiometricCapability.AVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NO_HARDWARE ->
                BiometricCapability.NO_HARDWARE
            BiometricManager.BIOMETRIC_ERROR_HW_UNAVAILABLE ->
                BiometricCapability.HARDWARE_UNAVAILABLE
            BiometricManager.BIOMETRIC_ERROR_NONE_ENROLLED ->
                BiometricCapability.NOT_ENROLLED
            else -> BiometricCapability.NOT_AVAILABLE
        }
    }

    /**
     * Shows enhanced biometric authentication dialog with retry mechanism and cryptographic validation
     * @param activity FragmentActivity context
     * @param title Dialog title
     * @param subtitle Dialog subtitle
     * @param onSuccess Success callback with secure token
     * @param onError Error callback with detailed error information
     */
    fun showBiometricPrompt(
        activity: FragmentActivity,
        title: String,
        subtitle: String,
        onSuccess: (String) -> Unit,
        onError: (Int, String, Int) -> Unit
    ) {
        val callback = BiometricAuthCallback(
            onSuccess = { token ->
                try {
                    SecurityUtils.validateCryptographicKey(token)
                    onSuccess(token)
                } catch (e: InvalidKeyException) {
                    onError(
                        BiometricPrompt.ERROR_VENDOR,
                        "Cryptographic validation failed",
                        0
                    )
                }
            },
            onError = onError
        )

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(title)
            .setSubtitle(subtitle)
            .setAllowedAuthenticators(BIOMETRIC_STRONG)
            .setNegativeButtonText("Cancel")
            .setConfirmationRequired(true)
            .setTimeout(AUTHENTICATION_TIMEOUT)
            .build()

        BiometricPrompt(activity, callback).authenticate(promptInfo)
    }

    /**
     * Performs secure biometric authentication with token validation and state management
     * @param activity FragmentActivity context
     * @return Flow<AuthenticationResult> Authentication result flow with token and state
     */
    @RequiresApi(Build.VERSION_CODES.P)
    fun authenticateWithBiometrics(activity: FragmentActivity): Flow<AuthenticationResult> = flow {
        when (canAuthenticateWithBiometrics(activity)) {
            BiometricCapability.AVAILABLE -> {
                var authenticationComplete = false
                
                showBiometricPrompt(
                    activity = activity,
                    title = "Secure Authentication",
                    subtitle = "Verify your identity to continue",
                    onSuccess = { token ->
                        val secureToken = SecurityUtils.generateSecureToken(32)
                        SecurityUtils.secureTokenStorage(token, secureToken)
                        emit(AuthenticationResult.Success(secureToken))
                        authenticationComplete = true
                    },
                    onError = { errorCode, message, remainingAttempts ->
                        emit(AuthenticationResult.Error(errorCode, message, remainingAttempts))
                        if (remainingAttempts == 0) {
                            authenticationComplete = true
                        }
                    }
                )

                while (!authenticationComplete) {
                    // Wait for authentication to complete
                }
            }
            else -> {
                emit(AuthenticationResult.Error(
                    BiometricPrompt.ERROR_HW_NOT_PRESENT,
                    "Biometric authentication not available",
                    0
                ))
            }
        }
    }

    /**
     * Enhanced callback class for biometric authentication with retry and token management
     */
    class BiometricAuthCallback(
        private val onSuccess: (String) -> Unit,
        private val onError: (Int, String, Int) -> Unit
    ) : BiometricPrompt.AuthenticationCallback() {

        private var retryCount = 0
        private val maxRetries = MAX_RETRY_ATTEMPTS

        override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
            super.onAuthenticationSucceeded(result)
            val token = SecurityUtils.generateSecureToken(32, true)
            onSuccess(token)
        }

        override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
            super.onAuthenticationError(errorCode, errString)
            retryCount++
            val remainingAttempts = maxRetries - retryCount
            
            when (errorCode) {
                BiometricPrompt.ERROR_LOCKOUT,
                BiometricPrompt.ERROR_LOCKOUT_PERMANENT -> {
                    onError(errorCode, errString.toString(), 0)
                }
                else -> {
                    if (remainingAttempts > 0) {
                        onError(errorCode, errString.toString(), remainingAttempts)
                    } else {
                        onError(BiometricPrompt.ERROR_LOCKOUT, "Maximum attempts exceeded", 0)
                    }
                }
            }
        }

        override fun onAuthenticationFailed() {
            super.onAuthenticationFailed()
            retryCount++
            val remainingAttempts = maxRetries - retryCount
            
            if (remainingAttempts > 0) {
                onError(
                    BiometricPrompt.ERROR_UNABLE_TO_PROCESS,
                    "Authentication failed, please try again",
                    remainingAttempts
                )
            } else {
                onError(
                    BiometricPrompt.ERROR_LOCKOUT,
                    "Maximum attempts exceeded",
                    0
                )
            }
        }
    }

    /**
     * Enum class representing various biometric capability states
     */
    enum class BiometricCapability {
        AVAILABLE,
        NO_HARDWARE,
        HARDWARE_UNAVAILABLE,
        NOT_ENROLLED,
        NOT_AVAILABLE
    }

    /**
     * Sealed class representing authentication results
     */
    sealed class AuthenticationResult {
        data class Success(val token: String) : AuthenticationResult()
        data class Error(
            val errorCode: Int,
            val message: String,
            val remainingAttempts: Int
        ) : AuthenticationResult()
    }
}