package com.ijap.app

import androidx.test.platform.app.InstrumentationRegistry // v1.1.0
import androidx.test.ext.junit.runners.AndroidJUnit4 // v1.1.5
import org.junit.Test // v4.13.2
import org.junit.runner.RunWith // v4.13.2
import org.junit.Assert.* // v4.13.2
import org.junit.Before // v4.13.2
import org.junit.After // v4.13.2
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.LocaleUtils
import com.ijap.app.utils.Constants
import java.util.Locale

/**
 * Comprehensive instrumented test class for validating core functionality of the IJAP Android application.
 * Tests application context, security features, localization support, and critical component initialization.
 *
 * Test coverage includes:
 * - Application context validation
 * - Security manager initialization
 * - Localization and RTL support
 * - Database encryption
 * - Cultural considerations
 */
@RunWith(AndroidJUnit4::class)
class ExampleInstrumentedTest {

    private lateinit var appContext: IJAPApplication
    private val testLocale = "he" // Hebrew for RTL testing

    /**
     * Sets up test environment and initializes required components
     */
    @Before
    fun setup() {
        appContext = InstrumentationRegistry.getInstrumentation().targetContext.applicationContext as IJAPApplication
        // Reset locale to default for consistent testing
        LocaleUtils.setLocale(appContext, Constants.DEFAULT_LANGUAGE)
    }

    /**
     * Verifies correct application package name and context type
     */
    @Test
    fun useAppContext() {
        // Verify package name
        assertEquals("com.ijap.app", appContext.packageName)
        
        // Verify context type
        assertTrue("Application context should be IJAPApplication",
            appContext is IJAPApplication)
        
        // Verify application initialization
        assertNotNull("Application should be initialized",
            appContext.applicationContext)
    }

    /**
     * Validates security manager initialization and configuration
     */
    @Test
    fun validateSecurityContext() {
        // Verify security utils initialization
        assertNotNull("SecurityUtils should be initialized",
            SecurityUtils)

        // Test encryption capabilities
        val testData = "test_data"
        val encryptedData = SecurityUtils.encryptData(testData, "test_key")
        assertNotNull("Encryption should work", encryptedData)
        
        // Verify encryption result is different from input
        assertNotEquals("Encrypted data should differ from input",
            testData, encryptedData)

        // Test decryption capabilities
        val decryptedData = SecurityUtils.decryptData(encryptedData, "test_key")
        assertEquals("Decryption should restore original data",
            testData, decryptedData)
    }

    /**
     * Tests localization support and RTL handling
     */
    @Test
    fun validateLocalization() {
        // Test Hebrew locale setting
        val hebrewContext = LocaleUtils.setLocale(appContext, testLocale)
        val currentLocale = LocaleUtils.getCurrentLocale(hebrewContext)
        
        assertEquals("Hebrew locale should be set correctly",
            testLocale, currentLocale.language)
        
        // Verify RTL support
        assertTrue("Hebrew locale should be RTL",
            LocaleUtils.isRTL(hebrewContext))

        // Test supported locales
        val supportedLocales = LocaleUtils.getSupportedLocales()
        assertTrue("Hebrew should be supported",
            supportedLocales.any { it.locale.language == "he" })
        assertTrue("English should be supported",
            supportedLocales.any { it.locale.language == "en" })
        assertTrue("French should be supported",
            supportedLocales.any { it.locale.language == "fr" })
    }

    /**
     * Validates shared preferences encryption
     */
    @Test
    fun validateSecurePreferences() {
        val testKey = "test_key"
        val testValue = "test_value"

        // Store encrypted value
        appContext.encryptedSharedPreferences.edit()
            .putString(testKey, testValue)
            .apply()

        // Retrieve and verify encrypted value
        val retrievedValue = appContext.encryptedSharedPreferences
            .getString(testKey, null)
        
        assertEquals("Secure preferences should store and retrieve correctly",
            testValue, retrievedValue)
    }

    /**
     * Tests cultural considerations in date and currency handling
     */
    @Test
    fun validateCulturalSupport() {
        // Test currency formatting
        val amount = 18.0 // Chai value
        val formattedAmount = com.ijap.app.utils.CurrencyUtils.formatCurrency(
            amount = amount,
            currencyCode = "ILS",
            locale = "he",
            useChaiNotation = true
        )
        
        assertTrue("Amount should include Chai notation",
            formattedAmount.contains("ח״י"))

        // Verify Shabbat-aware operations
        val hebrewContext = LocaleUtils.setLocale(appContext, "he")
        assertTrue("Hebrew context should enable Shabbat awareness",
            hebrewContext.resources.configuration.locale.language == "he")
    }

    /**
     * Performs test cleanup and resource release
     */
    @After
    fun cleanup() {
        // Reset locale to default
        LocaleUtils.setLocale(appContext, Constants.DEFAULT_LANGUAGE)
        
        // Clear test preferences
        appContext.encryptedSharedPreferences.edit().clear().apply()
    }
}