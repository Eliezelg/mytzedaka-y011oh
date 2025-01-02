package com.ijap.app.di

import com.ijap.app.data.api.ApiService
import com.ijap.app.data.db.dao.AssociationDao
import com.ijap.app.data.db.dao.CampaignDao
import com.ijap.app.data.db.dao.DonationDao
import com.ijap.app.data.db.dao.UserDao
import com.ijap.app.data.repository.AssociationRepository
import com.ijap.app.data.repository.CampaignRepository
import com.ijap.app.data.repository.DonationRepository
import com.ijap.app.data.repository.UserRepository
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.ShabbatUtils
import com.ijap.audit.AuditLogger // v1.0.0
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

/**
 * Dagger Hilt module providing repository dependencies with comprehensive security,
 * cultural awareness, and offline capabilities for the IJAP Android application.
 */
@Module
@InstallIn(SingletonComponent::class)
object RepositoryModule {

    /**
     * Provides singleton instance of AssociationRepository with RTL support
     * and cultural considerations for Jewish charitable associations.
     */
    @Provides
    @Singleton
    fun provideAssociationRepository(
        associationDao: AssociationDao,
        apiService: ApiService,
        securityUtils: SecurityUtils,
        auditLogger: AuditLogger
    ): AssociationRepository {
        return AssociationRepository(
            associationDao = associationDao,
            apiService = apiService,
            securityManager = securityUtils,
            auditLogger = auditLogger
        )
    }

    /**
     * Provides singleton instance of CampaignRepository with Shabbat-aware
     * operations and comprehensive security measures.
     */
    @Provides
    @Singleton
    fun provideCampaignRepository(
        campaignDao: CampaignDao,
        apiService: ApiService,
        securityUtils: SecurityUtils,
        shabbatUtils: ShabbatUtils,
        auditLogger: AuditLogger
    ): CampaignRepository {
        return CampaignRepository(
            campaignDao = campaignDao,
            apiService = apiService,
            securityUtils = securityUtils,
            auditLogger = auditLogger,
            shabbatUtils = shabbatUtils
        )
    }

    /**
     * Provides singleton instance of DonationRepository with multi-currency support
     * and secure payment processing capabilities.
     */
    @Provides
    @Singleton
    fun provideDonationRepository(
        donationDao: DonationDao,
        apiService: ApiService
    ): DonationRepository {
        return DonationRepository(
            donationDao = donationDao,
            apiService = apiService
        )
    }

    /**
     * Provides singleton instance of UserRepository with enhanced security
     * and proper data encryption.
     */
    @Provides
    @Singleton
    fun provideUserRepository(
        userDao: UserDao,
        apiService: ApiService,
        securityUtils: SecurityUtils
    ): UserRepository {
        return UserRepository(
            userDao = userDao,
            apiService = apiService,
            securityUtils = securityUtils
        )
    }
}