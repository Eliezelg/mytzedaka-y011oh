package com.ijap.app.utils

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import androidx.biometric.BiometricPrompt
import androidx.fragment.app.FragmentActivity
import com.google.android.gms.safetynet.SafetyNet
import java.security.KeyStore
import java.security.SecureRandom
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import java.nio.ByteBuffer
import java.security.MessageDigest
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.PBEKeySpec
import java.util.concurrent.Executor
import java.util.concurrent.Executors

/**
 * Utility class providing comprehensive security-related functions for the IJAP Android application.
 * Implements AES-256-GCM encryption, secure password handling, and biometric authentication.
 * Version: 1.0.0
 */
object SecurityUtils {
    private const val ANDROID_KEYSTORE = "AndroidKeyStore"
    private const val GCM_TAG_LENGTH = 128
    private const val PBKDF2_ITERATIONS = 10000
    private const val SALT_BYTES = 32
    private const val KEY_VERSION_LENGTH = 8
    private val executor: Executor = Executors.newSingleThreadExecutor()

    /**
     * Interface for handling biometric authentication callbacks with retry support
     */
    interface BiometricAuthCallback {
        fun onAuthSuccess()
        fun onAuthError(errorCode: Int, errorMessage: String, remainingRetries: Int)
    }

    /**
     * Encrypts sensitive data using AES-256-GCM encryption with key rotation support
     * @param data The data to encrypt
     * @param keyAlias The alias for the encryption key in KeyStore
     * @param forceKeyRotation Whether to force key rotation
     * @return Base64 encoded encrypted data with key version
     */
    fun encryptData(data: String, keyAlias: String, forceKeyRotation: Boolean = false): String {
        try {
            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)

            // Check key validity and rotate if needed
            if (forceKeyRotation || shouldRotateKey(keyAlias)) {
                generateNewKey(keyAlias)
            }

            val secretKey = getOrCreateKey(keyAlias)
            val cipher = Cipher.getInstance(Constants.ENCRYPTION_ALGORITHM)
            val iv = ByteArray(Constants.IV_LENGTH_BYTES).apply {
                SecureRandom().nextBytes(this)
            }

            cipher.init(Cipher.ENCRYPT_MODE, secretKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))
            val encrypted = cipher.doFinal(data.toByteArray())

            // Combine IV and encrypted data
            val combined = ByteBuffer.allocate(iv.size + encrypted.size)
                .put(iv)
                .put(encrypted)
                .array()

