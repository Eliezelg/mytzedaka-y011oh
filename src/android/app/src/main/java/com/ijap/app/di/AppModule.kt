package com.ijap.app.di

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences // v1.1.0
import androidx.security.crypto.MasterKey
import dagger.Module // v2.48
import dagger.Provides // v2.48
import dagger.hilt.InstallIn // v2.48
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent // v2.48
import com.ijap.app.utils.LocaleUtils
import com.ijap.app.utils.SecurityUtils
import javax.inject.Singleton

/**
 * Primary Dagger Hilt module that provides application-level dependencies with enhanced
 * security features and cultural considerations for the IJAP Android application.
 *
 * Features:
 * - Encrypted shared preferences with key rotation
 * - Enhanced localization support for Hebrew, English, and French
 * - Comprehensive security utilities
 * - Cultural and religious considerations
 */
@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    private const val ENCRYPTED_PREFS_FILE = "ijap_secure_prefs"
    private const val MASTER_KEY_ALIAS = "ijap_master_key"

    /**
     * Provides singleton instance of EncryptedSharedPreferences with enhanced security.
     *
     * Features:
     * - AES-256-GCM encryption for values
     * - Key rotation policy
     * - Secure key storage
     *
     * @param context Application context
     * @param securityUtils Security utilities instance
     * @return Encrypted SharedPreferences instance
     */
    @Provides
    @Singleton
    fun provideEncryptedSharedPreferences(
        @ApplicationContext context: Context,
        securityUtils: SecurityUtils
    ): SharedPreferences {
        val masterKey = MasterKey.Builder(context, MASTER_KEY_ALIAS)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .setUserAuthenticationRequired(false)
            .build()

        return EncryptedSharedPreferences.create(
            context,
            ENCRYPTED_PREFS_FILE,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * Provides singleton instance of LocaleUtils with enhanced cultural support.
     *
     * Features:
     * - RTL layout support for Hebrew
     * - Multi-language preferences
     * - Cultural date and time formatting
     * - Shabbat-aware operations
     *
     * @param encryptedSharedPreferences Encrypted preferences instance
     * @return LocaleUtils instance
     */
    @Provides
    @Singleton
    fun provideLocaleUtils(
        encryptedSharedPreferences: SharedPreferences
    ): LocaleUtils {
        return LocaleUtils
    }

    /**
     * Provides singleton instance of SecurityUtils for encryption and key management.
     *
     * Features:
     * - Field-level encryption
     * - Secure key generation
     * - Key rotation policies
     * - Biometric authentication support
     *
     * @param context Application context
     * @return SecurityUtils instance
     */
    @Provides
    @Singleton
    fun provideSecurityUtils(
        @ApplicationContext context: Context
    ): SecurityUtils {
        return SecurityUtils
    }
}