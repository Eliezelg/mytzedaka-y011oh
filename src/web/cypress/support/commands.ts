/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

// External imports
import '@testing-library/cypress/add-commands';

// Internal imports
import { mockUsers, mockAuthTokens } from '../fixtures/users.json';
import { LOCAL_STORAGE_KEYS, SUPPORTED_LANGUAGES, API_ENDPOINTS, HTTP_STATUS } from '../../src/config/constants';

// Type definitions for custom commands
declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): void;
      loginWithRole(role: 'admin' | 'association' | 'donor' | 'unverified'): void;
      setLanguage(language: 'en' | 'he' | 'fr'): void;
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

/**
 * Custom command to perform user login with JWT token verification and 2FA handling
 * @version 1.0.0
 */
Cypress.Commands.add('login', (email: string, password: string) => {
  cy.intercept('POST', `*${API_ENDPOINTS.AUTH.LOGIN}`).as('loginRequest');

  cy.visit('/login');
  cy.findByLabelText(/email/i).type(email);
  cy.findByLabelText(/password/i).type(password);
  cy.findByRole('button', { name: /sign in/i }).click();

  cy.wait('@loginRequest').then((interception) => {
    // Verify successful login response
    expect(interception.response?.statusCode).to.equal(HTTP_STATUS.OK);
    
    // Handle 2FA if enabled
    if (interception.response?.body.requiresTwoFactor) {
      cy.findByLabelText(/verification code/i).type('123456'); // Test 2FA code
      cy.findByRole('button', { name: /verify/i }).click();
    }

    // Verify JWT token storage
    cy.window().its('localStorage')
      .invoke('getItem', LOCAL_STORAGE_KEYS.AUTH_TOKEN)
      .should('exist');

    // Verify redirect to dashboard
    cy.url().should('include', '/dashboard');
  });
});

/**
 * Custom command to login with specific user role and verify role-specific access
 * @version 1.0.0
 */
Cypress.Commands.add('loginWithRole', (role: 'admin' | 'association' | 'donor' | 'unverified') => {
  const user = mockUsers[role];
  
  cy.login(user.email, user.testPassword);

  // Verify role-specific UI elements and access
  switch (role) {
    case 'admin':
      cy.findByRole('link', { name: /admin panel/i }).should('exist');
      cy.findByRole('link', { name: /user management/i }).should('exist');
      break;
    case 'association':
      cy.findByRole('link', { name: /campaign management/i }).should('exist');
      cy.findByRole('link', { name: /donation reports/i }).should('exist');
      break;
    case 'donor':
      cy.findByRole('link', { name: /my donations/i }).should('exist');
      cy.findByRole('link', { name: /donation history/i }).should('exist');
      break;
    case 'unverified':
      cy.findByText(/verify your email/i).should('exist');
      cy.findByRole('link', { name: /resend verification/i }).should('exist');
      break;
  }
});

/**
 * Custom command to change and verify application language settings
 * @version 1.0.0
 */
Cypress.Commands.add('setLanguage', (language: 'en' | 'he' | 'fr') => {
  // Click language selector and choose language
  cy.findByRole('button', { name: /language/i }).click();
  cy.findByRole('option', { name: new RegExp(language, 'i') }).click();

  // Verify language change in localStorage
  cy.window().its('localStorage')
    .invoke('getItem', LOCAL_STORAGE_KEYS.LANGUAGE)
    .should('eq', language);

  // Verify UI updates for each language
  switch (language) {
    case 'he':
      // Verify RTL layout
      cy.get('html').should('have.attr', 'dir', 'rtl');
      // Verify Hebrew text
      cy.findByRole('heading', { name: /תרומות/i }).should('exist');
      break;
    case 'fr':
      cy.get('html').should('have.attr', 'dir', 'ltr');
      // Verify French text
      cy.findByRole('heading', { name: /dons/i }).should('exist');
      break;
    case 'en':
      cy.get('html').should('have.attr', 'dir', 'ltr');
      // Verify English text
      cy.findByRole('heading', { name: /donations/i }).should('exist');
      break;
  }
});

/**
 * Custom command to fill and validate donation form
 * @version 1.0.0
 */
Cypress.Commands.add('fillDonationForm', (donationData: {
  amount: number;
  currency: string;
  frequency: string;
  paymentMethod: string;
  dedication?: {
    type: string;
    name: string;
    message: string;
  };
}) => {
  // Enter donation amount
  cy.findByLabelText(/amount/i).type(donationData.amount.toString());
  
  // Select currency
  cy.findByLabelText(/currency/i).select(donationData.currency);
  
  // Select donation frequency
  cy.findByLabelText(/frequency/i).select(donationData.frequency);
  
  // Select payment method
  cy.findByLabelText(/payment method/i).select(donationData.paymentMethod);
  
  // Fill dedication if provided
  if (donationData.dedication) {
    cy.findByRole('button', { name: /add dedication/i }).click();
    cy.findByLabelText(/dedication type/i).select(donationData.dedication.type);
    cy.findByLabelText(/dedication name/i).type(donationData.dedication.name);
    cy.findByLabelText(/dedication message/i).type(donationData.dedication.message);
  }

  // Verify form validation
  cy.findByRole('button', { name: /donate/i }).should('be.enabled');

  // Intercept payment gateway redirect
  cy.intercept('POST', '**/payment/process').as('paymentProcess');
  
  // Submit form
  cy.findByRole('button', { name: /donate/i }).click();

  // Verify payment processing
  cy.wait('@paymentProcess').then((interception) => {
    expect(interception.response?.statusCode).to.equal(HTTP_STATUS.OK);
  });

  // Verify success page redirect
  cy.url().should('include', '/donation/success');
});