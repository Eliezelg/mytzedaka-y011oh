import { mockUsers } from '../../fixtures/users.json';
import { HTTP_STATUS, ERROR_MESSAGES, LOCAL_STORAGE_KEYS } from '../../../../src/config/constants';

// Expected security headers for auth endpoints
const EXPECTED_SECURITY_HEADERS = {
  'strict-transport-security': 'max-age=31536000; includeSubDomains',
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'x-xss-protection': '1; mode=block',
  'content-security-policy': "default-src 'self'",
};

// Test user data
const { admin, donor, unverified } = mockUsers;

describe('Login Page', () => {
  beforeEach(() => {
    // Clear all browser storage
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
      win.indexedDB.deleteDatabase('IJAPDonationPlatform');
    });

    // Visit login page and verify security headers
    cy.intercept('GET', '/login').as('loginPageLoad');
    cy.visit('/login');
    cy.wait('@loginPageLoad').then((interception) => {
      Object.entries(EXPECTED_SECURITY_HEADERS).forEach(([header, value]) => {
        expect(interception.response?.headers[header]).to.equal(value);
      });
    });
  });

  it('should successfully login with valid credentials', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: HTTP_STATUS.OK,
      body: {
        accessToken: 'mock.jwt.token',
        refreshToken: 'mock.refresh.token',
        user: donor
      }
    }).as('loginRequest');

    cy.get('[data-cy=email-input]').type(donor.email);
    cy.get('[data-cy=password-input]').type(donor.testPassword);
    cy.get('[data-cy=login-submit]').click();

    cy.wait('@loginRequest').then((interception) => {
      expect(interception.request.body).to.have.property('email', donor.email);
      expect(interception.response?.statusCode).to.equal(HTTP_STATUS.OK);
    });

    // Verify token storage
    cy.window().then((win) => {
      expect(win.localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN)).to.exist;
    });

    cy.url().should('include', '/dashboard');
  });

  it('should handle validation errors', () => {
    // Test empty form submission
    cy.get('[data-cy=login-submit]').click();
    cy.get('[data-cy=validation-error]').should('be.visible');
    
    // Test invalid email format
    cy.get('[data-cy=email-input]').type('invalid-email');
    cy.get('[data-cy=password-input]').type('password');
    cy.get('[data-cy=login-submit]').click();
    cy.get('[data-cy=validation-error]').should('contain', 'Invalid email format');
    
    // Test password requirements
    cy.get('[data-cy=email-input]').clear().type(donor.email);
    cy.get('[data-cy=password-input]').clear().type('short');
    cy.get('[data-cy=login-submit]').click();
    cy.get('[data-cy=validation-error]').should('contain', 'Password must be at least 8 characters');
  });

  it('should handle 2FA flow correctly', () => {
    // Mock initial login response requiring 2FA
    cy.intercept('POST', '/api/auth/login', {
      statusCode: HTTP_STATUS.OK,
      body: {
        requiresTwoFactor: true,
        temporaryToken: 'temp.2fa.token'
      }
    }).as('loginWith2FA');

    // Login with 2FA-enabled admin account
    cy.get('[data-cy=email-input]').type(admin.email);
    cy.get('[data-cy=password-input]').type(admin.testPassword);
    cy.get('[data-cy=login-submit]').click();

    cy.wait('@loginWith2FA');
    cy.url().should('include', '/2fa-verification');

    // Mock OTP verification
    cy.intercept('POST', '/api/auth/verify-2fa', {
      statusCode: HTTP_STATUS.OK,
      body: {
        accessToken: 'mock.jwt.token',
        refreshToken: 'mock.refresh.token',
        user: admin
      }
    }).as('verifyOTP');

    // Test OTP validation
    cy.get('[data-cy=otp-input]').type('123456');
    cy.get('[data-cy=verify-otp]').click();
    cy.wait('@verifyOTP');
    cy.url().should('include', '/dashboard');
  });

  it('should handle invalid credentials', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      body: {
        message: ERROR_MESSAGES.AUTH_ERROR
      }
    }).as('failedLogin');

    cy.get('[data-cy=email-input]').type('wrong@email.com');
    cy.get('[data-cy=password-input]').type('WrongPass123!');
    cy.get('[data-cy=login-submit]').click();

    cy.wait('@failedLogin');
    cy.get('[data-cy=error-message]').should('contain', ERROR_MESSAGES.AUTH_ERROR);
  });

  it('should handle unverified accounts', () => {
    cy.intercept('POST', '/api/auth/login', {
      statusCode: HTTP_STATUS.FORBIDDEN,
      body: {
        message: 'Email not verified'
      }
    }).as('unverifiedLogin');

    cy.get('[data-cy=email-input]').type(unverified.email);
    cy.get('[data-cy=password-input]').type(unverified.testPassword);
    cy.get('[data-cy=login-submit]').click();

    cy.wait('@unverifiedLogin');
    cy.url().should('include', '/verify-email');
  });

  it('should manage tokens properly', () => {
    // Mock successful login
    cy.intercept('POST', '/api/auth/login', {
      statusCode: HTTP_STATUS.OK,
      body: {
        accessToken: 'mock.jwt.token',
        refreshToken: 'mock.refresh.token',
        user: donor
      }
    }).as('loginRequest');

    // Mock token refresh
    cy.intercept('POST', '/api/auth/refresh', {
      statusCode: HTTP_STATUS.OK,
      body: {
        accessToken: 'mock.new.jwt.token',
        refreshToken: 'mock.new.refresh.token'
      }
    }).as('tokenRefresh');

    // Complete login flow
    cy.get('[data-cy=email-input]').type(donor.email);
    cy.get('[data-cy=password-input]').type(donor.testPassword);
    cy.get('[data-cy=login-submit]').click();

    cy.wait('@loginRequest').then(() => {
      // Verify token storage
      cy.window().then((win) => {
        const authToken = win.localStorage.getItem(LOCAL_STORAGE_KEYS.AUTH_TOKEN);
        expect(authToken).to.exist;
        expect(JSON.parse(authToken!)).to.have.property('accessToken');
        expect(JSON.parse(authToken!)).to.have.property('refreshToken');
      });

      // Verify secure cookie attributes
      cy.getCookie('refresh_token').should('have.property', 'secure', true);
      cy.getCookie('refresh_token').should('have.property', 'httpOnly', true);
      cy.getCookie('refresh_token').should('have.property', 'sameSite', 'strict');
    });
  });

  it('should handle network errors gracefully', () => {
    cy.intercept('POST', '/api/auth/login', {
      forceNetworkError: true
    }).as('networkError');

    cy.get('[data-cy=email-input]').type(donor.email);
    cy.get('[data-cy=password-input]').type(donor.testPassword);
    cy.get('[data-cy=login-submit]').click();

    cy.get('[data-cy=error-message]').should('contain', ERROR_MESSAGES.NETWORK_ERROR);
  });
});