/**
 * Constants used throughout the IJAP Android application.
 * Version: 1.0.0
 * 
 * Contains configuration values, API endpoints, security settings, and other
 * platform-specific constants. All values are immutable and follow security
 * best practices for the International Jewish Association Donation Platform.
 */
package com.ijap.app.utils

/**
 * Primary constants object containing core application configuration values.
 * All constants are immutable and follow strict security guidelines.
 */
object Constants {
    // API Configuration
    const val API_VERSION = "v1"
    const val DATABASE_VERSION = 1
    
    // SharedPreferences Keys
    const val SHARED_PREFS_NAME = "ijap_preferences"
    const val PREF_AUTH_TOKEN = "auth_token"
    const val PREF_REFRESH_TOKEN = "refresh_token"
    const val PREF_USER_ID = "user_id"
    const val PREF_LANGUAGE = "language"
    const val PREF_CURRENCY = "currency"
    
    // Default Values
    const val DEFAULT_LANGUAGE = "en"
    const val DEFAULT_CURRENCY = "USD"
    
    // Security Configuration
    const val MIN_PASSWORD_LENGTH = 8
    const val MAX_PASSWORD_LENGTH = 32
    const val ENCRYPTION_ALGORITHM = "AES/GCM/NoPadding"
    const val KEY_SIZE_BITS = 256
    const val IV_LENGTH_BYTES = 12
    
    // Network Configuration
    const val REQUEST_TIMEOUT_SECONDS = 30L
    const val MAX_RETRY_ATTEMPTS = 3
    const val RETRY_DELAY_MS = 1000L
    
    // Cache Configuration
    const val CACHE_SIZE_MB = 10
    const val CACHE_EXPIRY_HOURS = 48
    const val MAX_CACHE_ENTRIES = 1000
    
    // Token Configuration
    const val TOKEN_EXPIRY_HOURS = 24
    
    // Database Configuration
    const val DATABASE_NAME = "ijap_database"
    
    private constructor() {
        // Private constructor to prevent instantiation
    }
}

/**
 * API endpoint constants for network requests.
 * All endpoints are relative to the base URL and version.
 */
object ApiEndpoints {
    // Authentication Endpoints
    const val AUTH = "/auth"
    const val LOGIN = "/auth/login"
    const val REGISTER = "/auth/register"
    const val TWO_FACTOR = "/auth/2fa"
    
    // Resource Endpoints
    const val ASSOCIATIONS = "/associations"
    const val CAMPAIGNS = "/campaigns"
    const val DONATIONS = "/donations"
    const val USERS = "/users"
    
    private constructor() {
        // Private constructor to prevent instantiation
    }
}