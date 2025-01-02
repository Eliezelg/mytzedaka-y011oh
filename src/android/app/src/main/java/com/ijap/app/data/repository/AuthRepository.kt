package com.ijap.app.data.repository

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import com.ijap.app.data.api.ApiService
import com.ijap.app.data.models.User
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.BiometricUtils
import com.ijap.app.utils.Constants
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.android.scopes.ViewModelScoped
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Repository implementing comprehensive authentication operations with secure token management,
 * biometric integration, and compliance features.
 * Version: 1.0.0
 */
@Singleton
class AuthRepository @Inject constructor(
    private val apiService: ApiService,
    private val dataStore: DataStore<Preferences>,
    private val securityUtils: SecurityUtils,
    private val biometricUtils: BiometricUtils,
    @ApplicationContext private val context: Context
) {
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())
    
    // DataStore keys
    private object PreferencesKeys {
        val ACCESS_TOKEN = stringPreferencesKey("access_token")
        val REFRESH_TOKEN = stringPreferencesKey("refresh_token")
        val USER_ID = stringPreferencesKey("user_id")
        val BIOMETRIC_KEY = stringPreferencesKey("biometric_key")
    }

    // Authentication state management
    private val _authState = MutableStateFlow<AuthState>(AuthState.Initial)
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    init {
        // Initialize token refresh mechanism
        setupTokenRefresh()
        // Validate device security state
        validateDeviceSecurity()
    }

    /**
     * Authenticates user with comprehensive security validation and 2FA support
     * @param email User's email address
     * @param password User's password
     * @return Flow<Result<User>> Authentication result with user data
     */
    suspend fun login(email: String, password: String): Flow<Result<User>> = flow {
        try {
            // Input validation
            require(email.isNotEmpty() && password.isNotEmpty()) {
                "Email and password cannot be empty"
            }

            // Sanitize input
            val sanitizedEmail = securityUtils.sanitizeUserInput(email)
            
            // Hash password for transmission
            val hashedPassword = securityUtils.hashPassword(password)

            // Attempt login
            val response = apiService.login(sanitizedEmail, hashedPassword)
                .onErrorResumeNext { throwable ->
                    throw AuthException("Login failed", throwable)
                }
                .toFlowable()
                .firstOrError()
                .blockingGet()

            // Handle 2FA if enabled
            if (response.user.isTwoFactorEnabled) {
                _authState.value = AuthState.RequiresTwoFactor(response.twoFactorToken)
                emit(Result.success(response.user))
                return@flow
            }

            // Store encrypted tokens
            storeAuthTokens(
                accessToken = response.accessToken,
                refreshToken = response.refreshToken
            )

            // Setup biometric authentication if available
            setupBiometricAuth(response.user.id)

            // Update auth state
            _authState.value = AuthState.Authenticated(response.user)
            
            emit(Result.success(response.user))
        } catch (e: Exception) {
            emit(Result.failure(e))
            _authState.value = AuthState.Error(e.message ?: "Authentication failed")
        }
    }

    /**
     * Verifies two-factor authentication code
     * @param code Two-factor authentication code
     * @param token Two-factor session token
     * @return Flow<Result<User>> Verification result
     */
    suspend fun verifyTwoFactor(code: String, token: String): Flow<Result<User>> = flow {
        try {
            val response = apiService.verifyTwoFactor(code, token)
                .onErrorResumeNext { throwable ->
                    throw AuthException("2FA verification failed", throwable)
                }
                .toFlowable()
                .firstOrError()
                .blockingGet()

            // Store encrypted tokens
            storeAuthTokens(
                accessToken = response.accessToken,
                refreshToken = response.refreshToken
            )

            // Update auth state
            _authState.value = AuthState.Authenticated(response.user)
            
            emit(Result.success(response.user))
        } catch (e: Exception) {
            emit(Result.failure(e))
            _authState.value = AuthState.Error("2FA verification failed")
        }
    }

    /**
     * Registers new user with security validation
     * @param email User's email
     * @param password User's password
     * @param firstName User's first name
     * @param lastName User's last name
     * @return Flow<Result<User>> Registration result
     */
    suspend fun register(
        email: String,
        password: String,
        firstName: String,
        lastName: String
    ): Flow<Result<User>> = flow {
        try {
            // Validate password strength
            require(securityUtils.validatePassword(password)) {
                "Password does not meet security requirements"
            }

            // Sanitize inputs
            val sanitizedInputs = mapOf(
                "email" to securityUtils.sanitizeUserInput(email),
                "firstName" to securityUtils.sanitizeUserInput(firstName),
                "lastName" to securityUtils.sanitizeUserInput(lastName)
            )

            val response = apiService.register(
                email = sanitizedInputs["email"] ?: "",
                password = securityUtils.hashPassword(password),
                firstName = sanitizedInputs["firstName"] ?: "",
                lastName = sanitizedInputs["lastName"] ?: ""
            ).toFlowable().firstOrError().blockingGet()

            emit(Result.success(response))
        } catch (e: Exception) {
            emit(Result.failure(e))
            _authState.value = AuthState.Error("Registration failed")
        }
    }

    /**
     * Logs out user and cleans up security state
     */
    suspend fun logout() {
        try {
            // Clear stored tokens
            dataStore.edit { preferences ->
                preferences.remove(PreferencesKeys.ACCESS_TOKEN)
                preferences.remove(PreferencesKeys.REFRESH_TOKEN)
                preferences.remove(PreferencesKeys.USER_ID)
                preferences.remove(PreferencesKeys.BIOMETRIC_KEY)
            }

            // Clear biometric data
            clearBiometricData()

            // Update auth state
            _authState.value = AuthState.NotAuthenticated
        } catch (e: Exception) {
            _authState.value = AuthState.Error("Logout failed")
        }
    }

    /**
     * Refreshes authentication token with security validation
     * @return Boolean indicating success
     */
    private suspend fun refreshToken(): Boolean {
        return try {
            val currentRefreshToken = getStoredRefreshToken()
            
            val response = apiService.refreshToken(currentRefreshToken)
                .toFlowable()
                .firstOrError()
                .blockingGet()

            storeAuthTokens(
                accessToken = response.accessToken,
                refreshToken = response.refreshToken
            )

            true
        } catch (e: Exception) {
            _authState.value = AuthState.Error("Token refresh failed")
            false
        }
    }

    /**
     * Stores authentication tokens securely
     */
    private suspend fun storeAuthTokens(accessToken: String, refreshToken: String) {
        dataStore.edit { preferences ->
            preferences[PreferencesKeys.ACCESS_TOKEN] = securityUtils.encryptData(
                accessToken,
                "access_token_key"
            )
            preferences[PreferencesKeys.REFRESH_TOKEN] = securityUtils.encryptData(
                refreshToken,
                "refresh_token_key"
            )
        }
    }

    /**
     * Sets up automatic token refresh mechanism
     */
    private fun setupTokenRefresh() {
        scope.launch {
            while (true) {
                delay(TimeUnit.MINUTES.toMillis(14)) // Refresh before 15-minute expiry
                if (authState.value is AuthState.Authenticated) {
                    refreshToken()
                }
            }
        }
    }

    /**
     * Validates device security state
     */
    private fun validateDeviceSecurity() {
        if (!securityUtils.validateDeviceSecurity()) {
            _authState.value = AuthState.Error("Device security requirements not met")
        }
    }

    /**
     * Sets up biometric authentication if available
     */
    private suspend fun setupBiometricAuth(userId: String) {
        if (biometricUtils.canAuthenticateWithBiometrics(context) == 
            BiometricUtils.BiometricCapability.AVAILABLE) {
            val biometricKey = securityUtils.generateSecureToken(32)
            dataStore.edit { preferences ->
                preferences[PreferencesKeys.BIOMETRIC_KEY] = securityUtils.encryptData(
                    biometricKey,
                    "biometric_key"
                )
                preferences[PreferencesKeys.USER_ID] = userId
            }
        }
    }

    /**
     * Clears biometric authentication data
     */
    private suspend fun clearBiometricData() {
        dataStore.edit { preferences ->
            preferences.remove(PreferencesKeys.BIOMETRIC_KEY)
        }
    }

    /**
     * Retrieves stored refresh token
     */
    private suspend fun getStoredRefreshToken(): String {
        return dataStore.data.first()[PreferencesKeys.REFRESH_TOKEN]?.let { encrypted ->
            securityUtils.decryptData(encrypted, "refresh_token_key")
        } ?: throw AuthException("No refresh token found")
    }

    /**
     * Sealed class representing authentication states
     */
    sealed class AuthState {
        object Initial : AuthState()
        object NotAuthenticated : AuthState()
        data class Authenticated(val user: User) : AuthState()
        data class RequiresTwoFactor(val token: String) : AuthState()
        data class Error(val message: String) : AuthState()
    }

    /**
     * Custom exception for authentication errors
     */
    class AuthException(message: String, cause: Throwable? = null) : Exception(message, cause)
}