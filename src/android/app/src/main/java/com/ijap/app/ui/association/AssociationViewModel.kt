package com.ijap.app.ui.association

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.perf.FirebasePerformance // v20.4.1
import com.google.firebase.perf.metrics.Trace
import com.ijap.app.data.models.Association
import com.ijap.app.data.repository.AssociationRepository
import com.ijap.app.data.repository.NetworkState
import com.ijap.app.util.LocaleManager
import com.ijap.app.util.PerformanceTracker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.*
import kotlinx.coroutines.launch
import timber.log.Timber // v5.0.1
import java.util.Locale
import javax.inject.Inject

/**
 * ViewModel for managing association-related UI state and business logic.
 * Implements performance monitoring, offline support, and multi-language capabilities.
 */
@HiltViewModel
class AssociationViewModel @Inject constructor(
    private val associationRepository: AssociationRepository,
    private val localeManager: LocaleManager,
    private val performanceTracker: PerformanceTracker
) : ViewModel() {

    companion object {
        private const val SEARCH_DEBOUNCE_MS = 300L
        private const val PAGE_SIZE = 20
        private const val PERFORMANCE_TRACE_NAME = "association_load"
    }

    // UI State
    private val _uiState = MutableStateFlow<UiState>(UiState.Initial)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()

    // Associations data with pagination support
    private val _associations = MutableStateFlow(PaginatedList<Association>())
    val associations: StateFlow<PaginatedList<Association>> = _associations.asStateFlow()

    // Selected association for details view
    private val _selectedAssociation = MutableStateFlow<Association?>(null)
    val selectedAssociation: StateFlow<Association?> = _selectedAssociation.asStateFlow()

    // Current language for localization
    private val _currentLanguage = MutableStateFlow(localeManager.getCurrentLanguage())
    val currentLanguage: StateFlow<String> = _currentLanguage.asStateFlow()

    // Search handling
    private var searchJob: Job? = null
    private var loadingTrace: Trace? = null

    init {
        viewModelScope.launch {
            // Monitor network state changes
            associationRepository.networkState.collect { state ->
                when (state) {
                    is NetworkState.LOADING -> _uiState.value = UiState.Loading
                    is NetworkState.ERROR -> _uiState.value = UiState.Error("Failed to load associations")
                    else -> Unit
                }
            }
        }
        
        // Initial data load
        loadAssociations(forceRefresh = false)
    }

    /**
     * Loads associations with pagination support and performance monitoring.
     */
    fun loadAssociations(forceRefresh: Boolean = false, page: Int = 1) {
        viewModelScope.launch {
            try {
                loadingTrace = performanceTracker.startTrace(PERFORMANCE_TRACE_NAME)
                _uiState.value = UiState.Loading

                val locale = Locale(currentLanguage.value)
                associationRepository.getAssociations(forceRefresh, locale)
                    .catch { e ->
                        Timber.e(e, "Failed to load associations")
                        _uiState.value = UiState.Error(e.message ?: "Unknown error")
                    }
                    .collect { associationList ->
                        val startIndex = (page - 1) * PAGE_SIZE
                        val endIndex = minOf(startIndex + PAGE_SIZE, associationList.size)
                        
                        _associations.value = PaginatedList(
                            items = associationList.subList(startIndex, endIndex),
                            totalItems = associationList.size,
                            currentPage = page,
                            hasNextPage = endIndex < associationList.size
                        )
                        _uiState.value = UiState.Success
                    }
            } finally {
                loadingTrace?.stop()
            }
        }
    }

    /**
     * Performs debounced search with language support.
     */
    fun searchAssociations(query: String) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            try {
                delay(SEARCH_DEBOUNCE_MS)
                _uiState.value = UiState.Loading

                val locale = Locale(currentLanguage.value)
                associationRepository.searchAssociations(query, locale)
                    .catch { e ->
                        Timber.e(e, "Search failed: $query")
                        _uiState.value = UiState.Error("Search failed")
                    }
                    .collect { results ->
                        _associations.value = PaginatedList(
                            items = results,
                            totalItems = results.size,
                            currentPage = 1,
                            hasNextPage = false
                        )
                        _uiState.value = UiState.Success
                    }
            } catch (e: Exception) {
                Timber.e(e, "Search error")
                _uiState.value = UiState.Error("Search failed")
            }
        }
    }

    /**
     * Updates selected association for details view.
     */
    fun selectAssociation(association: Association) {
        _selectedAssociation.value = association
    }

    /**
     * Updates current language and refreshes data.
     */
    fun updateLanguage(languageCode: String) {
        viewModelScope.launch {
            try {
                _currentLanguage.value = languageCode
                localeManager.setLanguage(languageCode)
                loadAssociations(forceRefresh = true)
            } catch (e: Exception) {
                Timber.e(e, "Language update failed")
                _uiState.value = UiState.Error("Failed to update language")
            }
        }
    }

    /**
     * Clears selected association.
     */
    fun clearSelection() {
        _selectedAssociation.value = null
    }

    override fun onCleared() {
        super.onCleared()
        searchJob?.cancel()
        loadingTrace?.stop()
    }
}

/**
 * Represents the UI state for association-related screens.
 */
sealed class UiState {
    object Initial : UiState()
    object Loading : UiState()
    object Success : UiState()
    data class Error(val message: String) : UiState()
}

/**
 * Data class for handling paginated lists of associations.
 */
data class PaginatedList<T>(
    val items: List<T> = emptyList(),
    val totalItems: Int = 0,
    val currentPage: Int = 1,
    val hasNextPage: Boolean = false
)