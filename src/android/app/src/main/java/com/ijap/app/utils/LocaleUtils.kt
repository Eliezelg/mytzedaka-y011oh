package com.ijap.app.utils

import android.content.Context
import android.content.res.Configuration
import android.os.Build
import android.os.LocaleList
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import com.ijap.app.utils.Constants.PREF_LANGUAGE
import com.ijap.app.utils.Constants.DEFAULT_LANGUAGE

/**
 * Utility class providing comprehensive locale and language management for the IJAP Android application.
 * Supports Hebrew, English, and French with enhanced RTL capabilities and performance optimizations.
 *
 * @version 1.0.0
 */
object LocaleUtils {
    private const val HEBREW_LANG_CODE = "he"
    private const val ENGLISH_LANG_CODE = "en"
    private const val FRENCH_LANG_CODE = "fr"

    // Thread-safe cache for locale and RTL information
    private val localeCache = ConcurrentHashMap<String, Locale>()
    private val rtlCache = ConcurrentHashMap<String, Boolean>()

    /**
     * Data class representing locale information with display names
     */
    data class LocaleInfo(
        val locale: Locale,
        val displayName: String,
        val nativeName: String
    )

    /**
     * Sets and persists the application locale with enhanced configuration management.
     *
     * @param context Android context
     * @param languageCode ISO 639-1 language code
     * @return Updated context with new locale configuration
     */
    fun setLocale(context: Context, languageCode: String): Context {
        // Validate language code
        require(languageCode in listOf(HEBREW_LANG_CODE, ENGLISH_LANG_CODE, FRENCH_LANG_CODE)) {
            "Unsupported language code: $languageCode"
        }

        val locale = Locale(languageCode)
        Locale.setDefault(locale)

        // Update configuration based on API level
        val config = Configuration(context.resources.configuration)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            val localeList = LocaleList(locale)
            LocaleList.setDefault(localeList)
            config.setLocales(localeList)
        } else {
            @Suppress("DEPRECATION")
            config.locale = locale
        }

        // Update context configuration
        val updatedContext = context.createConfigurationContext(config)
        
        // Persist locale preference
        context.getSharedPreferences(Constants.SHARED_PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_LANGUAGE, languageCode)
            .apply()

        // Clear caches
        localeCache.clear()
        rtlCache.clear()

        return updatedContext
    }

    /**
     * Retrieves the current locale with caching optimization.
     *
     * @param context Android context
     * @return Current application locale
     */
    fun getCurrentLocale(context: Context): Locale {
        val config = context.resources.configuration
        return when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.N -> {
                val localeList = config.locales
                if (!localeList.isEmpty) localeList.get(0) else getDefaultLocale()
            }
            else -> {
                @Suppress("DEPRECATION")
                config.locale ?: getDefaultLocale()
            }
        }
    }

    /**
     * Enhanced RTL detection with comprehensive language support.
     *
     * @param context Android context
     * @return True if the current locale uses RTL script direction
     */
    fun isRTL(context: Context): Boolean {
        val locale = getCurrentLocale(context)
        return rtlCache.getOrPut(locale.language) {
            when (locale.language) {
                HEBREW_LANG_CODE -> true
                else -> {
                    val firstChar = locale.displayName.firstOrNull() ?: return false
                    Character.getDirectionality(firstChar) == Character.DIRECTIONALITY_RIGHT_TO_LEFT
                }
            }
        }
    }

    /**
     * Returns enhanced list of supported locales with display names.
     *
     * @return List of supported locales with display information
     */
    fun getSupportedLocales(): List<LocaleInfo> {
        return listOf(
            Locale(ENGLISH_LANG_CODE),
            Locale(HEBREW_LANG_CODE),
            Locale(FRENCH_LANG_CODE)
        ).map { locale ->
            LocaleInfo(
                locale = locale,
                displayName = locale.getDisplayLanguage(Locale.ENGLISH),
                nativeName = locale.getDisplayLanguage(locale)
            )
        }.sortedBy { it.displayName }
    }

    /**
     * Returns the default locale for the application.
     *
     * @return Default locale instance
     */
    private fun getDefaultLocale(): Locale {
        return localeCache.getOrPut(DEFAULT_LANGUAGE) {
            Locale(DEFAULT_LANGUAGE)
        }
    }

    /**
     * Checks if the provided language code is supported.
     *
     * @param languageCode ISO 639-1 language code
     * @return True if the language is supported
     */
    fun isLanguageSupported(languageCode: String): Boolean {
        return languageCode in listOf(HEBREW_LANG_CODE, ENGLISH_LANG_CODE, FRENCH_LANG_CODE)
    }

    /**
     * Gets the current language code from SharedPreferences.
     *
     * @param context Android context
     * @return Current language code or default language
     */
    fun getCurrentLanguageCode(context: Context): String {
        return context.getSharedPreferences(Constants.SHARED_PREFS_NAME, Context.MODE_PRIVATE)
            .getString(PREF_LANGUAGE, DEFAULT_LANGUAGE) ?: DEFAULT_LANGUAGE
    }
}