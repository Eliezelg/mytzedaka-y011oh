package com.ijap.app.data.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey
import androidx.room.TypeConverters
import com.ijap.app.data.models.User
import com.ijap.app.utils.Constants
import com.ijap.app.utils.security.StringEncryptionConverter

/**
 * Room database entity representing a user in the local SQLite database.
 * Implements field-level encryption for sensitive data and optimized database operations.
 *
 * @property id Unique identifier for the user
 * @property email Encrypted email address (unique index for lookups)
 * @property firstName Encrypted first name
 * @property lastName Encrypted last name
 * @property phoneNumber Optional encrypted phone number
 * @property preferredLanguage User's preferred language code
 * @property preferredCurrency User's preferred currency code
 * @property isEmailVerified Email verification status
 * @property isTwoFactorEnabled 2FA enablement status
 * @property isNotificationsEnabled Push notification preference
 * @property role User's role in the system (indexed for role-based queries)
 * @property createdAt Timestamp of initial creation
 * @property updatedAt Timestamp of last update
 */
@Entity(
    tableName = "users",
    indices = [
        Index(value = ["email"], unique = true),
        Index(value = ["role"])
    ]
)
@TypeConverters(StringEncryptionConverter::class)
data class UserEntity(
    @PrimaryKey
    val id: String,

    @ColumnInfo(name = "email")
    val email: String,

    @ColumnInfo(name = "first_name")
    val firstName: String,

    @ColumnInfo(name = "last_name")
    val lastName: String,

    @ColumnInfo(name = "phone_number")
    val phoneNumber: String?,

    @ColumnInfo(name = "preferred_language", defaultValue = "\"en\"")
    val preferredLanguage: String = Constants.DEFAULT_LANGUAGE,

    @ColumnInfo(name = "preferred_currency", defaultValue = "\"USD\"")
    val preferredCurrency: String = Constants.DEFAULT_CURRENCY,

    @ColumnInfo(name = "is_email_verified", defaultValue = "0")
    val isEmailVerified: Boolean = false,

    @ColumnInfo(name = "is_two_factor_enabled", defaultValue = "0")
    val isTwoFactorEnabled: Boolean = false,

    @ColumnInfo(name = "is_notifications_enabled", defaultValue = "1")
    val isNotificationsEnabled: Boolean = true,

    @ColumnInfo(name = "role")
    val role: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long
) {

    /**
     * Converts this UserEntity to a User domain model.
     * Performs data sanitization and validation during conversion.
     *
     * @return User domain model instance with sanitized data
     */
    fun toUser(): User {
        return User(
            id = id.trim(),
            email = email.trim().toLowerCase(),
            firstName = firstName.trim(),
            lastName = lastName.trim(),
            phoneNumber = phoneNumber?.trim(),
            preferredLanguage = preferredLanguage,
            preferredCurrency = preferredCurrency,
            isEmailVerified = isEmailVerified,
            isTwoFactorEnabled = isTwoFactorEnabled,
            isNotificationsEnabled = isNotificationsEnabled,
            role = role,
            createdAt = createdAt,
            updatedAt = updatedAt
        )
    }

    companion object {
        /**
         * Creates a UserEntity from a User domain model.
         * Handles data validation and sanitization during conversion.
         *
         * @param user The User domain model to convert
         * @return UserEntity instance with validated and sanitized data
         * @throws IllegalArgumentException if required fields are missing or invalid
         */
        fun fromUser(user: User): UserEntity {
            require(user.id.isNotBlank()) { "User ID cannot be blank" }
            require(user.email.isNotBlank()) { "Email cannot be blank" }
            require(user.firstName.isNotBlank()) { "First name cannot be blank" }
            require(user.lastName.isNotBlank()) { "Last name cannot be blank" }

            return UserEntity(
                id = user.id.trim(),
                email = user.email.trim().toLowerCase(),
                firstName = user.firstName.trim(),
                lastName = user.lastName.trim(),
                phoneNumber = user.phoneNumber?.trim(),
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
    }
}