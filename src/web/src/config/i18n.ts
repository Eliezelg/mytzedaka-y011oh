/**
 * @fileoverview Internationalization configuration for the donation platform
 * @version 1.0.0
 */

import i18next from 'i18next'; // v23.5.1
import { initReactI18next } from 'react-i18next'; // v13.2.2
import HttpBackend from 'i18next-http-backend'; // v2.2.2
import LanguageDetector from 'i18next-browser-languagedetector'; // v7.1.0
import { SUPPORTED_LANGUAGES } from './constants';

/**
 * Default namespace for translations
 */
const DEFAULT_NS = 'common';

/**
 * Primary fallback language
 */
const FALLBACK_LANG = 'en';

/**
 * Languages requiring RTL support
 */
const RTL_LANGUAGES = ['he'];

/**
 * Initialize i18next with all required configurations
 */
const i18n = i18next
  // Initialize plugins
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  // Initialize i18next configuration
  .init({
    // Debug mode for development environment
    debug: process.env.NODE_ENV === 'development',

    // Language configuration
    fallbackLng: FALLBACK_LANG,
    supportedLngs: SUPPORTED_LANGUAGES,
    defaultNS: DEFAULT_NS,

    // Interpolation configuration
    interpolation: {
      escapeValue: false, // React handles escaping
    },

    // HTTP Backend configuration
    backend: {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
      allowMultiLoading: true,
      crossDomain: true,
      withCredentials: false,
      overrideMimeType: false,
      queryStringParams: {
        v: '1.0.0', // Cache busting version
      },
    },

    // Language detection configuration
    detection: {
      order: ['querystring', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lng',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
      excludeCacheFor: ['cimode'],
      checkWhitelist: true,
    },

    // React specific configuration
    react: {
      useSuspense: true,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
      transSupportBasicHtmlNodes: true,
      transKeepBasicHtmlNodesFor: ['br', 'strong', 'i', 'p'],
    },

    // RTL configuration
    load: 'languageOnly',
    returnObjects: true,
    returnEmptyString: false,
    returnNull: false,
    saveMissing: process.env.NODE_ENV === 'development',
    missingKeyHandler: (lng, ns, key) => {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Missing translation key: ${key} for language: ${lng} in namespace: ${ns}`);
      }
    },
  });

// Add language change handler for RTL support
i18n.on('languageChanged', (lng) => {
  const direction = RTL_LANGUAGES.includes(lng) ? 'rtl' : 'ltr';
  document.documentElement.dir = direction;
  document.documentElement.lang = lng;
});

export default i18n;