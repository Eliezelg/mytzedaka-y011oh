package com.ijap.app.data.db.dao

import androidx.room.Dao
import androidx.room.Delete
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction
import androidx.room.Update
import com.ijap.app.data.db.entities.AssociationEntity
import kotlinx.coroutines.flow.Flow

/**
 * Room DAO interface for managing Jewish charitable associations in the local SQLite database.
 * Implements comprehensive CRUD operations with proper security, internationalization support,
 * and reactive data updates using Kotlin Flow.
 *
 * @version 1.0.0
 * @see AssociationEntity
 */
@Dao
interface AssociationDao {

    /**
     * Retrieves a single association by its unique identifier.
     * Supports reactive updates through Kotlin Flow.
     *
     * @param id Unique identifier of the association
     * @return Flow emitting the association or null if not found
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        WHERE id = :id
    """)
    fun getAssociationById(id: String): Flow<AssociationEntity?>

    /**
     * Retrieves all associations with proper sorting for multilingual content.
     * Uses case-insensitive collation for correct Hebrew character ordering.
     *
     * @return Flow emitting list of all associations
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        ORDER BY name COLLATE NOCASE ASC
    """)
    fun getAllAssociations(): Flow<List<AssociationEntity>>

    /**
     * Retrieves only active associations with status filtering.
     * Supports proper sorting for multilingual names.
     *
     * @return Flow emitting list of active associations
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        WHERE is_active = 1 
        ORDER BY name COLLATE NOCASE ASC
    """)
    fun getActiveAssociations(): Flow<List<AssociationEntity>>

    /**
     * Searches associations by name or description with SQL injection prevention.
     * Supports multilingual search with proper character handling.
     *
     * @param query Search query string
     * @return Flow emitting list of matching associations
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        WHERE name LIKE '%' || :query || '%' 
        OR description LIKE '%' || :query || '%' 
        ORDER BY name COLLATE NOCASE ASC
    """)
    fun searchAssociations(query: String): Flow<List<AssociationEntity>>

    /**
     * Retrieves associations filtered by country with international support.
     * Uses case-insensitive sorting for proper multilingual display.
     *
     * @param country Country code to filter by
     * @return Flow emitting list of associations in the specified country
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        WHERE country = :country 
        ORDER BY name COLLATE NOCASE ASC
    """)
    fun getAssociationsByCountry(country: String): Flow<List<AssociationEntity>>

    /**
     * Inserts a new association with conflict handling.
     * Uses ABORT strategy to prevent duplicate entries.
     *
     * @param association Association entity to insert
     * @return ID of the inserted association
     */
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insertAssociation(association: AssociationEntity): Long

    /**
     * Updates an existing association with transaction support.
     * Ensures atomic updates for data consistency.
     *
     * @param association Association entity to update
     * @return Number of rows updated
     */
    @Update
    suspend fun updateAssociation(association: AssociationEntity): Int

    /**
     * Deletes an association with proper cleanup.
     * Ensures referential integrity through transaction.
     *
     * @param association Association entity to delete
     * @return Number of rows deleted
     */
    @Delete
    suspend fun deleteAssociation(association: AssociationEntity): Int

    /**
     * Retrieves verified associations for a specific country.
     * Supports international operations with proper sorting.
     *
     * @param country Country code to filter by
     * @return Flow emitting list of verified associations
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        WHERE country = :country 
        AND is_verified = 1 
        ORDER BY name COLLATE NOCASE ASC
    """)
    fun getVerifiedAssociationsByCountry(country: String): Flow<List<AssociationEntity>>

    /**
     * Retrieves associations that support a specific currency.
     * Enables filtered access based on payment capabilities.
     *
     * @param currency Currency code to filter by
     * @return Flow emitting list of associations supporting the currency
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        WHERE supported_currencies_json LIKE '%' || :currency || '%' 
        AND is_active = 1 
        ORDER BY name COLLATE NOCASE ASC
    """)
    fun getAssociationsBySupportedCurrency(currency: String): Flow<List<AssociationEntity>>

    /**
     * Retrieves recently updated associations within specified time window.
     * Supports monitoring of association data changes.
     *
     * @param timestamp Timestamp to filter updates after
     * @return Flow emitting list of recently updated associations
     */
    @Transaction
    @Query("""
        SELECT * FROM associations 
        WHERE updated_at >= :timestamp 
        ORDER BY updated_at DESC
    """)
    fun getRecentlyUpdatedAssociations(timestamp: Long): Flow<List<AssociationEntity>>
}