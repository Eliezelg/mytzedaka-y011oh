package com.ijap.app.data.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize // v1.9.0
import com.ijap.app.utils.Constants

/**
 * Data class representing a user in the International Jewish Association Donation Platform.
 * Implements Parcelable for efficient data transfer between Android components.
 *
 * @property id Unique identifier for the user
 * @property email User's email address
 * @property firstName User's first name
 * @property lastName User's last name
 * @property phoneNumber Optional phone number for the user
 * @property preferredLanguage User's preferred language for the application
 * @property preferredCurrency User's preferred currency for donations and transactions
 * @property isEmailVerified Flag indicating if the user's email has been verified
 * @property isTwoFactorEnabled Flag indicating if two-factor authentication is enabled
 * @property isNotificationsEnabled Flag indicating if push notifications are enabled
 * @property role User's role in the system (admin, donor, or association)
 * @property createdAt Timestamp of user creation
 * @property updatedAt Timestamp of last user update
 */
@Parcelize
data class User(
    val id: String,
    val email: String,
    val firstName: String,
    val lastName: String,
    val phoneNumber: String?,
    val preferredLanguage: String,
    val preferredCurrency: String,
    val isEmailVerified: Boolean,
    val isTwoFactorEnabled: Boolean,
    val isNotificationsEnabled: Boolean,
    val role: String,
    val createdAt: Long,
    val updatedAt: Long
) : Parcelable {

    /**
     * Computed property that returns the user's full name.
     * Combines firstName and lastName with proper spacing.
     */
    val fullName: String
        get() = getFullName()

    /**
     * Combines first and last name with proper spacing and trimming.
     * @return Combined full name string
     */
    private fun getFullName(): String {
        return "${firstName.trim()} ${lastName.trim()}".trim()
    }

    /**
     * Checks if the user has administrator privileges.
     * @return true if user has admin role, false otherwise
     */
    fun isAdmin(): Boolean {
        return role == "ADMIN"
    }

    /**
     * Checks if the user is a donor.
     * @return true if user has donor role, false otherwise
     */
    fun isDonor(): Boolean {
        return role == "DONOR"
    }

    /**
     * Checks if the user represents an association.
     * @return true if user represents an association, false otherwise
     */
    fun isAssociation(): Boolean {
        return role == "ASSOCIATION"
    }

    companion object {
        // Default values for user preferences
        const val DEFAULT_LANGUAGE = Constants.DEFAULT_LANGUAGE
        const val DEFAULT_CURRENCY = Constants.DEFAULT_CURRENCY
    }
}