/// <reference types="cypress" />
/// <reference types="@testing-library/cypress" />

import '@testing-library/cypress/add-commands';
import { mockUsers } from '../../fixtures/users.json';
import { SUPPORTED_LANGUAGES, API_ENDPOINTS, HTTP_STATUS, VALIDATION_RULES } from '../../../src/config/constants';

describe('User Registration', () => {
  beforeEach(() => {
    cy.visit('/register');
    // Clear local storage and cookies before each test
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  describe('Multi-step Registration Flow', () => {
    it('should complete basic information step with validation', () => {
      // Test email validation
      cy.findByTestId('email-input').type('invalid-email');
      cy.findByTestId('next-step-button').click();
      cy.findByText(/invalid email format/i).should('exist');

      // Test password strength validation
      cy.findByTestId('email-input').clear().type('test@example.com');
      cy.findByTestId('password-input').type('weak');
      cy.findByText(/password must contain/i).should('exist');

      // Test successful basic info submission
      cy.findByTestId('password-input').clear().type('StrongPass123!');
      cy.findByTestId('confirm-password-input').type('StrongPass123!');
      cy.findByTestId('next-step-button').click();
      cy.findByTestId('role-selection-step').should('be.visible');
    });

    it('should handle role-based registration flow for association', () => {
      // Complete basic info step
      cy.findByTestId('email-input').type('association@test.org');
      cy.findByTestId('password-input').type('StrongPass123!');
      cy.findByTestId('confirm-password-input').type('StrongPass123!');
      cy.findByTestId('next-step-button').click();

      // Select association role
      cy.findByTestId('role-select').select('ASSOCIATION');
      cy.findByTestId('next-step-button').click();

      // Fill organization details
      cy.findByTestId('org-name-input').type('Test Charity');
      cy.findByTestId('org-id-input').type('12345678');
      cy.findByTestId('next-step-button').click();

      // Mock successful registration
      cy.intercept('POST', `*${API_ENDPOINTS.AUTH.REGISTER}`, {
        statusCode: HTTP_STATUS.CREATED,
        body: {
          message: 'Registration successful',
          requires2FA: true,
          redirectUrl: '/2fa-setup'
        }
      }).as('registerRequest');

      cy.findByTestId('register-submit-button').click();
      cy.wait('@registerRequest');
      cy.url().should('include', '/2fa-setup');
    });

    it('should handle role-based registration flow for donor', () => {
      // Complete basic info step
      cy.findByTestId('email-input').type('donor@test.com');
      cy.findByTestId('password-input').type('StrongPass123!');
      cy.findByTestId('confirm-password-input').type('StrongPass123!');
      cy.findByTestId('next-step-button').click();

      // Select donor role
      cy.findByTestId('role-select').select('DONOR');
      cy.findByTestId('next-step-button').click();

      // Mock successful registration
      cy.intercept('POST', `*${API_ENDPOINTS.AUTH.REGISTER}`, {
        statusCode: HTTP_STATUS.CREATED,
        body: {
          message: 'Registration successful',
          requires2FA: false,
          redirectUrl: '/dashboard'
        }
      }).as('registerRequest');

      cy.findByTestId('register-submit-button').click();
      cy.wait('@registerRequest');
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Language and RTL Support', () => {
    SUPPORTED_LANGUAGES.forEach((language) => {
      it(`should display registration form in ${language}`, () => {
        // Set language
        cy.findByTestId('language-selector').click();
        cy.findByText(new RegExp(language, 'i')).click();

        // Verify language-specific elements
        if (language === 'he') {
          cy.get('html').should('have.attr', 'dir', 'rtl');
          cy.findByText(/הרשמה/i).should('exist');
        } else if (language === 'fr') {
          cy.get('html').should('have.attr', 'dir', 'ltr');
          cy.findByText(/inscription/i).should('exist');
        } else {
          cy.get('html').should('have.attr', 'dir', 'ltr');
          cy.findByText(/registration/i).should('exist');
        }
      });
    });
  });

  describe('Security and Error Handling', () => {
    it('should prevent XSS attacks in input fields', () => {
      const xssScript = '<script>alert("xss")</script>';
      cy.findByTestId('email-input').type(xssScript);
      cy.findByTestId('email-input').should('have.value', xssScript.replace(/[<>]/g, ''));
    });

    it('should handle server-side validation errors', () => {
      cy.intercept('POST', `*${API_ENDPOINTS.AUTH.REGISTER}`, {
        statusCode: HTTP_STATUS.BAD_REQUEST,
        body: {
          message: 'Registration failed',
          errors: {
            email: 'Email already exists',
            password: 'Password does not meet requirements'
          }
        }
      }).as('failedRegister');

      // Fill form with existing user data
      cy.findByTestId('email-input').type(mockUsers.donor.email);
      cy.findByTestId('password-input').type('StrongPass123!');
      cy.findByTestId('confirm-password-input').type('StrongPass123!');
      cy.findByTestId('next-step-button').click();

      cy.wait('@failedRegister');
      cy.findByText(/email already exists/i).should('exist');
    });

    it('should enforce password complexity requirements', () => {
      const testCases = [
        { password: 'short', error: /minimum length/i },
        { password: 'nocapital123', error: /uppercase letter/i },
        { password: 'NOLOWER123', error: /lowercase letter/i },
        { password: 'NoNumbers!!', error: /number/i }
      ];

      testCases.forEach(({ password, error }) => {
        cy.findByTestId('password-input').clear().type(password);
        cy.findByTestId('next-step-button').click();
        cy.findByText(error).should('exist');
      });
    });
  });

  describe('Accessibility', () => {
    it('should support keyboard navigation', () => {
      cy.findByTestId('email-input').focus()
        .type('{tab}')
        .focused().should('have.attr', 'data-testid', 'password-input')
        .type('{tab}')
        .focused().should('have.attr', 'data-testid', 'confirm-password-input')
        .type('{tab}')
        .focused().should('have.attr', 'data-testid', 'next-step-button');
    });

    it('should have proper ARIA labels', () => {
      cy.findByTestId('email-input').should('have.attr', 'aria-label');
      cy.findByTestId('password-input').should('have.attr', 'aria-label');
      cy.findByTestId('confirm-password-input').should('have.attr', 'aria-label');
      cy.findByTestId('next-step-button').should('have.attr', 'aria-label');
    });
  });
});