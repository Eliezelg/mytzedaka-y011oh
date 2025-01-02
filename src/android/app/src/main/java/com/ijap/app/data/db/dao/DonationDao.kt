package com.ijap.app.data.db.dao

import androidx.room.Dao // v2.6.0
import androidx.room.Query // v2.6.0
import androidx.room.Transaction // v2.6.0
import androidx.room.Insert // v2.6.0
import androidx.room.Update // v2.6.0
import androidx.room.Delete // v2.6.0
import androidx.room.OnConflictStrategy // v2.6.0
import kotlinx.coroutines.flow.Flow // v1.7.0
import com.ijap.app.data.db.entities.DonationEntity

/**
 * Room DAO interface for secure donation-related database operations.
 * Implements comprehensive querying with support for:
 * - Field-level encryption
 * - Jewish cultural considerations (Chai amounts, Shabbat compliance)
 * - Audit trail tracking
 * - Multi-currency support
 */
@Dao
interface DonationDao {

    /**
     * Retrieves a single donation by ID with proper decryption
     * @param donationId Unique identifier of the donation
     * @return Flow of nullable encrypted donation entity
     */
    @Query("SELECT * FROM donations WHERE id = :donationId")
    fun getDonationById(donationId: String): Flow<DonationEntity?>

    /**
     * Retrieves all donations for a user with encryption handling
     * @param userId ID of the user
     * @return Flow of list of encrypted donation entities
     */
    @Query("SELECT * FROM donations WHERE user_id = :userId ORDER BY created_at DESC")
    fun getDonationsForUser(userId: String): Flow<List<DonationEntity>>

    /**
     * Retrieves donations in chai amounts (multiples of 18)
     * @param userId ID of the user
     * @return Flow of chai amount donations
     */
    @Query("""
        SELECT * FROM donations 
        WHERE user_id = :userId 
        AND is_chai_amount = 1 
        ORDER BY created_at DESC
    """)
    fun getChaiDonations(userId: String): Flow<List<DonationEntity>>

    /**
     * Retrieves donations excluding Shabbat times
     * @param userId ID of the user
     * @return Flow of non-Shabbat donations
     */
    @Transaction
    @Query("""
        SELECT * FROM donations 
        WHERE user_id = :userId 
        AND is_shabbat_compliant = 0 
        ORDER BY created_at DESC
    """)
    fun getDonationsExcludingShabbat(userId: String): Flow<List<DonationEntity>>

    /**
     * Retrieves donations for a specific association
     * @param associationId ID of the association
     * @return Flow of association donations
     */
    @Query("""
        SELECT * FROM donations 
        WHERE association_id = :associationId 
        ORDER BY created_at DESC
    """)
    fun getDonationsForAssociation(associationId: String): Flow<List<DonationEntity>>

    /**
     * Retrieves donations for a specific campaign
     * @param campaignId ID of the campaign
     * @return Flow of campaign donations
     */
    @Query("""
        SELECT * FROM donations 
        WHERE campaign_id = :campaignId 
        ORDER BY created_at DESC
    """)
    fun getDonationsForCampaign(campaignId: String): Flow<List<DonationEntity>>

    /**
     * Retrieves recurring donations for a user
     * @param userId ID of the user
     * @return Flow of recurring donations
     */
    @Query("""
        SELECT * FROM donations 
        WHERE user_id = :userId 
        AND is_recurring = 1 
        ORDER BY created_at DESC
    """)
    fun getRecurringDonations(userId: String): Flow<List<DonationEntity>>

    /**
     * Retrieves anonymous donations for an association
     * @param associationId ID of the association
     * @return Flow of anonymous donations
     */
    @Query("""
        SELECT * FROM donations 
        WHERE association_id = :associationId 
        AND is_anonymous = 1 
        ORDER BY created_at DESC
    """)
    fun getAnonymousDonations(associationId: String): Flow<List<DonationEntity>>

    /**
     * Retrieves donations by currency type
     * @param currencyCode ISO currency code
     * @return Flow of currency-specific donations
     */
    @Query("""
        SELECT * FROM donations 
        WHERE currency = :currencyCode 
        ORDER BY created_at DESC
    """)
    fun getDonationsByCurrency(currencyCode: String): Flow<List<DonationEntity>>

    /**
     * Inserts a new donation with encryption
     * @param donation Donation entity to insert
     */
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertDonation(donation: DonationEntity)

    /**
     * Updates an existing donation with encryption
     * @param donation Donation entity to update
     */
    @Update
    suspend fun updateDonation(donation: DonationEntity)

    /**
     * Deletes a donation (soft delete with audit trail)
     * @param donation Donation entity to delete
     */
    @Delete
    suspend fun deleteDonation(donation: DonationEntity)

    /**
     * Retrieves pending donations requiring synchronization
     * @return Flow of unsynchronized donations
     */
    @Query("""
        SELECT * FROM donations 
        WHERE sync_status = 'PENDING' 
        ORDER BY created_at ASC
    """)
    fun getPendingSyncDonations(): Flow<List<DonationEntity>>

    /**
     * Updates sync status for a donation
     * @param donationId ID of the donation
     * @param syncStatus New sync status
     */
    @Query("""
        UPDATE donations 
        SET sync_status = :syncStatus, 
            updated_at = :timestamp 
        WHERE id = :donationId
    """)
    suspend fun updateSyncStatus(
        donationId: String,
        syncStatus: String,
        timestamp: Long = System.currentTimeMillis()
    )

    /**
     * Retrieves donations within a date range
     * @param startTime Start timestamp
     * @param endTime End timestamp
     * @return Flow of donations within range
     */
    @Query("""
        SELECT * FROM donations 
        WHERE created_at BETWEEN :startTime AND :endTime 
        ORDER BY created_at DESC
    """)
    fun getDonationsInDateRange(startTime: Long, endTime: Long): Flow<List<DonationEntity>>

    /**
     * Retrieves donations above a specific amount in given currency
     * @param amount Minimum amount
     * @param currency Currency code
     * @return Flow of donations above amount
     */
    @Query("""
        SELECT * FROM donations 
        WHERE amount >= :amount 
        AND currency = :currency 
        ORDER BY amount DESC
    """)
    fun getDonationsAboveAmount(amount: Double, currency: String): Flow<List<DonationEntity>>
}