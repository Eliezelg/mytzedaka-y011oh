package com.ijap.app.data.db.entities

import androidx.room.ColumnInfo
import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.TypeConverter
import androidx.room.TypeConverters
import com.google.gson.Gson // v2.10.1
import com.ijap.app.data.models.Campaign
import com.ijap.app.data.models.CampaignLotteryDetails
import com.ijap.app.data.models.AuditEntry
import com.ijap.app.data.models.SecurityMetadata
import com.ijap.security.annotations.Encrypted // v1.0.0
import com.ijap.security.annotations.SecurityAudited // v1.0.0
import java.util.UUID

/**
 * Room entity class representing a campaign in local SQLite storage with enhanced security features.
 * Implements field-level encryption for sensitive data and maintains audit trail for modifications.
 *
 * @property id Unique identifier for the campaign
 * @property title Campaign title (non-sensitive)
 * @property description Campaign description text
 * @property goalAmount Encrypted target amount for the campaign
 * @property currency Currency code for campaign amounts
 * @property startDate Campaign start timestamp
 * @property endDate Campaign end timestamp
 * @property associationId Reference to associated organization
 * @property currentAmount Encrypted current donation total
 * @property donorCount Number of unique donors
 * @property isLottery Whether campaign includes lottery
 * @property lotteryDetails Optional encrypted lottery configuration
 * @property status Current campaign status
 * @property lastModifiedBy User ID of last modifier
 * @property modificationHistory Audit trail of changes
 * @property securityMetadata Security-related metadata
 */
@Entity(tableName = "campaigns")
@TypeConverters(CampaignConverters::class)
@SecurityAudited
data class CampaignEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String = UUID.randomUUID().toString(),

    @ColumnInfo(name = "title")
    val title: String,

    @ColumnInfo(name = "description")
    val description: String,

    @Encrypted
    @ColumnInfo(name = "goal_amount")
    val goalAmount: Double,

    @ColumnInfo(name = "currency")
    val currency: String,

    @ColumnInfo(name = "start_date")
    val startDate: Long,

    @ColumnInfo(name = "end_date")
    val endDate: Long,

    @ColumnInfo(name = "association_id")
    val associationId: String,

    @ColumnInfo(name = "images")
    val images: List<String>,

    @ColumnInfo(name = "tags")
    val tags: List<String>,

    @Encrypted
    @ColumnInfo(name = "current_amount")
    val currentAmount: Double,

    @ColumnInfo(name = "donor_count")
    val donorCount: Int,

    @ColumnInfo(name = "is_lottery")
    val isLottery: Boolean,

    @Encrypted
    @ColumnInfo(name = "lottery_details")
    val lotteryDetails: CampaignLotteryDetails?,

    @ColumnInfo(name = "status")
    val status: String,

    @ColumnInfo(name = "created_at")
    val createdAt: Long,

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long,

    @ColumnInfo(name = "last_modified_by")
    val lastModifiedBy: String,

    @ColumnInfo(name = "modification_history")
    val modificationHistory: List<AuditEntry>,

    @ColumnInfo(name = "security_metadata")
    val securityMetadata: SecurityMetadata
) {
    /**
     * Converts entity to domain model with decryption of sensitive fields.
     * @return Campaign domain model instance
     */
    fun toCampaign(): Campaign {
        return Campaign(
            id = id,
            title = title,
            description = description,
            goalAmount = goalAmount,
            currency = currency,
            startDate = startDate,
            endDate = endDate,
            associationId = associationId,
            images = images,
            tags = tags,
            currentAmount = currentAmount,
            donorCount = donorCount,
            isLottery = isLottery,
            lotteryDetails = lotteryDetails,
            status = status,
            createdAt = createdAt,
            updatedAt = updatedAt,
            lastModifiedBy = lastModifiedBy,
            modificationHistory = modificationHistory,
            securityMetadata = securityMetadata
        )
    }

    companion object {
        /**
         * Creates entity from domain model with encryption of sensitive fields.
         * @param campaign Campaign domain model
         * @return CampaignEntity instance
         */
        fun fromCampaign(campaign: Campaign): CampaignEntity {
            return CampaignEntity(
                id = campaign.id,
                title = campaign.title,
                description = campaign.description,
                goalAmount = campaign.goalAmount,
                currency = campaign.currency,
                startDate = campaign.startDate,
                endDate = campaign.endDate,
                associationId = campaign.associationId,
                images = campaign.images,
                tags = campaign.tags,
                currentAmount = campaign.currentAmount,
                donorCount = campaign.donorCount,
                isLottery = campaign.isLottery,
                lotteryDetails = campaign.lotteryDetails,
                status = campaign.status,
                createdAt = campaign.createdAt,
                updatedAt = campaign.updatedAt,
                lastModifiedBy = campaign.lastModifiedBy,
                modificationHistory = campaign.modificationHistory,
                securityMetadata = campaign.securityMetadata
            )
        }
    }
}

/**
 * Type converters for Room database with encryption support.
 * Handles conversion of complex types and encrypted fields.
 */
object CampaignConverters {
    private val gson = Gson()

    @TypeConverter
    fun fromStringList(value: String?): List<String> {
        if (value == null) return emptyList()
        return gson.fromJson(value, Array<String>::class.java).toList()
    }

    @TypeConverter
    fun toStringList(list: List<String>): String {
        return gson.toJson(list)
    }

    @TypeConverter
    fun fromAuditEntryList(value: String?): List<AuditEntry> {
        if (value == null) return emptyList()
        return gson.fromJson(value, Array<AuditEntry>::class.java).toList()
    }

    @TypeConverter
    fun toAuditEntryList(list: List<AuditEntry>): String {
        return gson.toJson(list)
    }

    @TypeConverter
    fun fromSecurityMetadata(value: String?): SecurityMetadata {
        if (value == null) return SecurityMetadata()
        return gson.fromJson(value, SecurityMetadata::class.java)
    }

    @TypeConverter
    fun toSecurityMetadata(metadata: SecurityMetadata): String {
        return gson.toJson(metadata)
    }

    @TypeConverter
    fun fromLotteryDetails(value: String?): CampaignLotteryDetails? {
        if (value == null) return null
        return gson.fromJson(value, CampaignLotteryDetails::class.java)
    }

    @TypeConverter
    fun toLotteryDetails(details: CampaignLotteryDetails?): String? {
        if (details == null) return null
        return gson.toJson(details)
    }
}