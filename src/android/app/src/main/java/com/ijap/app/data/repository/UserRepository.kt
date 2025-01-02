package com.ijap.app.data.repository

import com.ijap.app.data.db.dao.UserDao
import com.ijap.app.data.db.entities.UserEntity
import com.ijap.app.data.models.User
import com.ijap.app.utils.SecurityUtils
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton
import java.util.concurrent.atomic.AtomicBoolean
import retrofit2.Response

/**
 * Repository implementation for managing user data with enhanced security and offline support.
 * Handles encrypted data operations between local database and remote API.
 * Version: 1.0.0
 */
@Singleton
class UserRepository @Inject constructor(
    private val userDao: UserDao,
    private val apiService: ApiService,
    private val securityUtils: SecurityUtils
) {
    private val syncMutex = Mutex()
    private val isSyncing = AtomicBoolean(false)
    private val pendingChanges = mutableListOf<PendingChange>()

    // Encrypted key aliases for sensitive data
    private companion object {
        const val EMAIL_KEY_ALIAS = "user_email_key"
        const val PHONE_KEY_ALIAS = "user_phone_key"
        const val NAME_KEY_ALIAS = "user_name_key"
    }

    /**
     * Retrieves a user by their ID with encryption handling and offline support
     * @param userId The unique identifier of the user
     * @return Flow emitting the decrypted user data or null if not found
     */
    fun getUserById(userId: String): Flow<User?> {
        return userDao.getUserById(userId)
            .map { entity ->
                entity?.let { decryptUserEntity(it) }
            }
            .catch { e ->
                // Log error and emit null on decryption failure
                e.printStackTrace()
                emit(null)
            }
    }

    /**
     * Updates user information with encryption and offline sync support
     * @param user The user data to update
     * @return Result indicating success or failure
     */
    suspend fun updateUser(user: User): Result<Boolean> {
        return try {
            val encryptedEntity = encryptUserData(user)
            userDao.updateUser(encryptedEntity)
            
            // Queue for remote sync
            pendingChanges.add(PendingChange(
                type = ChangeType.UPDATE,
                userId = user.id,
                timestamp = System.currentTimeMillis()
            ))

            // Trigger sync if online
            handleOfflineSync()
            Result.success(true)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Creates a new user with encrypted data storage
     * @param user The user data to create
     * @return Result containing the created user ID or error
     */
    suspend fun createUser(user: User): Result<String> {
        return try {
            val encryptedEntity = encryptUserData(user)
            val id = userDao.insertUserWithAudit(encryptedEntity)
            
            pendingChanges.add(PendingChange(
                type = ChangeType.CREATE,
                userId = user.id,
                timestamp = System.currentTimeMillis()
            ))

            handleOfflineSync()
            Result.success(user.id)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Handles secure offline data synchronization
     * @return Unit
     */
    suspend fun handleOfflineSync() {
        if (!isSyncing.compareAndSet(false, true)) return

        try {
            syncMutex.withLock {
                val changes = pendingChanges.toList()
                pendingChanges.clear()

                changes.forEach { change ->
                    try {
                        when (change.type) {
                            ChangeType.CREATE -> syncCreateUser(change.userId)
                            ChangeType.UPDATE -> syncUpdateUser(change.userId)
                            ChangeType.DELETE -> syncDeleteUser(change.userId)
                        }
                    } catch (e: Exception) {
                        // Re-queue failed changes
                        pendingChanges.add(change)
                    }
                }
            }
        } finally {
            isSyncing.set(false)
        }
    }

    /**
     * Encrypts sensitive user data fields
     * @param user The user data to encrypt
     * @return UserEntity with encrypted fields
     */
    private fun encryptUserData(user: User): UserEntity {
        return UserEntity(
            id = user.id,
            email = securityUtils.encryptData(user.email, EMAIL_KEY_ALIAS),
            firstName = securityUtils.encryptData(user.firstName, NAME_KEY_ALIAS),
            lastName = securityUtils.encryptData(user.lastName, NAME_KEY_ALIAS),
            phoneNumber = user.phoneNumber?.let { 
                securityUtils.encryptData(it, PHONE_KEY_ALIAS)
            },
            preferredLanguage = user.preferredLanguage,
            preferredCurrency = user.preferredCurrency,
            isEmailVerified = user.isEmailVerified,
            isTwoFactorEnabled = user.isTwoFactorEnabled,
            isNotificationsEnabled = user.isNotificationsEnabled,
            role = user.role,
            createdAt = user.createdAt,
            updatedAt = System.currentTimeMillis()
        )
    }

    /**
     * Decrypts user entity data into domain model
     * @param entity The encrypted user entity
     * @return Decrypted User domain model
     */
    private fun decryptUserEntity(entity: UserEntity): User {
        return User(
            id = entity.id,
            email = securityUtils.decryptData(entity.email, EMAIL_KEY_ALIAS),
            firstName = securityUtils.decryptData(entity.firstName, NAME_KEY_ALIAS),
            lastName = securityUtils.decryptData(entity.lastName, NAME_KEY_ALIAS),
            phoneNumber = entity.phoneNumber?.let {
                securityUtils.decryptData(it, PHONE_KEY_ALIAS)
            },
            preferredLanguage = entity.preferredLanguage,
            preferredCurrency = entity.preferredCurrency,
            isEmailVerified = entity.isEmailVerified,
            isTwoFactorEnabled = entity.isTwoFactorEnabled,
            isNotificationsEnabled = entity.isNotificationsEnabled,
            role = entity.role,
            createdAt = entity.createdAt,
            updatedAt = entity.updatedAt
        )
    }

    /**
     * Syncs user creation with remote API
     * @param userId ID of user to sync
     */
    private suspend fun syncCreateUser(userId: String) {
        getUserById(userId).collect { user ->
            user?.let {
                val response = apiService.createUser(it)
                handleSyncResponse(response, userId)
            }
        }
    }

    /**
     * Syncs user updates with remote API
     * @param userId ID of user to sync
     */
    private suspend fun syncUpdateUser(userId: String) {
        getUserById(userId).collect { user ->
            user?.let {
                val response = apiService.updateUser(userId, it)
                handleSyncResponse(response, userId)
            }
        }
    }

    /**
     * Syncs user deletion with remote API
     * @param userId ID of user to sync
     */
    private suspend fun syncDeleteUser(userId: String) {
        val response = apiService.deleteUser(userId)
        handleSyncResponse(response, userId)
    }

    /**
     * Handles API sync response
     * @param response API response
     * @param userId ID of affected user
     */
    private fun handleSyncResponse(response: Response<*>, userId: String) {
        if (!response.isSuccessful) {
            pendingChanges.add(PendingChange(
                type = ChangeType.UPDATE,
                userId = userId,
                timestamp = System.currentTimeMillis()
            ))
        }
    }

    /**
     * Represents a pending change for offline sync
     */
    private data class PendingChange(
        val type: ChangeType,
        val userId: String,
        val timestamp: Long
    )

    /**
     * Enum representing types of sync changes
     */
    private enum class ChangeType {
        CREATE, UPDATE, DELETE
    }
}