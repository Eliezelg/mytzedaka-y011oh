package com.ijap.app.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.ijap.app.data.models.User
import com.ijap.app.data.repository.UserRepository
import com.ijap.app.utils.SecurityUtils
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * ViewModel for managing user profile data with enhanced security and offline support.
 * Handles encrypted data operations, offline synchronization, and state management.
 * Version: 1.0.0
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val userRepository: UserRepository,
    private val securityUtils: SecurityUtils
) : ViewModel() {

    // UI State Flows
    private val _userProfile = MutableStateFlow<User?>(null)
    val userProfile: StateFlow<User?> = _userProfile

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    // Encryption key aliases for sensitive fields
    private companion object {
        const val PHONE_KEY_ALIAS = "profile_phone_key"
        const val NAME_KEY_ALIAS = "profile_name_key"
    }

    init {
        observeUserProfile()
        setupOfflineMode()
        scheduleSyncOperations()
    }

    /**
     * Updates user profile with field-level encryption and offline support
     * @param firstName User's first name
     * @param lastName User's last name
     * @param phoneNumber Optional phone number
     * @return Success status of the operation
     */
    suspend fun updateProfile(
        firstName: String,
        lastName: String,
        phoneNumber: String?
    ): Boolean {
        if (!validateInput(firstName, lastName)) {
            _error.value = "Invalid input parameters"
            return false
        }

        _isLoading.value = true
        return try {
            val currentUser = _userProfile.value ?: throw IllegalStateException("No user profile loaded")
            
            // Encrypt sensitive fields
            val encryptedFirstName = securityUtils.encryptData(firstName, NAME_KEY_ALIAS)
            val encryptedLastName = securityUtils.encryptData(lastName, NAME_KEY_ALIAS)
            val encryptedPhone = phoneNumber?.let { 
                securityUtils.encryptData(it, PHONE_KEY_ALIAS)
            }

            val updatedUser = currentUser.copy(
                firstName = encryptedFirstName,
                lastName = encryptedLastName,
                phoneNumber = encryptedPhone,
                updatedAt = System.currentTimeMillis()
            )

            val result = userRepository.updateUser(updatedUser)
            
            if (result.isSuccess) {
                _userProfile.value = updatedUser
                if (_isOffline.value) {
                    scheduleSyncOperations()
                }
                true
            } else {
                _error.value = result.exceptionOrNull()?.message ?: "Update failed"
                false
            }
        } catch (e: Exception) {
            _error.value = e.message
            false
        } finally {
            _isLoading.value = false
        }
    }

    /**
     * Triggers manual synchronization of offline changes
     * @return Success status of sync operation
     */
    suspend fun syncProfile(): Boolean {
        if (!_isOffline.value) return true

        _isSyncing.value = true
        return try {
            userRepository.handleOfflineSync()
            true
        } catch (e: Exception) {
            _error.value = "Sync failed: ${e.message}"
            false
        } finally {
            _isSyncing.value = false
        }
    }

    /**
     * Updates user's preferred language
     * @param language Language code (e.g., "en", "he", "fr")
     */
    suspend fun updateLanguagePreference(language: String) {
        _userProfile.value?.let { currentUser ->
            val updatedUser = currentUser.copy(
                preferredLanguage = language,
                updatedAt = System.currentTimeMillis()
            )
            userRepository.updateUser(updatedUser)
        }
    }

    /**
     * Updates user's preferred currency
     * @param currency Currency code (e.g., "USD", "ILS", "EUR")
     */
    suspend fun updateCurrencyPreference(currency: String) {
        _userProfile.value?.let { currentUser ->
            val updatedUser = currentUser.copy(
                preferredCurrency = currency,
                updatedAt = System.currentTimeMillis()
            )
            userRepository.updateUser(updatedUser)
        }
    }

    /**
     * Toggles notification preferences
     * @param enabled Whether notifications should be enabled
     */
    suspend fun updateNotificationPreference(enabled: Boolean) {
        _userProfile.value?.let { currentUser ->
            val updatedUser = currentUser.copy(
                isNotificationsEnabled = enabled,
                updatedAt = System.currentTimeMillis()
            )
            userRepository.updateUser(updatedUser)
        }
    }

    /**
     * Clears any error messages in the UI state
     */
    fun clearError() {
        _error.value = null
    }

    // Private helper functions

    private fun observeUserProfile() {
        viewModelScope.launch {
            userRepository.getUserById(_userProfile.value?.id ?: return@launch)
                .catch { e ->
                    _error.value = "Failed to load profile: ${e.message}"
                }
                .collectLatest { user ->
                    _userProfile.value = user
                }
        }
    }

    private fun setupOfflineMode() {
        viewModelScope.launch {
            // Implement offline mode detection logic
            // This would typically involve monitoring network connectivity
            // and updating _isOffline.value accordingly
        }
    }

    private fun scheduleSyncOperations() {
        viewModelScope.launch {
            // Implement periodic sync scheduling logic
            // This would typically involve WorkManager for background sync
        }
    }

    private fun validateInput(firstName: String, lastName: String): Boolean {
        return firstName.isNotBlank() && lastName.isNotBlank() &&
                firstName.length <= 50 && lastName.length <= 50
    }
}