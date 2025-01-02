/**
 * @fileoverview Language context provider for managing application-wide language settings
 * with WCAG 2.1 Level AA compliance and RTL support
 * @version 1.0.0
 */

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'; // ^18.2.0
import { useTranslation } from 'react-i18next'; // ^13.2.2
import i18next from 'i18next'; // ^23.5.1

import { getCurrentLocale, setLocale, isRTL } from '../utils/locale.utils';
import { SUPPORTED_LANGUAGES } from '../config/constants';

/**
 * Type definition for the language context
 */
interface LanguageContextType {
  currentLanguage: string;
  isRTL: boolean;
  isLoading: boolean;
  error: string | null;
  supportedLanguages: readonly string[];
  changeLanguage: (language: string) => Promise<void>;
  detectUserLanguage: () => Promise<void>;
  formatDate: (date: Date) => string;
}

/**
 * Props for the LanguageProvider component
 */
interface LanguageProviderProps {
  children: React.ReactNode;
  initialLanguage?: string;
}

// Create the context with undefined as initial value
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

/**
 * Language provider component that manages application-wide language settings
 * and accessibility features
 */
export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLanguage,
}) => {
  const { i18n } = useTranslation();
  const [currentLanguage, setCurrentLanguage] = useState<string>(
    initialLanguage || getCurrentLocale()
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Changes the application language with accessibility considerations
   */
  const changeLanguage = useCallback(async (language: string): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await setLocale(language);
      setCurrentLanguage(language);

      // Announce language change to screen readers
      const announcement = document.createElement('div');
      announcement.setAttribute('role', 'status');
      announcement.setAttribute('aria-live', 'polite');
      announcement.textContent = i18n.t('language.changed', { lng: language });
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change language');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [i18n]);

  /**
   * Detects and sets the user's preferred language
   */
  const detectUserLanguage = useCallback(async (): Promise<void> => {
    try {
      const browserLocale = navigator.language.split('-')[0];
      if (SUPPORTED_LANGUAGES.includes(browserLocale)) {
        await changeLanguage(browserLocale);
      }
    } catch (err) {
      console.error('Failed to detect user language:', err);
    }
  }, [changeLanguage]);

  /**
   * Formats dates according to the current locale
   */
  const formatDate = useCallback((date: Date): string => {
    return new Intl.DateTimeFormat(currentLanguage, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  }, [currentLanguage]);

  // Initialize language settings
  useEffect(() => {
    const initializeLanguage = async () => {
      try {
        setIsLoading(true);
        if (initialLanguage) {
          await changeLanguage(initialLanguage);
        } else {
          const currentLocale = getCurrentLocale();
          await changeLanguage(currentLocale);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Language initialization failed');
      } finally {
        setIsLoading(false);
      }
    };

    initializeLanguage();
  }, [initialLanguage, changeLanguage]);

  // Memoize context value to prevent unnecessary rerenders
  const contextValue = useMemo(
    () => ({
      currentLanguage,
      isRTL: isRTL(currentLanguage),
      isLoading,
      error,
      supportedLanguages: SUPPORTED_LANGUAGES,
      changeLanguage,
      detectUserLanguage,
      formatDate,
    }),
    [currentLanguage, isLoading, error, changeLanguage, detectUserLanguage, formatDate]
  );

  return (
    <LanguageContext.Provider value={contextValue}>
      {children}
    </LanguageContext.Provider>
  );
};

/**
 * Custom hook to access the language context with type safety
 * @throws {Error} If used outside of LanguageProvider
 */
export const useLanguageContext = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  
  if (context === undefined) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  
  return context;
};