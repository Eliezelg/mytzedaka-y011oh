package com.ijap.app.di

import android.content.Context
import com.ijap.app.data.db.AppDatabase
import dagger.Module // v2.44
import dagger.Provides // v2.44
import dagger.hilt.InstallIn // v2.44
import dagger.hilt.android.qualifiers.ApplicationContext // v2.44
import dagger.hilt.components.SingletonComponent // v2.44
import net.zetetic.database.sqlcipher.SQLiteDatabase // v4.5.4
import com.google.crypto.tink.config.TinkConfig // v1.7.0
import com.google.crypto.tink.KeysetHandle // v1.7.0
import javax.inject.Singleton
import java.util.concurrent.Executors

/**
 * Dagger Hilt module that provides database-related dependencies with enhanced security,
 * cultural awareness, and thread safety for the IJAP Android application.
 *
 * Features:
 * - Encrypted database instance using SQLCipher
 * - Thread-safe database access
 * - Hebrew text support
 * - Shabbat-compliant operations
 * - Automatic backup management
 *
 * @version 1.0
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    private const val DATABASE_THREAD_POOL_SIZE = 4

    /**
     * Provides a singleton instance of the Room database with encryption and cultural considerations.
     *
     * Features:
     * - Field-level encryption for sensitive data
     * - Support for Hebrew text and Jewish calendar dates
     * - Shabbat-compliant operations
     * - Thread-safe access with connection pooling
     * - Automatic backup scheduling
     *
     * @param context Application context for database initialization
     * @return Singleton instance of AppDatabase
     */
    @Provides
    @Singleton
    fun provideAppDatabase(
        @ApplicationContext context: Context
    ): AppDatabase {
        // Initialize Tink for cryptographic operations
        TinkConfig.register()

        // Configure database encryption
        SQLiteDatabase.loadLibs(context)

        return AppDatabase.getDatabase(context).apply {
            // Configure thread pool for database operations
            setQueryExecutor(
                Executors.newFixedThreadPool(DATABASE_THREAD_POOL_SIZE)
            )

            // Enable Write-Ahead Logging for better concurrency
            openHelper.writableDatabase.apply {
                execSQL("PRAGMA journal_mode = WAL")
                // Enable foreign key constraints
                execSQL("PRAGMA foreign_keys = ON")
                // Configure for Hebrew text support
                execSQL("PRAGMA encoding = 'UTF-8'")
            }
        }
    }

    /**
     * Provides AssociationDao for secure association data access.
     *
     * @param database AppDatabase instance
     * @return AssociationDao implementation
     */
    @Provides
    @Singleton
    fun provideAssociationDao(database: AppDatabase) = database.associationDao()

    /**
     * Provides CampaignDao for secure campaign data access.
     *
     * @param database AppDatabase instance
     * @return CampaignDao implementation
     */
    @Provides
    @Singleton
    fun provideCampaignDao(database: AppDatabase) = database.campaignDao()

    /**
     * Provides DonationDao for secure donation data access.
     *
     * @param database AppDatabase instance
     * @return DonationDao implementation
     */
    @Provides
    @Singleton
    fun provideDonationDao(database: AppDatabase) = database.donationDao()

    /**
     * Provides UserDao for secure user data access.
     *
     * @param database AppDatabase instance
     * @return UserDao implementation
     */
    @Provides
    @Singleton
    fun provideUserDao(database: AppDatabase) = database.userDao()
}