            return "${getKeyVersion(keyAlias)}:${Base64.encodeToString(combined, Base64.NO_WRAP)}"
        } catch (e: Exception) {
            throw SecurityException("Encryption failed", e)
        }
    }

    /**
     * Decrypts encrypted data using AES-256-GCM decryption with key version handling
     * @param encryptedData The encrypted data to decrypt
     * @param keyAlias The alias for the decryption key in KeyStore
     * @return Decrypted data
     */
    fun decryptData(encryptedData: String, keyAlias: String): String {
        try {
            val parts = encryptedData.split(":")
            if (parts.size != 2) throw SecurityException("Invalid encrypted data format")

            val keyVersion = parts[0]
            val combined = Base64.decode(parts[1], Base64.NO_WRAP)

            val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
            keyStore.load(null)
            val secretKey = keyStore.getKey(getKeyAliasWithVersion(keyAlias, keyVersion), null) as SecretKey

            val iv = combined.copyOfRange(0, Constants.IV_LENGTH_BYTES)
            val encrypted = combined.copyOfRange(Constants.IV_LENGTH_BYTES, combined.size)

            val cipher = Cipher.getInstance(Constants.ENCRYPTION_ALGORITHM)
            cipher.init(Cipher.DECRYPT_MODE, secretKey, GCMParameterSpec(GCM_TAG_LENGTH, iv))

            return String(cipher.doFinal(encrypted))
        } catch (e: Exception) {
            throw SecurityException("Decryption failed", e)
        }
    }

    /**
     * Creates secure hash of password using PBKDF2WithHmacSHA256
     * @param password The password to hash
     * @return Hashed password with salt and parameters
     */
    fun hashPassword(password: String): String {
        val salt = ByteArray(SALT_BYTES).apply {
            SecureRandom().nextBytes(this)
        }

        val spec = PBEKeySpec(
            password.toCharArray(),
            salt,
            PBKDF2_ITERATIONS,
            Constants.KEY_SIZE_BITS
        )

        val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
        val hash = factory.generateSecret(spec).encoded

        return "${Base64.encodeToString(salt, Base64.NO_WRAP)}:$PBKDF2_ITERATIONS:${
            Base64.encodeToString(hash, Base64.NO_WRAP)
        }"
    }

    /**
     * Validates password against comprehensive security requirements
     * @param password The password to validate
     * @return Whether password meets security requirements
     */
    fun validatePassword(password: String): Boolean {
        if (password.length !in Constants.MIN_PASSWORD_LENGTH..Constants.MAX_PASSWORD_LENGTH) {
            return false
        }

        val patterns = listOf(
            ".*[A-Z].*".toRegex(), // Uppercase
            ".*[a-z].*".toRegex(), // Lowercase
            ".*\\d.*".toRegex(),   // Digit
            ".*[!@#\$%^&*()_+\\-=\\[\\]{};':\"\\\\|,.<>/?].*".toRegex() // Special char
        )

        return patterns.all { it.matches(password) }
    }

    /**
     * Generates cryptographically secure random token
     * @param length Desired length of the token
     * @param includeSpecialChars Whether to include special characters
     * @return Random secure token
     */
    fun generateSecureToken(length: Int, includeSpecialChars: Boolean = true): String {
        val random = SecureRandom.getInstanceStrong()
        val chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789" +
                if (includeSpecialChars) "!@#$%^&*" else ""

        return (1..length)
            .map { chars[random.nextInt(chars.length)] }
            .joinToString("")
    }

    /**
     * Shows biometric authentication prompt with retry mechanism
     * @param activity The activity context
     * @param callback Callback for authentication results
     * @param maxRetries Maximum number of retry attempts
     */
    fun showBiometricPrompt(
        activity: FragmentActivity,
        callback: BiometricAuthCallback,
        maxRetries: Int = 3
    ) {
        var retryCount = 0

        val promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle("Authentication Required")
            .setSubtitle("Please verify your identity")
            .setNegativeButtonText("Cancel")
            .build()

        val biometricPrompt = BiometricPrompt(activity, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    callback.onAuthSuccess()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    retryCount++
                    callback.onAuthError(errorCode, errString.toString(), maxRetries - retryCount)
                }
            })

        biometricPrompt.authenticate(promptInfo)
    }

    // Private helper functions

    private fun shouldRotateKey(keyAlias: String): Boolean {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)
        val entry = keyStore.getEntry(keyAlias, null) as? KeyStore.SecretKeyEntry ?: return true
        // Implement key rotation logic based on creation date
        return false
    }

    private fun generateNewKey(keyAlias: String) {
        val keyGenerator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            ANDROID_KEYSTORE
        )

        val spec = KeyGenParameterSpec.Builder(
            keyAlias,
            KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
        )
            .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
            .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
            .setKeySize(Constants.KEY_SIZE_BITS)
            .setUserAuthenticationRequired(false)
            .build()

        keyGenerator.init(spec)
        keyGenerator.generateKey()
    }

    private fun getOrCreateKey(keyAlias: String): SecretKey {
        val keyStore = KeyStore.getInstance(ANDROID_KEYSTORE)
        keyStore.load(null)

        return (keyStore.getKey(keyAlias, null) as? SecretKey) ?: run {
            generateNewKey(keyAlias)
            keyStore.getKey(keyAlias, null) as SecretKey
        }
    }

    private fun getKeyVersion(keyAlias: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return Base64.encodeToString(
            digest.digest(keyAlias.toByteArray()),
            Base64.NO_WRAP
        ).substring(0, KEY_VERSION_LENGTH)
    }

    private fun getKeyAliasWithVersion(keyAlias: String, version: String): String {
        return "${keyAlias}_$version"
    }
}