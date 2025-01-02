package com.ijap.app.data.repository

import com.ijap.app.data.models.Association
import com.ijap.app.data.db.dao.AssociationDao
import com.ijap.app.data.db.entities.AssociationEntity
import com.ijap.audit.AuditLogger // v1.0.0
import com.ijap.security.SecurityManager // v1.0.0
import javax.inject.Inject // v1.0
import javax.inject.Singleton // v1.0
import kotlinx.coroutines.flow.* // v1.7.3
import kotlinx.coroutines.withContext
import kotlinx.coroutines.CoroutineDispatcher
import kotlinx.coroutines.Dispatchers
import java.util.Locale
import java.util.concurrent.TimeUnit

/**
 * Repository implementation for managing Jewish charitable associations with enhanced security,
 * offline-first architecture, and cultural considerations.
 *
 * Features:
 * - Field-level encryption for sensitive data
 * - Offline-first with intelligent caching
 * - Multi-language support (Hebrew, English, French)
 * - Audit logging for compliance
 * - RTL text handling
 */
@Singleton
class AssociationRepository @Inject constructor(
    private val associationDao: AssociationDao,
    private val apiService: ApiService,
    private val securityManager: SecurityManager,
    private val auditLogger: AuditLogger,
    private val dispatcher: CoroutineDispatcher = Dispatchers.IO
) {
    companion object {
        private const val CACHE_DURATION_HOURS = 24L
        private const val MAX_RETRY_ATTEMPTS = 3
        private const val BATCH_SIZE = 50
    }

    private val _associations = MutableStateFlow<List<Association>>(emptyList())
    val associations: StateFlow<List<Association>> = _associations.asStateFlow()

    private val _networkState = MutableStateFlow(NetworkState.IDLE)
    val networkState: StateFlow<NetworkState> = _networkState.asStateFlow()

    private val cacheTimestamp = MutableStateFlow(0L)

    init {
        // Initialize security context and audit logging
        securityManager.initialize(SecurityConfig.ASSOCIATION_CONTEXT)
        auditLogger.configure(AuditConfig.REPOSITORY_LEVEL)
    }

    /**
     * Retrieves associations with encryption, caching, and locale support.
     *
     * @param forceRefresh Force remote data fetch
     * @param locale Current locale for proper text handling
     * @return Flow of encrypted associations
     */
    suspend fun getAssociations(
        forceRefresh: Boolean = false,
        locale: Locale = Locale.getDefault()
    ): Flow<List<Association>> = withContext(dispatcher) {
        return@withContext flow {
            try {
                // Check cache validity
                val isCacheValid = System.currentTimeMillis() - cacheTimestamp.value < 
                    TimeUnit.HOURS.toMillis(CACHE_DURATION_HOURS)

                if (!forceRefresh && isCacheValid) {
                    emitAll(associationDao.getAllAssociations()
                        .map { entities -> 
                            entities.map { 
                                securityManager.decryptAssociation(it.toAssociation()) 
                            }
                        }
                    )
                } else {
                    _networkState.value = NetworkState.LOADING
                    
                    // Fetch from remote with retry
                    val remoteAssociations = retry(MAX_RETRY_ATTEMPTS) {
                        apiService.getAssociations(locale.language)
                    }

                    // Process in batches to avoid memory pressure
                    remoteAssociations.chunked(BATCH_SIZE).forEach { batch ->
                        val encryptedBatch = batch.map { association ->
                            securityManager.encryptAssociation(association)
                        }
                        
                        // Update local database
                        associationDao.insertAssociation(
                            AssociationEntity.fromAssociation(encryptedBatch)
                        )
                        
                        auditLogger.log(
                            AuditEvent.DATA_SYNC,
                            "Synced ${batch.size} associations"
                        )
                    }

                    cacheTimestamp.value = System.currentTimeMillis()
                    _networkState.value = NetworkState.IDLE

                    emitAll(associationDao.getAllAssociations()
                        .map { entities -> 
                            entities.map { it.toAssociation() }
                        }
                    )
                }
            } catch (e: Exception) {
                _networkState.value = NetworkState.ERROR
                auditLogger.logError(
                    AuditEvent.SYNC_ERROR,
                    "Failed to sync associations: ${e.message}"
                )
                throw RepositoryException("Failed to fetch associations", e)
            }
        }
    }

    /**
     * Searches associations with locale-aware text handling.
     *
     * @param query Search query
     * @param locale Current locale for RTL support
     * @return Flow of matching associations
     */
    suspend fun searchAssociations(
        query: String,
        locale: Locale = Locale.getDefault()
    ): Flow<List<Association>> = withContext(dispatcher) {
        return@withContext flow {
            try {
                // Sanitize and validate query
                val sanitizedQuery = securityManager.sanitizeInput(query)
                require(sanitizedQuery.length >= 2) { 
                    "Search query must be at least 2 characters" 
                }

                // Apply locale-specific search rules
                val searchFlow = if (locale.language == "he") {
                    // RTL-aware search for Hebrew
                    associationDao.searchAssociationsByLocale(
                        sanitizedQuery.reversed(),
                        locale.language
                    )
                } else {
                    associationDao.searchAssociations(sanitizedQuery)
                }

                emitAll(searchFlow.map { entities ->
                    entities.map { 
                        securityManager.decryptAssociation(it.toAssociation()) 
                    }
                })

                auditLogger.log(
                    AuditEvent.SEARCH,
                    "Search performed: $sanitizedQuery"
                )
            } catch (e: Exception) {
                auditLogger.logError(
                    AuditEvent.SEARCH_ERROR,
                    "Search failed: ${e.message}"
                )
                throw RepositoryException("Failed to search associations", e)
            }
        }
    }

    /**
     * Updates an association with security validation.
     *
     * @param association Association to update
     * @return Flow indicating update status
     */
    suspend fun updateAssociation(association: Association): Flow<Boolean> = 
        withContext(dispatcher) {
            return@withContext flow {
                try {
                    // Validate and encrypt sensitive fields
                    securityManager.validateAssociation(association)
                    val encryptedAssociation = securityManager.encryptAssociation(association)
                    
                    // Update local database
                    val updateResult = associationDao.updateAssociation(
                        AssociationEntity.fromAssociation(encryptedAssociation)
                    )

                    // Sync with remote
                    if (updateResult > 0) {
                        apiService.updateAssociation(encryptedAssociation)
                        auditLogger.log(
                            AuditEvent.UPDATE,
                            "Association updated: ${association.id}"
                        )
                    }

                    emit(updateResult > 0)
                } catch (e: Exception) {
                    auditLogger.logError(
                        AuditEvent.UPDATE_ERROR,
                        "Update failed: ${e.message}"
                    )
                    throw RepositoryException("Failed to update association", e)
                }
            }
        }

    private suspend fun <T> retry(
        maxAttempts: Int,
        block: suspend () -> T
    ): T {
        var lastException: Exception? = null
        repeat(maxAttempts) { attempt ->
            try {
                return block()
            } catch (e: Exception) {
                lastException = e
                if (attempt == maxAttempts - 1) throw e
                delay(TimeUnit.SECONDS.toMillis(attempt.toLong()))
            }
        }
        throw lastException ?: IllegalStateException("Retry failed")
    }
}

sealed class NetworkState {
    object IDLE : NetworkState()
    object LOADING : NetworkState()
    object ERROR : NetworkState()
}

class RepositoryException(
    message: String,
    cause: Throwable? = null
) : Exception(message, cause)