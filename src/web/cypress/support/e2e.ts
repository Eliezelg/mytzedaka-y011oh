/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />
/// <reference types="@cypress/code-coverage" />

// External imports
import '@testing-library/cypress/add-commands';
import '@cypress/code-coverage/support';

// Internal imports
import './commands';
import { LOCAL_STORAGE_KEYS, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE, TIMEZONE_CONFIG } from '../../src/config/constants';

/**
 * Configure global Cypress behavior and settings
 * @version 1.0.0
 */
Cypress.config({
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 10000,
  requestTimeout: 10000,
  responseTimeout: 30000,
  video: false,
  screenshotOnRunFailure: true,
  chromeWebSecurity: false,
  experimentalSessionAndOrigin: true,
  retries: {
    runMode: 2,
    openMode: 0
  },
  env: {
    codeCoverage: {
      url: '/api/__coverage__'
    }
  }
});

/**
 * Enhanced error handling for test failures with internationalization support
 * @version 1.0.0
 */
Cypress.on('uncaught:exception', (err) => {
  // Log error with language context
  const currentLanguage = localStorage.getItem(LOCAL_STORAGE_KEYS.LANGUAGE) || DEFAULT_LANGUAGE;
  
  console.error(`Test failure in language context: ${currentLanguage}`);
  console.error('Error details:', err.message);
  
  // Capture additional context for RTL layouts
  if (currentLanguage === 'he') {
    cy.get('html')
      .invoke('attr', 'dir')
      .then((direction) => {
        console.log(`RTL direction at failure: ${direction}`);
      });
  }

  // Log browser console for debugging
  cy.window().then((win) => {
    console.log('Browser console logs:', (win as any).console.logs);
  });

  // Prevent test failure on uncaught exceptions
  return false;
});

/**
 * Global test setup and environment configuration
 * Runs before each test to ensure consistent state
 * @version 1.0.0
 */
beforeEach(() => {
  // Clear storage except authentication tokens if preserving login
  cy.window().then((win) => {
    const preserveAuth = Cypress.env('preserveAuth');
    if (!preserveAuth) {
      win.localStorage.clear();
      win.sessionStorage.clear();
    } else {
      const authToken = win.localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
      win.localStorage.clear();
      if (authToken) {
        win.localStorage.setItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN, authToken);
      }
    }
  });

  // Reset cookies except authentication-related ones
  cy.clearCookies();
  
  // Set default language if not specified
  cy.window().then((win) => {
    if (!win.localStorage.getItem(LOCAL_STORAGE_KEYS.LANGUAGE)) {
      win.localStorage.setItem(LOCAL_STORAGE_KEYS.LANGUAGE, DEFAULT_LANGUAGE);
    }
  });

  // Configure timezone for consistent date/time testing
  cy.clock(Date.now(), { timezone: TIMEZONE_CONFIG.DEFAULT_TIMEZONE });

  // Setup payment gateway mocks
  cy.intercept('POST', '**/stripe/create-payment-intent', {
    statusCode: 200,
    body: { clientSecret: 'mock_client_secret' }
  }).as('stripePayment');

  cy.intercept('POST', '**/tranzilla/process', {
    statusCode: 200,
    body: { transactionId: 'mock_transaction_id' }
  }).as('tranzillaPayment');

  // Initialize code coverage collection
  if (Cypress.env('codeCoverage')) {
    cy.window().then((win) => {
      win.__coverage__ = {};
    });
  }
});

/**
 * Type definitions for custom commands
 * Extends Cypress namespace with project-specific commands
 */
declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login with email and password
       * @param email - User email
       * @param password - User password
       */
      login(email: string, password: string): void;

      /**
       * Custom command to login with specific user role
       * @param role - User role (admin, association, donor, unverified)
       */
      loginWithRole(role: 'admin' | 'association' | 'donor' | 'unverified'): void;

      /**
       * Custom command to set application language
       * @param language - Target language code
       */
      setLanguage(language: 'en' | 'he' | 'fr'): void;

      /**
       * Custom command to fill donation form
       * @param donationData - Donation form data
       */
      fillDonationForm(donationData: {
        amount: number;
        currency: string;
        frequency: string;
        paymentMethod: string;
        dedication?: {
          type: string;
          name: string;
          message: string;
        };
      }): void;
    }
  }
}