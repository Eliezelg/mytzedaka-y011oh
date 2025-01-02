package com.ijap.app.data.repository

import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.catch
import com.ijap.app.data.models.Campaign
import com.ijap.app.utils.NetworkResult
import com.ijap.app.utils.ShabbatUtils
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.AuditLogger
import java.util.concurrent.TimeUnit

/**
 * Repository implementation for managing campaign data with enhanced security,
 * offline support, and Shabbat-aware operations.
 *
 * @property campaignDao Local database access for campaigns
 * @property apiService Remote API service for campaign data
 * @property securityUtils Utilities for field-level encryption
 * @property auditLogger Security audit logging utility
 * @property shabbatUtils Utilities for Shabbat-aware operations
 */
@Singleton
class CampaignRepository @Inject constructor(
    private val campaignDao: CampaignDao,
    private val apiService: ApiService,
    private val securityUtils: SecurityUtils,
    private val auditLogger: AuditLogger,
    private val shabbatUtils: ShabbatUtils
) {
    private val _campaigns = MutableStateFlow<List<Campaign>>(emptyList())
    private val _selectedCampaign = MutableStateFlow<NetworkResult<Campaign>>(NetworkResult.Loading())
    
    // Cache timeout duration - 15 minutes
    private val CACHE_TIMEOUT_MS = TimeUnit.MINUTES.toMillis(15)
    private var lastFetchTimestamp: Long = 0

    /**
     * Retrieves a list of campaigns with offline support and Shabbat awareness.
     * Implements caching strategy with encryption for sensitive data.
     *
     * @param forceRefresh Force a refresh from remote API
     * @return Flow of encrypted campaign list
     */
    fun getCampaigns(forceRefresh: Boolean = false): Flow<List<Campaign>> {
        return try {
            // Check if operation is allowed during Shabbat
            if (shabbatUtils.isShabbatMode() && !shabbatUtils.isOperationAllowed("READ_CAMPAIGNS")) {
                auditLogger.logEvent(
                    "CAMPAIGN_ACCESS_BLOCKED",
                    "Campaign access blocked during Shabbat"
                )
                return flowOf(emptyList())
            }

            // Determine if cache is valid
            val isCacheValid = System.currentTimeMillis() - lastFetchTimestamp < CACHE_TIMEOUT_MS
            
            if (!forceRefresh && isCacheValid) {
                // Return cached data if valid
                campaignDao.getAllCampaigns()
            } else {
                // Fetch fresh data from API
                val response = apiService.getCampaigns()
                
                if (response.isSuccessful) {
                    val campaigns = response.body()?.map { campaign ->
                        // Encrypt sensitive fields before caching
                        campaign.copy(
                            goalAmount = securityUtils.encryptDouble(campaign.goalAmount),
                            currentAmount = securityUtils.encryptDouble(campaign.currentAmount)
                        )
                    } ?: emptyList()

                    // Update local cache
                    campaignDao.insertAll(campaigns)
                    lastFetchTimestamp = System.currentTimeMillis()

                    // Log successful data refresh
                    auditLogger.logEvent(
                        "CAMPAIGNS_REFRESHED",
                        "Successfully refreshed campaigns data"
                    )

                    campaignDao.getAllCampaigns()
                } else {
                    // Log API error and fall back to cache
                    auditLogger.logEvent(
                        "API_ERROR",
                        "Failed to fetch campaigns: ${response.errorBody()?.string()}"
                    )
                    campaignDao.getAllCampaigns()
                }
            }
        } catch (e: Exception) {
            // Log error and return cached data
            auditLogger.logError(
                "CAMPAIGN_FETCH_ERROR",
                "Error fetching campaigns: ${e.message}"
            )
            campaignDao.getAllCampaigns()
        }.catch { error ->
            // Log any flow collection errors
            auditLogger.logError(
                "CAMPAIGN_FLOW_ERROR",
                "Error in campaigns flow: ${error.message}"
            )
            emit(emptyList())
        }.map { campaigns ->
            // Decrypt sensitive fields before emission
            campaigns.map { campaign ->
                campaign.copy(
                    goalAmount = securityUtils.decryptDouble(campaign.goalAmount),
                    currentAmount = securityUtils.decryptDouble(campaign.currentAmount)
                )
            }
        }
    }

    /**
     * Retrieves a specific campaign by ID with security logging and encryption.
     *
     * @param id Campaign identifier
     * @return Flow of encrypted campaign details
     */
    fun getCampaignById(id: String): Flow<Campaign?> {
        return try {
            // Check Shabbat restrictions
            if (shabbatUtils.isShabbatMode() && !shabbatUtils.isOperationAllowed("READ_CAMPAIGN_DETAILS")) {
                auditLogger.logEvent(
                    "CAMPAIGN_DETAIL_ACCESS_BLOCKED",
                    "Campaign detail access blocked during Shabbat for ID: $id"
                )
                return flowOf(null)
            }

            // Log access attempt
            auditLogger.logEvent(
                "CAMPAIGN_DETAIL_ACCESS",
                "Accessing campaign details for ID: $id"
            )

            campaignDao.getCampaignById(id)
                .map { campaign ->
                    campaign?.let {
                        // Decrypt sensitive fields
                        it.copy(
                            goalAmount = securityUtils.decryptDouble(it.goalAmount),
                            currentAmount = securityUtils.decryptDouble(it.currentAmount)
                        )
                    }
                }
        } catch (e: Exception) {
            // Log error and return null
            auditLogger.logError(
                "CAMPAIGN_DETAIL_ERROR",
                "Error fetching campaign details for ID $id: ${e.message}"
            )
            flowOf(null)
        }
    }

    /**
     * Updates campaign progress with security validation and audit logging.
     *
     * @param campaignId Campaign identifier
     * @param newAmount Updated amount
     * @return Flow of update result
     */
    private suspend fun updateCampaignProgress(
        campaignId: String,
        newAmount: Double
    ): Flow<NetworkResult<Boolean>> {
        return try {
            // Validate operation timing
            if (shabbatUtils.isShabbatMode()) {
                return flowOf(NetworkResult.Error("Operation not allowed during Shabbat"))
            }

            // Encrypt amount before storage
            val encryptedAmount = securityUtils.encryptDouble(newAmount)
            
            // Update local and remote data
            val result = apiService.updateCampaignProgress(campaignId, encryptedAmount)
            if (result.isSuccessful) {
                campaignDao.updateCampaignProgress(campaignId, encryptedAmount)
                
                auditLogger.logEvent(
                    "CAMPAIGN_PROGRESS_UPDATED",
                    "Successfully updated progress for campaign: $campaignId"
                )
                
                flowOf(NetworkResult.Success(true))
            } else {
                flowOf(NetworkResult.Error("Failed to update campaign progress"))
            }
        } catch (e: Exception) {
            auditLogger.logError(
                "CAMPAIGN_UPDATE_ERROR",
                "Error updating campaign progress: ${e.message}"
            )
            flowOf(NetworkResult.Error(e.message ?: "Unknown error"))
        }
    }
}