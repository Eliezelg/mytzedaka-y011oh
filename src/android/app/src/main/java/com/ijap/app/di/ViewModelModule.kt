package com.ijap.app.di

import dagger.Module // v2.48
import dagger.Provides // v2.48
import dagger.hilt.InstallIn // v2.48
import dagger.hilt.android.components.ViewModelComponent // v2.48
import com.ijap.app.data.repository.AssociationRepository
import com.ijap.app.data.repository.CampaignRepository
import com.ijap.app.data.repository.DonationRepository
import com.ijap.app.ui.viewmodels.AssociationViewModel
import com.ijap.app.ui.viewmodels.CampaignViewModel
import com.ijap.app.ui.viewmodels.DonationViewModel
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.CurrencyUtils
import javax.inject.Singleton

/**
 * Dagger Hilt module providing secure ViewModel dependencies with comprehensive
 * cultural awareness and offline support for the IJAP Android application.
 *
 * Features:
 * - Secure data handling with field-level encryption
 * - Offline-first architecture support
 * - Cultural considerations (Shabbat mode, Hebrew text)
 * - Multi-currency support with chai amount validation
 */
@Module
@InstallIn(ViewModelComponent::class)
object ViewModelModule {

    /**
     * Provides AssociationViewModel with secure data handling and offline support.
     * Implements comprehensive cultural considerations for Jewish associations.
     *
     * @param repository Secure repository for association data
     * @return AssociationViewModel instance with security and cultural awareness
     */
    @Provides
    fun provideAssociationViewModel(
        repository: AssociationRepository
    ): AssociationViewModel {
        return AssociationViewModel(
            associationRepository = repository,
            securityUtils = SecurityUtils,
            currencyUtils = CurrencyUtils
        ).apply {
            // Initialize offline data support
            initializeOfflineSupport()
            
            // Configure Hebrew text support
            configureRTLSupport()
            
            // Enable Shabbat mode handling
            enableShabbatMode()
        }
    }

    /**
     * Provides CampaignViewModel with secure campaign management and lottery support.
     * Implements comprehensive validation for donation campaigns.
     *
     * @param repository Secure repository for campaign data
     * @return CampaignViewModel instance with security and cultural features
     */
    @Provides
    fun provideCampaignViewModel(
        repository: CampaignRepository
    ): CampaignViewModel {
        return CampaignViewModel(
            campaignRepository = repository,
            securityUtils = SecurityUtils,
            currencyUtils = CurrencyUtils
        ).apply {
            // Initialize offline campaign data
            initializeOfflineData()
            
            // Configure cultural settings
            configureCulturalSupport()
            
            // Enable campaign validation
            enableCampaignValidation()
            
            // Configure lottery support
            configureLotterySupport()
        }
    }

    /**
     * Provides DonationViewModel with secure payment processing and cultural validation.
     * Implements comprehensive support for Jewish charitable giving practices.
     *
     * @param repository Secure repository for donation data
     * @return DonationViewModel instance with security and cultural features
     */
    @Provides
    fun provideDonationViewModel(
        repository: DonationRepository
    ): DonationViewModel {
        return DonationViewModel(
            donationRepository = repository,
            securityUtils = SecurityUtils,
            currencyUtils = CurrencyUtils
        ).apply {
            // Initialize offline donation data
            initializeOfflineSupport()
            
            // Configure chai amount validation
            enableChaiAmountValidation()
            
            // Enable secure payment processing
            configureSecurePayments()
            
            // Configure Shabbat-compliant processing
            enableShabbatCompliance()
        }
    }
}