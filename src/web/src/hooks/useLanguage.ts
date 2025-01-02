/**
 * @fileoverview Custom React hook for managing language preferences and internationalization
 * with comprehensive RTL support for Hebrew, English, and French languages
 * @version 1.0.0
 */

import { useCallback, useMemo, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // v13.2.2
import { useLanguageContext } from '../contexts/LanguageContext';
import { getCurrentLocale, isRTL } from '../utils/locale.utils';

/**
 * Type definition for the language hook return value
 */
interface LanguageHookReturn {
  currentLanguage: string;
  isRTL: boolean;
  changeLanguage: (language: string) => Promise<void>;
  t: (key: string, options?: object) => string;
  direction: 'ltr' | 'rtl';
  supportedLanguages: readonly ['en', 'he', 'fr'];
  isLanguageLoading: boolean;
  languageError: string | null;
}

/**
 * Custom hook for comprehensive language management including translations,
 * RTL support, and error handling
 * @returns {LanguageHookReturn} Object containing language utilities and state
 */
const useLanguage = (): LanguageHookReturn => {
  // Initialize context and translation hook
  const {
    currentLanguage,
    isRTL: contextIsRTL,
    isLoading,
    error,
    changeLanguage: contextChangeLanguage,
    supportedLanguages,
  } = useLanguageContext();

  const { t } = useTranslation();
  const [languageError, setLanguageError] = useState<string | null>(error);

  // Handle language context errors
  useEffect(() => {
    if (error) {
      setLanguageError(error);
    }
  }, [error]);

  /**
   * Wrapped language change handler with error handling
   */
  const changeLanguage = useCallback(
    async (language: string): Promise<void> => {
      try {
        setLanguageError(null);
        await contextChangeLanguage(language);
        
        // Update document attributes for accessibility
        document.documentElement.lang = language;
        document.documentElement.dir = isRTL(language) ? 'rtl' : 'ltr';
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to change language';
        setLanguageError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [contextChangeLanguage]
  );

  /**
   * Memoized return values to prevent unnecessary re-renders
   */
  const languageUtils = useMemo(
    () => ({
      currentLanguage,
      isRTL: contextIsRTL,
      changeLanguage,
      t,
      direction: contextIsRTL ? 'rtl' : 'ltr',
      supportedLanguages,
      isLanguageLoading: isLoading,
      languageError,
    }),
    [
      currentLanguage,
      contextIsRTL,
      changeLanguage,
      t,
      supportedLanguages,
      isLoading,
      languageError,
    ]
  );

  return languageUtils;
};

export default useLanguage;