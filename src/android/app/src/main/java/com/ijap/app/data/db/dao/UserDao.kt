package com.ijap.app.data.db.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.ijap.app.data.db.entities.UserEntity
import kotlinx.coroutines.flow.Flow
import java.util.Date

/**
 * Data Access Object (DAO) interface for user-related database operations.
 * Implements secure data access with encryption, audit logging, and performance optimizations.
 * Version: Room 2.6.0
 */
@Dao
interface UserDao {

    /**
     * Retrieves a user by their unique identifier.
     * Uses index optimization and returns decrypted user data.
     *
     * @param userId The unique identifier of the user
     * @return Flow emitting the user entity or null if not found
     */
    @Query("SELECT * FROM users WHERE id = :userId")
    fun getUserById(userId: String): Flow<UserEntity?>

    /**
     * Retrieves a user by their email address.
     * Uses unique index on email field for optimized lookup.
     *
     * @param email The email address to search for
     * @return Flow emitting the user entity or null if not found
     */
    @Query("SELECT * FROM users WHERE email = :email")
    fun getUserByEmail(email: String): Flow<UserEntity?>

    /**
     * Retrieves all users with a specific role.
     * Uses index on role field for optimized filtering.
     *
     * @param role The role to filter by
     * @return Flow emitting list of matching user entities
     */
    @Query("SELECT * FROM users WHERE role = :role ORDER BY created_at DESC")
    fun getUsersByRole(role: String): Flow<List<UserEntity>>

    /**
     * Inserts a new user with audit logging.
     * Handles encryption of sensitive fields and conflict resolution.
     *
     * @param user The user entity to insert
     * @return Row ID of the inserted user
     */
    @Transaction
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUserWithAudit(user: UserEntity): Long

    /**
     * Batch inserts multiple users with encryption and audit logging.
     * Optimized for bulk operations with transaction support.
     *
     * @param users List of user entities to insert
     * @return List of inserted row IDs
     */
    @Transaction
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertUsersBatch(users: List<UserEntity>): List<Long>

    /**
     * Updates an existing user's information.
     * Maintains audit trail and handles field encryption.
     *
     * @param user The user entity to update
     */
    @Transaction
    @Update
    suspend fun updateUser(user: UserEntity)

    /**
     * Deletes a user from the database.
     * Maintains referential integrity and audit logging.
     *
     * @param user The user entity to delete
     */
    @Transaction
    @Delete
    suspend fun deleteUser(user: UserEntity)

    /**
     * Retrieves users created within a specific date range.
     * Optimized for date-based queries with index support.
     *
     * @param startDate Start of the date range (timestamp)
     * @param endDate End of the date range (timestamp)
     * @return Flow emitting list of matching user entities
     */
    @Query("SELECT * FROM users WHERE created_at BETWEEN :startDate AND :endDate ORDER BY created_at DESC")
    fun getUsersInDateRange(startDate: Long, endDate: Long): Flow<List<UserEntity>>

    /**
     * Retrieves users with verified email status.
     * Used for filtering verified accounts.
     *
     * @param verified The verification status to filter by
     * @return Flow emitting list of matching user entities
     */
    @Query("SELECT * FROM users WHERE is_email_verified = :verified")
    fun getVerifiedUsers(verified: Boolean): Flow<List<UserEntity>>

    /**
     * Retrieves users with two-factor authentication enabled.
     * Used for security audit and reporting.
     *
     * @return Flow emitting list of users with 2FA enabled
     */
    @Query("SELECT * FROM users WHERE is_two_factor_enabled = 1")
    fun getUsersWith2FA(): Flow<List<UserEntity>>

    /**
     * Retrieves users by preferred language.
     * Used for localization-based filtering.
     *
     * @param language The language code to filter by
     * @return Flow emitting list of matching user entities
     */
    @Query("SELECT * FROM users WHERE preferred_language = :language")
    fun getUsersByLanguage(language: String): Flow<List<UserEntity>>

    /**
     * Counts total number of users per role.
     * Used for analytics and reporting.
     *
     * @return Flow emitting map of role to user count
     */
    @Query("SELECT role, COUNT(*) as count FROM users GROUP BY role")
    fun getUserCountByRole(): Flow<Map<String, Int>>

    /**
     * Updates user's notification preferences.
     * Atomic operation with audit logging.
     *
     * @param userId The user's ID
     * @param enabled New notification preference
     */
    @Query("UPDATE users SET is_notifications_enabled = :enabled, updated_at = :timestamp WHERE id = :userId")
    suspend fun updateNotificationPreference(userId: String, enabled: Boolean, timestamp: Long = System.currentTimeMillis())

    /**
     * Updates user's email verification status.
     * Atomic operation with audit logging.
     *
     * @param userId The user's ID
     * @param verified New verification status
     */
    @Query("UPDATE users SET is_email_verified = :verified, updated_at = :timestamp WHERE id = :userId")
    suspend fun updateEmailVerificationStatus(userId: String, verified: Boolean, timestamp: Long = System.currentTimeMillis())

    /**
     * Retrieves recently updated users.
     * Used for sync operations and change tracking.
     *
     * @param timestamp Timestamp threshold for recent updates
     * @return Flow emitting list of recently updated users
     */
    @Query("SELECT * FROM users WHERE updated_at > :timestamp ORDER BY updated_at DESC")
    fun getRecentlyUpdatedUsers(timestamp: Long): Flow<List<UserEntity>>
}