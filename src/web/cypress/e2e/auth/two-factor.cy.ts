import { mockUsers } from '../../fixtures/users';
import { HTTP_STATUS, ERROR_MESSAGES } from '../../../../src/config/constants';

// Test user with 2FA enabled
const testUser = mockUsers.mockUsers.admin;

// Security headers that should be present
const requiredSecurityHeaders = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff'
};

// ARIA labels for accessibility testing
const ariaLabels = {
  totpInput: 'Enter your 6-digit authentication code',
  verifyButton: 'Verify authentication code',
  errorMessage: 'Authentication error message',
  smsButton: 'Request SMS code instead',
  recoveryButton: 'Use recovery code'
};

describe('Two Factor Authentication Flow', () => {
  beforeEach(() => {
    // Clear previous state
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.clearAllSessionStorage();

    // Intercept API calls
    cy.intercept('POST', '/api/v1/auth/verify-2fa', {
      statusCode: HTTP_STATUS.OK,
      body: {
        success: true,
        token: 'mock-jwt-token',
        sessionId: 'mock-session-id'
      }
    }).as('verify2FA');

    cy.intercept('GET', '/api/v1/auth/rate-limit', {
      statusCode: HTTP_STATUS.OK,
      body: {
        attemptsRemaining: 5,
        cooldownPeriod: 300
      }
    }).as('rateLimit');

    // Visit login page and perform initial login
    cy.visit('/login', {
      onBeforeLoad: (win) => {
        // Verify secure context
        expect(win.isSecureContext).to.be.true;
      }
    });

    cy.get('[data-cy=email-input]').type(testUser.email);
    cy.get('[data-cy=password-input]').type(testUser.testPassword);
    cy.get('[data-cy=login-button]').click();

    // Wait for navigation to 2FA page
    cy.url().should('include', '/2fa');
  });

  it('should enforce security standards', () => {
    // Verify security headers
    cy.request('/2fa').then((response) => {
      Object.entries(requiredSecurityHeaders).forEach(([header, value]) => {
        expect(response.headers[header.toLowerCase()]).to.equal(value);
      });
    });

    // Verify secure connection
    cy.location('protocol').should('equal', 'https:');

    // Test XSS protection
    const xssPayload = '<script>alert(1)</script>';
    cy.get('[data-cy=totp-input]').type(xssPayload);
    cy.get('body').should('not.contain.html', xssPayload);
  });

  it('should handle TOTP verification flow successfully', () => {
    // Enter valid TOTP code
    cy.get('[data-cy=totp-input]')
      .should('have.attr', 'aria-label', ariaLabels.totpInput)
      .type('123456');

    cy.get('[data-cy=verify-button]')
      .should('have.attr', 'aria-label', ariaLabels.verifyButton)
      .click();

    cy.wait('@verify2FA').its('response.statusCode').should('equal', HTTP_STATUS.OK);
    cy.url().should('include', '/dashboard');
  });

  it('should handle rate limiting correctly', () => {
    // Attempt multiple failed verifications
    for (let i = 0; i < 5; i++) {
      cy.get('[data-cy=totp-input]').type('000000');
      cy.get('[data-cy=verify-button]').click();
    }

    // Verify rate limit warning
    cy.get('[data-cy=rate-limit-warning]')
      .should('be.visible')
      .and('contain.text', 'Too many attempts');

    // Verify button is disabled during cooldown
    cy.get('[data-cy=verify-button]').should('be.disabled');
  });

  it('should maintain accessibility standards', () => {
    // Test keyboard navigation
    cy.get('[data-cy=totp-input]').focus()
      .type('{tab}')
      .focused()
      .should('have.attr', 'data-cy', 'verify-button');

    // Verify ARIA attributes
    cy.get('[data-cy=totp-input]')
      .should('have.attr', 'aria-label', ariaLabels.totpInput)
      .should('have.attr', 'aria-required', 'true');

    // Test error announcement
    cy.get('[data-cy=totp-input]').type('000000');
    cy.get('[data-cy=verify-button]').click();
    cy.get('[data-cy=error-message]')
      .should('have.attr', 'role', 'alert')
      .and('have.attr', 'aria-live', 'assertive');
  });

  it('should handle SMS fallback correctly', () => {
    cy.get('[data-cy=sms-fallback-button]')
      .should('have.attr', 'aria-label', ariaLabels.smsButton)
      .click();

    cy.intercept('POST', '/api/v1/auth/send-sms', {
      statusCode: HTTP_STATUS.OK,
      body: { success: true }
    }).as('sendSMS');

    cy.wait('@sendSMS');
    cy.get('[data-cy=sms-sent-message]').should('be.visible');
  });

  it('should handle recovery code flow correctly', () => {
    cy.get('[data-cy=recovery-code-button]')
      .should('have.attr', 'aria-label', ariaLabels.recoveryButton)
      .click();

    cy.get('[data-cy=recovery-code-input]')
      .should('be.visible')
      .type('RECOVERY-CODE-123');

    cy.intercept('POST', '/api/v1/auth/verify-recovery', {
      statusCode: HTTP_STATUS.OK,
      body: { success: true }
    }).as('verifyRecovery');

    cy.get('[data-cy=verify-recovery-button]').click();
    cy.wait('@verifyRecovery');
    cy.url().should('include', '/dashboard');
  });

  it('should handle session timeout gracefully', () => {
    // Simulate session timeout
    cy.clock();
    cy.tick(900000); // 15 minutes

    cy.get('[data-cy=session-timeout-warning]')
      .should('be.visible')
      .and('contain.text', 'Session expired');

    // Verify redirect to login
    cy.url().should('include', '/login');
  });

  it('should protect against automated attacks', () => {
    // Test protection against rapid fire requests
    const attempts = Array(10).fill('123456');
    attempts.forEach(() => {
      cy.get('[data-cy=totp-input]').type('123456');
      cy.get('[data-cy=verify-button]').click();
    });

    // Verify CAPTCHA challenge appears
    cy.get('[data-cy=captcha-challenge]').should('be.visible');
  });
});