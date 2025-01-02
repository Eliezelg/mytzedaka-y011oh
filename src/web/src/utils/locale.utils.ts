/**
 * @fileoverview Locale utility functions for managing internationalization
 * @version 1.0.0
 */

import i18next from 'i18next'; // v23.5.1
import {
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE,
  LOCAL_STORAGE_KEYS,
} from '../config/constants';

/**
 * Type-safe list of locales requiring RTL layout support
 */
export const RTL_LOCALES = ['he'] as const;

/**
 * Type guard to check if a locale is supported
 * @param locale - Locale to validate
 */
const isSupportedLocale = (locale: string): locale is typeof SUPPORTED_LANGUAGES[number] => {
  return SUPPORTED_LANGUAGES.includes(locale as typeof SUPPORTED_LANGUAGES[number]);
};

/**
 * Retrieves the current locale with validation and fallback mechanism
 * @returns Validated current locale code
 * @throws Error if locale retrieval fails critically
 */
export const getCurrentLocale = (): string => {
  try {
    // Try getting locale from i18next
    const i18nextLocale = i18next.language;
    if (i18nextLocale && isSupportedLocale(i18nextLocale)) {
      return i18nextLocale;
    }

    // Try getting locale from localStorage
    const storedLocale = localStorage.getItem(LOCAL_STORAGE_KEYS.LANGUAGE);
    if (storedLocale && isSupportedLocale(storedLocale)) {
      return storedLocale;
    }

    // Fallback to default language
    return DEFAULT_LANGUAGE;
  } catch (error) {
    console.error('Error retrieving current locale:', error);
    return DEFAULT_LANGUAGE;
  }
};

/**
 * Changes the application locale with comprehensive updates
 * @param locale - Target language code to set
 * @throws Error if locale change fails
 */
export const setLocale = async (locale: string): Promise<void> => {
  if (!isSupportedLocale(locale)) {
    throw new Error(`Unsupported locale: ${locale}`);
  }

  try {
    // Change i18next language
    await i18next.changeLanguage(locale);

    // Update localStorage
    localStorage.setItem(LOCAL_STORAGE_KEYS.LANGUAGE, locale);

    // Update document direction
    const dir = isRTL(locale) ? 'rtl' : 'ltr';
    document.documentElement.dir = dir;
    document.documentElement.lang = locale;

    // Force layout recalculation for RTL adjustments
    document.documentElement.style.display = 'none';
    // eslint-disable-next-line no-unused-expressions
    document.documentElement.offsetHeight;
    document.documentElement.style.display = '';

  } catch (error) {
    console.error('Error setting locale:', error);
    throw new Error(`Failed to set locale to ${locale}`);
  }
};

/**
 * Determines if a locale requires RTL text direction
 * @param locale - Optional language code to check
 * @returns True if locale requires RTL, false otherwise
 */
export const isRTL = (locale?: string): boolean => {
  const targetLocale = locale || getCurrentLocale();
  return RTL_LOCALES.includes(targetLocale as typeof RTL_LOCALES[number]);
};

/**
 * Returns the type-safe default locale for the application
 * @returns Default locale code with type guarantee
 */
export const getDefaultLocale = (): typeof SUPPORTED_LANGUAGES[number] => {
  if (!isSupportedLocale(DEFAULT_LANGUAGE)) {
    throw new Error('Default language configuration error');
  }
  return DEFAULT_LANGUAGE;
};

/**
 * Gets the browser's preferred language if supported
 * @returns Supported locale code or default language
 */
export const getBrowserLocale = (): string => {
  try {
    const browserLocales = navigator.languages || [navigator.language];
    
    for (const locale of browserLocales) {
      const normalizedLocale = locale.split('-')[0].toLowerCase();
      if (isSupportedLocale(normalizedLocale)) {
        return normalizedLocale;
      }
    }
    
    return DEFAULT_LANGUAGE;
  } catch (error) {
    console.error('Error detecting browser locale:', error);
    return DEFAULT_LANGUAGE;
  }
};

/**
 * Validates and sanitizes a locale string
 * @param locale - Locale string to validate
 * @returns Validated locale or null if invalid
 */
export const validateLocale = (locale: string): string | null => {
  if (!locale || typeof locale !== 'string') {
    return null;
  }

  const normalizedLocale = locale.toLowerCase().trim();
  return isSupportedLocale(normalizedLocale) ? normalizedLocale : null;
};