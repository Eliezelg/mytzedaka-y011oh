import { PaymentMethodType } from '../../../interfaces/payment.interface';
import { validDonation, recurringDonation } from '../../fixtures/donations.json';

// Cypress v13.0.0
describe('Donation Flow', () => {
  beforeEach(() => {
    // Reset application state
    cy.clearAllCookies();
    cy.clearAllLocalStorage();
    cy.clearAllSessionStorage();

    // Set default language and login
    cy.window().then((win) => {
      win.localStorage.setItem('language', 'en');
    });
    cy.login('test-user-1'); // Custom command for authentication

    // Intercept API calls
    cy.intercept('POST', '/api/v1/payments/stripe', {
      statusCode: 200,
      fixture: 'stripe-success-response.json'
    }).as('stripePayment');

    cy.intercept('POST', '/api/v1/payments/tranzilla', {
      statusCode: 200,
      fixture: 'tranzilla-success-response.json'
    }).as('tranzillaPayment');

    cy.intercept('GET', '/api/v1/currency/convert*', {
      statusCode: 200,
      body: { rate: 3.5 } // Default ILS to USD rate
    }).as('currencyConversion');

    // Visit donation form
    cy.visit('/donate/test-assoc-1/test-campaign-1');
  });

  describe('Multi-language Support', () => {
    const languages = ['en', 'he', 'fr'];
    
    languages.forEach((lang) => {
      it(`should complete donation flow in ${lang}`, () => {
        // Set language
        cy.get('[data-testid=language-selector]').click();
        cy.get(`[data-testid=lang-option-${lang}]`).click();

        // Verify form labels in selected language
        cy.get('[data-testid=amount-label]')
          .should('have.text', lang === 'en' ? 'Amount' : lang === 'he' ? 'סכום' : 'Montant');

        // Fill donation form
        cy.get('[data-testid=amount-input]').type('50');
        cy.get('[data-testid=currency-selector]').select('USD');
        cy.get('[data-testid=payment-method-selector]').select(PaymentMethodType.CREDIT_CARD);

        // Complete payment details
        cy.get('[data-testid=card-number]').type('4242424242424242');
        cy.get('[data-testid=card-expiry]').type('1225');
        cy.get('[data-testid=card-cvc]').type('123');

        // Submit donation
        cy.get('[data-testid=submit-donation]').click();

        // Verify success message in correct language
        cy.get('[data-testid=success-message]', { timeout: 10000 })
          .should('be.visible')
          .and('contain.text', 
            lang === 'en' ? 'Thank you for your donation' :
            lang === 'he' ? 'תודה על תרומתך' :
            'Merci pour votre don'
          );
      });
    });
  });

  describe('Payment Gateway Flows', () => {
    it('should process international donation through Stripe', () => {
      // Select USD currency (triggers Stripe)
      cy.get('[data-testid=currency-selector]').select('USD');
      
      // Fill Stripe-specific form
      cy.get('[data-testid=stripe-card-element]').within(() => {
        cy.fillStripeElement('cardNumber', '4242424242424242');
        cy.fillStripeElement('cardExpiry', '1225');
        cy.fillStripeElement('cardCvc', '123');
      });

      // Submit and verify Stripe processing
      cy.get('[data-testid=submit-donation]').click();
      cy.wait('@stripePayment');
      cy.get('[data-testid=payment-success]').should('be.visible');
    });

    it('should process Israeli donation through Tranzilla', () => {
      // Select ILS currency (triggers Tranzilla)
      cy.get('[data-testid=currency-selector]').select('ILS');
      
      // Fill Tranzilla-specific form
      cy.get('[data-testid=tranzilla-form]').within(() => {
        cy.get('[data-testid=israeli-id]').type('123456789');
        cy.get('[data-testid=card-number]').type('4580458045804580');
        cy.get('[data-testid=card-expiry]').type('1225');
        cy.get('[data-testid=card-cvv]').type('123');
      });

      // Submit and verify Tranzilla processing
      cy.get('[data-testid=submit-donation]').click();
      cy.wait('@tranzillaPayment');
      cy.get('[data-testid=payment-success]').should('be.visible');
    });
  });

  describe('Error Handling', () => {
    it('should handle payment validation errors', () => {
      // Submit without required fields
      cy.get('[data-testid=submit-donation]').click();
      
      // Verify validation messages
      cy.get('[data-testid=amount-error]').should('be.visible');
      cy.get('[data-testid=payment-method-error]').should('be.visible');
    });

    it('should handle payment gateway errors', () => {
      // Intercept with error response
      cy.intercept('POST', '/api/v1/payments/stripe', {
        statusCode: 400,
        body: {
          error: 'card_declined',
          message: 'Your card was declined'
        }
      }).as('failedPayment');

      // Fill form with test card that will be declined
      cy.get('[data-testid=amount-input]').type('50');
      cy.get('[data-testid=stripe-card-element]').within(() => {
        cy.fillStripeElement('cardNumber', '4000000000000002'); // Decline card
        cy.fillStripeElement('cardExpiry', '1225');
        cy.fillStripeElement('cardCvc', '123');
      });

      // Submit and verify error handling
      cy.get('[data-testid=submit-donation]').click();
      cy.wait('@failedPayment');
      cy.get('[data-testid=payment-error]')
        .should('be.visible')
        .and('contain.text', 'Your card was declined');
    });
  });

  describe('Accessibility', () => {
    it('should meet WCAG 2.1 Level AA requirements', () => {
      // Run accessibility audit
      cy.injectAxe();
      cy.checkA11y('[data-testid=donation-form]', {
        runOnly: {
          type: 'tag',
          values: ['wcag2aa']
        }
      });
    });
  });

  describe('Recurring Donations', () => {
    it('should set up recurring donation', () => {
      // Enable recurring donation
      cy.get('[data-testid=recurring-toggle]').click();
      cy.get('[data-testid=recurring-frequency]').select('monthly');

      // Fill payment details
      cy.get('[data-testid=amount-input]').type('100');
      cy.get('[data-testid=stripe-card-element]').within(() => {
        cy.fillStripeElement('cardNumber', '4242424242424242');
        cy.fillStripeElement('cardExpiry', '1225');
        cy.fillStripeElement('cardCvc', '123');
      });

      // Submit and verify recurring setup
      cy.get('[data-testid=submit-donation]').click();
      cy.wait('@stripePayment');
      cy.get('[data-testid=recurring-success]')
        .should('be.visible')
        .and('contain.text', 'Monthly donation set up successfully');
    });
  });
});