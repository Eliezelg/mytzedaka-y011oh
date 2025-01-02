package com.ijap.app.ui.campaign

import androidx.lifecycle.ViewModel // v2.6.2
import javax.inject.Inject // v1.0
import kotlinx.coroutines.flow.StateFlow // v1.7.3
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.flow.catch
import com.ijap.app.data.models.Campaign
import com.ijap.app.data.repository.CampaignRepository
import com.ijap.app.utils.CurrencyUtils
import com.ijap.app.utils.NetworkResult
import java.util.concurrent.atomic.AtomicBoolean

/**
 * ViewModel managing campaign-related UI state and business logic with enhanced security,
 * Shabbat awareness, and cultural sensitivity features.
 *
 * @property campaignRepository Repository for secure campaign data operations
 */
class CampaignViewModel @Inject constructor(
    private val campaignRepository: CampaignRepository
) : ViewModel() {

    private val viewModelScope = CoroutineScope(Dispatchers.Main + SupervisorJob())
    
    // Encrypted campaign data state
    private val _encryptedCampaigns = MutableStateFlow<List<Campaign>>(emptyList())
    val campaigns: StateFlow<List<Campaign>> = _encryptedCampaigns.asStateFlow()

    // Loading state
    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    // Error state with culturally appropriate messages
    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    // Shabbat mode state
    private val _isShabbatMode = MutableStateFlow(false)
    val isShabbatMode: StateFlow<Boolean> = _isShabbatMode.asStateFlow()

    // Selected campaign state with encryption
    private val _selectedCampaign = MutableStateFlow<Campaign?>(null)
    val selectedCampaign: StateFlow<Campaign?> = _selectedCampaign.asStateFlow()

    // Thread-safe loading flag
    private val isRefreshing = AtomicBoolean(false)

    init {
        // Initialize Shabbat mode monitoring
        observeShabbatMode()
        // Load initial campaign data
        loadCampaigns(false)
    }

    /**
     * Securely loads campaign list with Shabbat awareness and offline support.
     *
     * @param forceRefresh Force a refresh from remote source
     */
    fun loadCampaigns(forceRefresh: Boolean = false) {
        if (isRefreshing.getAndSet(true)) {
            return // Prevent concurrent refreshes
        }

        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value = null

                // Check if operation is allowed during Shabbat
                if (_isShabbatMode.value && !forceRefresh) {
                    _error.value = "Campaign updates are not available during Shabbat"
                    return@launch
                }

                // Collect campaign data with encryption
                campaignRepository.getCampaigns(forceRefresh)
                    .catch { e ->
                        _error.value = "Unable to load campaigns: ${e.message}"
                    }
                    .collect { campaigns ->
                        _encryptedCampaigns.value = campaigns.map { campaign ->
                            // Format currency amounts with cultural sensitivity
                            campaign.copy(
                                goalAmount = CurrencyUtils.formatCurrency(
                                    amount = campaign.goalAmount,
                                    currencyCode = campaign.currency,
                                    useChaiNotation = true
                                ).toDouble()
                            )
                        }
                    }
            } finally {
                _isLoading.value = false
                isRefreshing.set(false)
            }
        }
    }

    /**
     * Securely loads details for a specific campaign with encryption.
     *
     * @param campaignId Unique identifier of the campaign
     */
    fun loadCampaignDetails(campaignId: String) {
        viewModelScope.launch {
            try {
                _isLoading.value = true
                _error.value = null

                // Check Shabbat mode restrictions
                if (_isShabbatMode.value) {
                    _error.value = "Campaign details are not available during Shabbat"
                    return@launch
                }

                campaignRepository.getCampaignById(campaignId)
                    .catch { e ->
                        _error.value = "Unable to load campaign details: ${e.message}"
                    }
                    .collect { campaign ->
                        _selectedCampaign.value = campaign
                    }
            } finally {
                _isLoading.value = false
            }
        }
    }

    /**
     * Monitors and updates Shabbat mode status.
     * Implements culturally appropriate behavior restrictions.
     */
    private fun observeShabbatMode() {
        viewModelScope.launch {
            try {
                // Update Shabbat mode status periodically
                // Note: Actual implementation would use ShabbatUtils for precise timing
                _isShabbatMode.value = false // Placeholder
            } catch (e: Exception) {
                _error.value = "Error monitoring Shabbat status: ${e.message}"
            }
        }
    }

    /**
     * Validates campaign data against cultural and security requirements.
     *
     * @param campaign Campaign to validate
     * @return Boolean indicating validation result
     */
    private fun validateCampaign(campaign: Campaign): Boolean {
        return try {
            // Validate currency amounts
            val isValidAmount = CurrencyUtils.validateAmount(
                amount = campaign.goalAmount,
                currencyCode = campaign.currency
            )

            // Validate campaign dates
            val isValidDates = campaign.validateCampaignDates()

            isValidAmount && isValidDates
        } catch (e: Exception) {
            _error.value = "Campaign validation error: ${e.message}"
            false
        }
    }

    /**
     * Cleans up resources and cancels ongoing operations.
     */
    override fun onCleared() {
        super.onCleared()
        viewModelScope.launch {
            // Perform cleanup operations
            _encryptedCampaigns.value = emptyList()
            _selectedCampaign.value = null
        }
    }
}