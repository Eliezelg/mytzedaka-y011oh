package com.ijap.app

import android.app.Application
import androidx.security.crypto.EncryptedSharedPreferences // v1.1.0
import com.ijap.app.di.AppModule
import com.ijap.app.di.DatabaseModule
import com.ijap.app.utils.LocaleUtils
import com.ijap.app.utils.SecurityUtils
import dagger.hilt.android.HiltAndroidApp
import timber.log.Timber // v5.0.1
import javax.inject.Inject
import java.util.Locale
import android.content.Context
import android.content.res.Configuration
import com.google.firebase.crashlytics.FirebaseCrashlytics // v18.4.3
import com.google.firebase.analytics.FirebaseAnalytics // v21.3.0
import com.ijap.app.utils.Constants

/**
 * Primary Application class for the International Jewish Association Donation Platform.
 * Implements comprehensive initialization with security, localization, and monitoring features.
 *
 * Features:
 * - Dagger Hilt dependency injection
 * - Multi-language support (Hebrew, English, French)
 * - Secure data management
 * - Performance monitoring
 * - Cultural considerations
 *
 * @version 1.0.0
 */
@HiltAndroidApp
class IJAPApplication : Application() {

    @Inject
    lateinit var localeUtils: LocaleUtils

    @Inject
    lateinit var securityUtils: SecurityUtils

    @Inject
    lateinit var encryptedSharedPreferences: EncryptedSharedPreferences

    private lateinit var crashlytics: FirebaseCrashlytics
    private lateinit var analytics: FirebaseAnalytics

    override fun onCreate() {
        super.onCreate()
        initializeApplication()
    }

    /**
     * Comprehensive application initialization with security and cultural considerations
     */
    private fun initializeApplication() {
        // Initialize logging for debug builds only
        if (BuildConfig.DEBUG) {
            Timber.plant(object : Timber.DebugTree() {
                override fun createStackElementTag(element: StackTraceElement): String {
                    return "IJAP_${super.createStackElementTag(element)}"
                }
            })
        }

        // Initialize crash reporting and analytics
        initializeMonitoring()

        // Initialize secure preferences
        initializeSecurePreferences()

        // Initialize localization
        initializeLocalization()

        // Initialize database with encryption
        initializeSecureDatabase()

        // Initialize performance monitoring
        initializePerformanceMonitoring()

        // Log application start with security audit
        logApplicationStart()
    }

    /**
     * Initializes secure shared preferences with encryption
     */
    private fun initializeSecurePreferences() {
        try {
            // Migrate any existing preferences to encrypted storage
            val regularPrefs = getSharedPreferences(Constants.SHARED_PREFS_NAME, Context.MODE_PRIVATE)
            if (regularPrefs.all.isNotEmpty()) {
                val editor = encryptedSharedPreferences.edit()
                regularPrefs.all.forEach { (key, value) ->
                    when (value) {
                        is String -> editor.putString(key, value)
                        is Boolean -> editor.putBoolean(key, value)
                        is Int -> editor.putInt(key, value)
                        is Long -> editor.putLong(key, value)
                        is Float -> editor.putFloat(key, value)
                    }
                }
                editor.apply()
                regularPrefs.edit().clear().apply()
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to initialize secure preferences")
            crashlytics.recordException(e)
        }
    }

    /**
     * Initializes localization with RTL support and cultural considerations
     */
    private fun initializeLocalization() {
        try {
            val savedLanguage = encryptedSharedPreferences.getString(
                Constants.PREF_LANGUAGE,
                Constants.DEFAULT_LANGUAGE
            ) ?: Constants.DEFAULT_LANGUAGE

            if (localeUtils.isLanguageSupported(savedLanguage)) {
                updateLocale(savedLanguage)
            } else {
                updateLocale(Constants.DEFAULT_LANGUAGE)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to initialize localization")
            crashlytics.recordException(e)
            // Fallback to default language
            updateLocale(Constants.DEFAULT_LANGUAGE)
        }
    }

    /**
     * Initializes secure database with encryption and cultural support
     */
    private fun initializeSecureDatabase() {
        try {
            // Database initialization is handled by Hilt
            // Additional security checks and cultural configurations
            val databaseConfig = DatabaseModule.provideAppDatabase(this)
            databaseConfig.openHelper.writableDatabase.apply {
                execSQL("PRAGMA encoding = 'UTF-8'") // Support for Hebrew text
                execSQL("PRAGMA journal_mode = WAL") // Write-Ahead Logging
                execSQL("PRAGMA foreign_keys = ON") // Referential integrity
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to initialize secure database")
            crashlytics.recordException(e)
        }
    }

    /**
     * Initializes crash reporting and analytics with privacy considerations
     */
    private fun initializeMonitoring() {
        crashlytics = FirebaseCrashlytics.getInstance().apply {
            setCrashlyticsCollectionEnabled(!BuildConfig.DEBUG)
            setCustomKey("app_version", BuildConfig.VERSION_NAME)
            setCustomKey("build_type", BuildConfig.BUILD_TYPE)
        }

        analytics = FirebaseAnalytics.getInstance(this).apply {
            setAnalyticsCollectionEnabled(!BuildConfig.DEBUG)
            setUserProperty("app_version", BuildConfig.VERSION_NAME)
        }
    }

    /**
     * Initializes performance monitoring with cultural considerations
     */
    private fun initializePerformanceMonitoring() {
        // Initialize performance monitoring with Shabbat-aware tracking
        val currentTime = System.currentTimeMillis()
        analytics.setUserProperty("performance_tracking_enabled", 
            (!isShabbatTime(currentTime)).toString())
    }

    /**
     * Handles configuration changes including language switches
     */
    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        
        // Update RTL layout direction
        val currentLocale = localeUtils.getCurrentLocale(this)
        if (currentLocale.language == "he") {
            newConfig.setLayoutDirection(Locale("he"))
        }

        // Update cultural preferences
        updateCulturalPreferences(currentLocale)
    }

    /**
     * Updates application locale with proper configuration
     */
    private fun updateLocale(languageCode: String) {
        val context = localeUtils.setLocale(this, languageCode)
        resources.updateConfiguration(context.resources.configuration, 
            context.resources.displayMetrics)
    }

    /**
     * Updates cultural preferences based on locale
     */
    private fun updateCulturalPreferences(locale: Locale) {
        encryptedSharedPreferences.edit().apply {
            putBoolean("rtl_enabled", locale.language == "he")
            putBoolean("shabbat_aware", locale.language == "he")
            putString("date_format", if (locale.language == "he") "hebrew" else "gregorian")
            apply()
        }
    }

    /**
     * Checks if current time is during Shabbat
     */
    private fun isShabbatTime(timestamp: Long): Boolean {
        // Implement Shabbat time checking logic
        // This is a placeholder - actual implementation would use Jewish calendar calculations
        return false
    }

    /**
     * Logs application start with security audit
     */
    private fun logApplicationStart() {
        val securityMetadata = mapOf(
            "app_version" to BuildConfig.VERSION_NAME,
            "build_type" to BuildConfig.BUILD_TYPE,
            "device_id" to SecurityUtils.generateSecureToken(32),
            "startup_time" to System.currentTimeMillis().toString()
        )

        analytics.logEvent("app_start", null)
        Timber.i("Application started with security metadata: $securityMetadata")
    }

    companion object {
        const val TAG = "IJAPApplication"
    }
}