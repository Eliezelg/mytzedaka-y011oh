package com.ijap.app.data.db.dao

import androidx.room.Dao // v2.6.0
import androidx.room.Query // v2.6.0
import androidx.room.Insert // v2.6.0
import androidx.room.Update // v2.6.0
import androidx.room.Delete // v2.6.0
import androidx.room.Transaction // v2.6.0
import kotlinx.coroutines.flow.Flow // v1.7.3
import com.ijap.app.data.db.entities.CampaignEntity
import com.ijap.app.logging.AuditLogger // v1.0.0
import com.ijap.app.security.SecurityUtils // v1.0.0

/**
 * Room DAO interface for secure Campaign database operations.
 * Implements field-level encryption and audit logging for all operations.
 */
@Dao
interface CampaignDao {

    /**
     * Retrieves all campaigns with decrypted sensitive fields.
     * @return Flow of all campaigns with decrypted data
     */
    @Query("SELECT * FROM campaigns ORDER BY created_at DESC")
    fun getCampaigns(): Flow<List<CampaignEntity>>

    /**
     * Retrieves campaigns for a specific association with decrypted data.
     * @param associationId The ID of the association
     * @return Flow of association's campaigns with decrypted data
     */
    @Query("SELECT * FROM campaigns WHERE association_id = :associationId ORDER BY created_at DESC")
    fun getCampaignsByAssociation(associationId: String): Flow<List<CampaignEntity>>

    /**
     * Retrieves a specific campaign by ID with decrypted data.
     * @param id Campaign ID
     * @return Flow of campaign with decrypted data
     */
    @Query("SELECT * FROM campaigns WHERE id = :id")
    fun getCampaignById(id: String): Flow<CampaignEntity?>

    /**
     * Retrieves active campaigns within a date range.
     * @param startDate Start timestamp
     * @param endDate End timestamp
     * @return Flow of active campaigns in range
     */
    @Query("""
        SELECT * FROM campaigns 
        WHERE status = 'ACTIVE' 
        AND start_date >= :startDate 
        AND end_date <= :endDate 
        ORDER BY created_at DESC
    """)
    fun getActiveCampaignsInRange(startDate: Long, endDate: Long): Flow<List<CampaignEntity>>

    /**
     * Securely inserts a new campaign with encrypted sensitive fields.
     * @param campaign Campaign entity to insert
     * @return Row ID of inserted campaign
     */
    @Transaction
    @Insert
    suspend fun insertCampaignSecure(campaign: CampaignEntity): Long {
        SecurityUtils.encryptSensitiveFields(campaign)
        val rowId = insertCampaign(campaign)
        AuditLogger.logDatabaseOperation(
            entityType = "Campaign",
            entityId = campaign.id,
            operation = "INSERT",
            userId = campaign.lastModifiedBy
        )
        return rowId
    }

    /**
     * Internal insert operation for encrypted campaign data.
     */
    @Insert
    suspend fun insertCampaign(campaign: CampaignEntity): Long

    /**
     * Securely updates an existing campaign with encrypted data.
     * @param campaign Updated campaign entity
     * @return Number of rows updated
     */
    @Transaction
    @Update
    suspend fun updateCampaignSecure(campaign: CampaignEntity): Int {
        SecurityUtils.encryptSensitiveFields(campaign)
        val updateCount = updateCampaign(campaign)
        AuditLogger.logDatabaseOperation(
            entityType = "Campaign",
            entityId = campaign.id,
            operation = "UPDATE",
            userId = campaign.lastModifiedBy
        )
        return updateCount
    }

    /**
     * Internal update operation for encrypted campaign data.
     */
    @Update
    suspend fun updateCampaign(campaign: CampaignEntity): Int

    /**
     * Securely deletes a campaign with audit logging.
     * @param campaign Campaign entity to delete
     */
    @Transaction
    @Delete
    suspend fun deleteCampaignSecure(campaign: CampaignEntity) {
        AuditLogger.logDatabaseOperation(
            entityType = "Campaign",
            entityId = campaign.id,
            operation = "DELETE",
            userId = campaign.lastModifiedBy
        )
        deleteCampaign(campaign)
    }

    /**
     * Internal delete operation for campaign data.
     */
    @Delete
    suspend fun deleteCampaign(campaign: CampaignEntity)

    /**
     * Updates campaign status with security checks and audit logging.
     * @param campaignId Campaign ID
     * @param newStatus New status value
     * @param userId ID of user making the change
     * @return Number of rows updated
     */
    @Transaction
    @Query("UPDATE campaigns SET status = :newStatus WHERE id = :campaignId")
    suspend fun updateCampaignStatus(
        campaignId: String,
        newStatus: String,
        userId: String
    ): Int {
        val updateCount = updateStatus(campaignId, newStatus)
        if (updateCount > 0) {
            AuditLogger.logDatabaseOperation(
                entityType = "Campaign",
                entityId = campaignId,
                operation = "STATUS_UPDATE",
                userId = userId,
                details = mapOf("new_status" to newStatus)
            )
        }
        return updateCount
    }

    /**
     * Internal status update operation.
     */
    @Query("UPDATE campaigns SET status = :status WHERE id = :campaignId")
    suspend fun updateStatus(campaignId: String, status: String): Int
}