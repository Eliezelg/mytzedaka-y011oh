package com.ijap.app.data.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize // v1.9.0
import com.google.gson.annotations.SerializedName // v2.10.1
import com.ijap.security.annotations.Encrypted // v1.0.0
import androidx.room.Entity
import androidx.room.PrimaryKey
import com.ijap.app.utils.CurrencyUtils
import java.util.UUID

/**
 * Data class representing a fundraising campaign with enhanced security, lottery functionality,
 * and comprehensive validation. Implements Parcelable for efficient data transfer between
 * Android components.
 */
@Parcelize
@Entity(tableName = "campaigns")
data class Campaign(
    @PrimaryKey
    @SerializedName("id")
    val id: String = UUID.randomUUID().toString(),

    @SerializedName("title")
    val title: String,

    @SerializedName("description")
    val description: String,

    @Encrypted
    @SerializedName("goal_amount")
    val goalAmount: Double,

    @SerializedName("currency")
    val currency: String,

    @SerializedName("start_date")
    val startDate: Long,

    @SerializedName("end_date")
    val endDate: Long,

    @SerializedName("association_id")
    val associationId: String,

    @SerializedName("images")
    val images: List<String> = listOf(),

    @SerializedName("tags")
    val tags: List<String> = listOf(),

    @Encrypted
    @SerializedName("current_amount")
    val currentAmount: Double = 0.0,

    @SerializedName("donor_count")
    val donorCount: Int = 0,

    @SerializedName("is_lottery")
    val isLottery: Boolean = false,

    @SerializedName("lottery_details")
    val lotteryDetails: CampaignLotteryDetails? = null,

    @SerializedName("status")
    val status: String = "DRAFT",

    @SerializedName("created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @SerializedName("updated_at")
    val updatedAt: Long = System.currentTimeMillis(),

    @SerializedName("last_modified_by")
    val lastModifiedBy: String,

    @SerializedName("modification_history")
    val modificationHistory: List<AuditEntry> = listOf(),

    @SerializedName("security_metadata")
    val securityMetadata: SecurityMetadata = SecurityMetadata()
) : Parcelable {

    /**
     * Formats the campaign goal amount with proper currency symbol and cultural considerations.
     * @return Formatted amount string with currency symbol
     */
    fun getFormattedGoalAmount(): String {
        return CurrencyUtils.formatCurrency(
            amount = goalAmount,
            currencyCode = currency,
            useChaiNotation = true
        )
    }

    /**
     * Validates campaign dates against business rules and association requirements.
     * @return True if campaign dates are valid
     */
    fun validateCampaignDates(): Boolean {
        val now = System.currentTimeMillis()
        val minDuration = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
        
        return startDate >= now &&
                endDate > startDate &&
                (endDate - startDate) >= minDuration
    }

    /**
     * Validates campaign goal amount against currency-specific rules.
     * @return True if goal amount is valid
     */
    fun validateGoalAmount(): Boolean {
        return CurrencyUtils.validateAmount(goalAmount, currency)
    }

    companion object {
        const val STATUS_DRAFT = "DRAFT"
        const val STATUS_ACTIVE = "ACTIVE"
        const val STATUS_PAUSED = "PAUSED"
        const val STATUS_COMPLETED = "COMPLETED"
        const val STATUS_CANCELLED = "CANCELLED"
    }
}

/**
 * Data class representing lottery details for campaigns with lottery functionality.
 */
@Parcelize
data class CampaignLotteryDetails(
    @SerializedName("draw_date")
    val drawDate: Long,

    @Encrypted
    @SerializedName("ticket_price")
    val ticketPrice: Double,

    @SerializedName("currency")
    val currency: String,

    @SerializedName("max_tickets")
    val maxTickets: Int,

    @SerializedName("prizes")
    val prizes: List<LotteryPrize> = listOf(),

    @SerializedName("rules")
    val rules: LotteryRules,

    @SerializedName("security_metadata")
    val securityMetadata: SecurityMetadata = SecurityMetadata()
) : Parcelable

/**
 * Data class representing a prize in the campaign lottery.
 */
@Parcelize
data class LotteryPrize(
    @SerializedName("prize_id")
    val prizeId: String = UUID.randomUUID().toString(),

    @SerializedName("description")
    val description: String,

    @Encrypted
    @SerializedName("value")
    val value: Double,

    @SerializedName("currency")
    val currency: String,

    @SerializedName("rank")
    val rank: Int
) : Parcelable

/**
 * Data class representing lottery rules and restrictions.
 */
@Parcelize
data class LotteryRules(
    @SerializedName("min_age")
    val minAge: Int = 18,

    @SerializedName("allowed_countries")
    val allowedCountries: List<String>,

    @SerializedName("terms_url")
    val termsUrl: String,

    @SerializedName("max_tickets_per_donor")
    val maxTicketsPerDonor: Int
) : Parcelable

/**
 * Data class for tracking modifications to campaign data.
 */
@Parcelize
data class AuditEntry(
    @SerializedName("timestamp")
    val timestamp: Long = System.currentTimeMillis(),

    @SerializedName("user_id")
    val userId: String,

    @SerializedName("action")
    val action: String,

    @SerializedName("field_name")
    val fieldName: String?,

    @SerializedName("old_value")
    val oldValue: String?,

    @SerializedName("new_value")
    val newValue: String?
) : Parcelable

/**
 * Data class for storing security-related metadata.
 */
@Parcelize
data class SecurityMetadata(
    @SerializedName("encryption_version")
    val encryptionVersion: String = "1.0",

    @SerializedName("last_security_audit")
    val lastSecurityAudit: Long = System.currentTimeMillis(),

    @SerializedName("security_flags")
    val securityFlags: Map<String, Boolean> = mapOf()
) : Parcelable