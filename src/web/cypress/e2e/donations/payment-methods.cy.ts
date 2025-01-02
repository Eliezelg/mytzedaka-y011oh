import { donor } from '../../fixtures/users.json';
import { PAYMENT_CONFIG, ERROR_MESSAGES, SUPPORTED_CURRENCIES } from '../../../../src/config/constants';

// Test data for payment methods
const testCards = {
  stripe: {
    valid: {
      visa: '4242424242424242',
      mastercard: '5555555555554444',
      amex: '378282246310005'
    },
    invalid: {
      expired: '4000000000000069',
      declined: '4000000000000002',
      insufficient: '4000000000009995'
    }
  },
  tranzilla: {
    valid: {
      isracard: '2312312312312312',
      visa: '4580458045804580'
    },
    invalid: {
      expired: '4580000000000000',
      declined: '4580111111111111'
    }
  }
};

describe('Payment Methods Management', () => {
  beforeEach(() => {
    // Reset application state
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.task('db:reset');

    // Login as donor
    cy.loginAs(donor);

    // Visit payment methods page with SSL verification
    cy.visit('/account/payment-methods', {
      failOnStatusCode: true,
      https: true
    });

    // Setup API interceptors
    cy.intercept('POST', '/api/v1/payment-methods/stripe', (req) => {
      // Verify secure headers
      expect(req.headers['content-security-policy']).to.exist;
      expect(req.headers['x-frame-options']).to.equal('DENY');
    }).as('stripePaymentMethod');

    cy.intercept('POST', '/api/v1/payment-methods/tranzilla', (req) => {
      expect(req.headers['content-security-policy']).to.exist;
      expect(req.headers['x-frame-options']).to.equal('DENY');
    }).as('tranzillaPaymentMethod');
  });

  describe('Stripe Payment Methods', () => {
    it('should add a new Stripe card with security verification', () => {
      // Verify secure form rendering
      cy.get('[data-testid="stripe-card-form"]')
        .should('have.attr', 'data-secure', 'true')
        .and('have.attr', 'autocomplete', 'off');

      // Fill card details with valid Visa
      cy.get('[data-testid="card-number"]').type(testCards.stripe.valid.visa);
      cy.get('[data-testid="card-expiry"]').type('1225');
      cy.get('[data-testid="card-cvc"]').type('123');

      // Submit and verify secure token generation
      cy.get('[data-testid="submit-card"]').click();
      cy.wait('@stripePaymentMethod').then((interception) => {
        expect(interception.request.headers['authorization']).to.exist;
        expect(interception.response.statusCode).to.equal(200);
        expect(interception.response.body.paymentMethodId).to.exist;
      });

      // Verify success message
      cy.get('[data-testid="success-message"]')
        .should('be.visible')
        .and('contain', 'Card added successfully');
    });

    it('should handle 3D Secure authentication', () => {
      // Setup 3DS mock
      cy.intercept('POST', '**/3d-secure-authentication', {
        statusCode: 200,
        body: { requires3DS: true, redirectUrl: 'https://3ds-mock.com' }
      }).as('3dsAuth');

      // Fill 3DS required card
      cy.get('[data-testid="card-number"]').type('4000000000003220');
      cy.get('[data-testid="card-expiry"]').type('1225');
      cy.get('[data-testid="card-cvc"]').type('123');

      cy.get('[data-testid="submit-card"]').click();

      // Verify 3DS iframe handling
      cy.wait('@3dsAuth');
      cy.get('[data-testid="3ds-iframe"]').should('be.visible');
    });

    it('should validate card details with proper error messages', () => {
      // Test invalid card number
      cy.get('[data-testid="card-number"]').type('4242424242424241');
      cy.get('[data-testid="card-number-error"]')
        .should('be.visible')
        .and('contain', 'Invalid card number');

      // Test expired card
      cy.get('[data-testid="card-expiry"]').type('1220');
      cy.get('[data-testid="card-expiry-error"]')
        .should('be.visible')
        .and('contain', 'Card has expired');
    });
  });

  describe('Tranzilla Payment Methods', () => {
    it('should add a new Israeli card with proper validation', () => {
      // Switch to Tranzilla form
      cy.get('[data-testid="payment-gateway-selector"]').select('tranzilla');

      // Verify Israeli-specific validations
      cy.get('[data-testid="israeli-id"]')
        .should('be.visible')
        .type('123456789');

      // Fill Israeli card details
      cy.get('[data-testid="card-number"]').type(testCards.tranzilla.valid.isracard);
      cy.get('[data-testid="card-expiry"]').type('1225');
      cy.get('[data-testid="card-cvv"]').type('123');

      // Submit and verify Tranzilla integration
      cy.get('[data-testid="submit-card"]').click();
      cy.wait('@tranzillaPaymentMethod').then((interception) => {
        expect(interception.response.statusCode).to.equal(200);
        expect(interception.response.body.bankCode).to.exist;
      });
    });

    it('should handle Israeli-specific error messages', () => {
      cy.get('[data-testid="payment-gateway-selector"]').select('tranzilla');

      // Test invalid Israeli ID
      cy.get('[data-testid="israeli-id"]').type('123456788');
      cy.get('[data-testid="israeli-id-error"]')
        .should('be.visible')
        .and('contain', 'Invalid Israeli ID');

      // Test invalid Israeli card
      cy.get('[data-testid="card-number"]').type(testCards.tranzilla.invalid.declined);
      cy.get('[data-testid="card-error"]')
        .should('be.visible')
        .and('contain', 'Card not supported');
    });
  });

  describe('Security Scenarios', () => {
    it('should prevent XSS attacks in form inputs', () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      cy.get('[data-testid="card-holder-name"]')
        .type(xssPayload)
        .should('have.value', xssPayload.replace(/[<>]/g, ''));
    });

    it('should validate CSRF token presence', () => {
      cy.get('[data-testid="payment-form"]')
        .should('have.attr', 'data-csrf-token');

      cy.window().then((win) => {
        const csrfToken = win.localStorage.getItem('csrf_token');
        expect(csrfToken).to.exist;
      });
    });

    it('should handle rate limiting', () => {
      // Attempt rapid submissions
      for(let i = 0; i < 5; i++) {
        cy.get('[data-testid="submit-card"]').click();
      }

      cy.get('[data-testid="rate-limit-error"]')
        .should('be.visible')
        .and('contain', 'Too many attempts');
    });

    it('should enforce secure connection', () => {
      cy.location('protocol').should('eq', 'https:');
      
      // Verify secure headers
      cy.request('/account/payment-methods')
        .then((response) => {
          expect(response.headers['strict-transport-security']).to.exist;
          expect(response.headers['x-content-type-options']).to.equal('nosniff');
        });
    });
  });

  describe('Multi-Currency Support', () => {
    SUPPORTED_CURRENCIES.forEach((currency) => {
      it(`should handle ${currency} transactions`, () => {
        cy.get('[data-testid="currency-selector"]').select(currency);
        
        // Add card and verify currency handling
        cy.get('[data-testid="card-number"]').type(testCards.stripe.valid.visa);
        cy.get('[data-testid="card-expiry"]').type('1225');
        cy.get('[data-testid="card-cvc"]').type('123');
        
        cy.get('[data-testid="submit-card"]').click();
        
        cy.wait('@stripePaymentMethod').then((interception) => {
          expect(interception.request.body.currency).to.equal(currency);
          expect(interception.response.body.currency).to.equal(currency);
        });
      });
    });
  });
});