/**
 * @fileoverview Centralized configuration constants for the web application
 * @version 1.0.0
 */

/**
 * API configuration settings
 */
export const API_CONFIG = {
  BASE_URL: process.env.REACT_APP_API_URL,
  API_VERSION: 'v1',
  TIMEOUT: 30000, // 30 seconds
} as const;

/**
 * API endpoint paths structured by domain
 */
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
  },
  DONATIONS: {
    CREATE: '/donations',
    LIST: '/donations',
    DETAIL: '/donations/:id',
    RECEIPT: '/donations/:id/receipt',
  },
  CAMPAIGNS: {
    CREATE: '/campaigns',
    LIST: '/campaigns',
    DETAIL: '/campaigns/:id',
    UPDATE: '/campaigns/:id',
    DELETE: '/campaigns/:id',
  },
} as const;

/**
 * Payment gateway configuration settings
 */
export const PAYMENT_CONFIG = {
  STRIPE_PUBLIC_KEY: process.env.REACT_APP_STRIPE_PUBLIC_KEY,
  TRANZILLA_TERMINAL_ID: process.env.REACT_APP_TRANZILLA_TERMINAL_ID,
  MIN_DONATION_AMOUNT: 18,
  MAX_DONATION_AMOUNT: 1000000,
} as const;

/**
 * Standardized error messages
 */
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect to the server',
  VALIDATION_ERROR: 'Please check your input',
  PAYMENT_ERROR: 'Payment processing failed',
  AUTH_ERROR: 'Authentication failed',
  PERMISSION_ERROR: 'Insufficient permissions',
} as const;

/**
 * Date format configurations for different contexts
 */
export const DATE_FORMATS = {
  DISPLAY: 'DD/MM/YYYY',
  API: 'YYYY-MM-DD',
  TIMESTAMP: 'YYYY-MM-DD HH:mm:ss',
  LOCALE: {
    en: 'MM/DD/YYYY',
    he: 'DD/MM/YYYY',
    fr: 'DD/MM/YYYY',
  },
} as const;

/**
 * Campaign creation and management limits
 */
export const CAMPAIGN_LIMITS = {
  MIN_DURATION_DAYS: 1,
  MAX_DURATION_DAYS: 365,
  MIN_GOAL_AMOUNT: 1000,
  MAX_GOAL_AMOUNT: 10000000,
  MAX_TITLE_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 5000,
} as const;

/**
 * Timezone configuration settings
 */
export const TIMEZONE_CONFIG = {
  DEFAULT_TIMEZONE: 'UTC',
  DISPLAY_TIMEZONE: 'local',
  FORMAT: 'YYYY-MM-DD HH:mm:ss z',
} as const;

/**
 * Cache duration settings (in seconds)
 */
export const CACHE_DURATION = {
  USER_PROFILE: 300,
  CAMPAIGN_LIST: 60,
  DONATION_HISTORY: 300,
  ASSOCIATION_DETAILS: 600,
} as const;

/**
 * Supported currencies for donations
 */
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'ILS'] as const;

/**
 * Supported languages for internationalization
 */
export const SUPPORTED_LANGUAGES = ['en', 'he', 'fr'] as const;

/**
 * Default language setting
 */
export const DEFAULT_LANGUAGE = 'en' as const;

/**
 * Predefined donation amount options
 */
export const DONATION_AMOUNTS = [18, 36, 100, 180, 360, 1000] as const;

/**
 * Recurring donation frequency options
 */
export const RECURRING_FREQUENCIES = ['MONTHLY', 'ANNUAL'] as const;

/**
 * Input validation rules
 */
export const VALIDATION_RULES = {
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_PATTERN: '^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{8,}$',
  EMAIL_PATTERN: '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$',
  PHONE_PATTERN: '^\\+?[1-9]\\d{1,14}$',
} as const;

/**
 * Local storage key constants
 */
export const LOCAL_STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_PREFERENCES: 'user_preferences',
  LANGUAGE: 'selected_language',
  THEME: 'selected_theme',
} as const;

/**
 * Theme options
 */
export const THEME_OPTIONS = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

/**
 * HTTP status codes
 */
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const;