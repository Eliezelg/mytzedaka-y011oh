import { standardCampaign, lotteryCampaign } from '../../fixtures/campaigns.json';
import 'cypress-axe';

describe('Campaign Detail Page', () => {
  beforeEach(() => {
    // Initialize axe for accessibility testing
    cy.injectAxe();
    
    // Clear previous state
    cy.clearLocalStorage();
    cy.clearCookies();

    // Intercept campaign API calls
    cy.intercept('GET', `/api/campaigns/${standardCampaign.id}`, {
      body: standardCampaign,
      headers: {
        'Content-Language': 'en-US'
      }
    }).as('getStandardCampaign');

    cy.intercept('GET', `/api/campaigns/${lotteryCampaign.id}`, {
      body: lotteryCampaign,
      headers: {
        'Content-Language': 'en-US'
      }
    }).as('getLotteryCampaign');

    // Set default language
    cy.visit(`/campaigns/${standardCampaign.id}`, {
      onBeforeLoad: (win) => {
        Object.defineProperty(win.navigator, 'language', {
          value: 'en-US'
        });
      }
    });
  });

  describe('Standard Campaign Display', () => {
    it('displays campaign details with proper accessibility attributes', () => {
      cy.wait('@getStandardCampaign');
      
      // Check main campaign elements
      cy.findByTestId('campaign-title')
        .should('have.text', standardCampaign.title)
        .and('have.attr', 'aria-label');

      cy.findByTestId('campaign-progress')
        .should('have.attr', 'role', 'progressbar')
        .and('have.attr', 'aria-valuenow', '75')
        .and('have.attr', 'aria-valuemin', '0')
        .and('have.attr', 'aria-valuemax', '100');

      // Run accessibility checks
      cy.checkA11y();
    });

    it('handles currency display correctly', () => {
      cy.wait('@getStandardCampaign');
      
      cy.findByTestId('campaign-goal')
        .should('contain', new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: standardCampaign.currency
        }).format(standardCampaign.goalAmount));
    });

    it('supports keyboard navigation', () => {
      cy.wait('@getStandardCampaign');
      
      // Test tab navigation
      cy.findByTestId('donate-button').focus()
        .should('have.focus')
        .tab()
        .should('have.focus');

      // Verify focus visibility
      cy.findByTestId('share-button').focus()
        .should('have.css', 'outline-style', 'solid');
    });
  });

  describe('Lottery Campaign Display', () => {
    beforeEach(() => {
      cy.visit(`/campaigns/${lotteryCampaign.id}`);
      cy.wait('@getLotteryCampaign');
    });

    it('displays lottery-specific details accessibly', () => {
      // Check lottery details
      cy.findByTestId('lottery-tickets-remaining')
        .should('contain', lotteryCampaign.lotteryDetails.remainingTickets)
        .and('have.attr', 'aria-label');

      cy.findByTestId('lottery-draw-date')
        .should('contain', new Date(lotteryCampaign.lotteryDetails.drawDate)
          .toLocaleDateString('en-US'));

      // Check prize list accessibility
      cy.findByTestId('prize-list')
        .should('have.attr', 'role', 'list');

      cy.findAllByTestId('prize-item')
        .should('have.length', lotteryCampaign.lotteryDetails.prizes.length)
        .first()
        .should('have.attr', 'role', 'listitem');

      // Run accessibility checks
      cy.checkA11y();
    });

    it('handles ticket purchase flow accessibly', () => {
      cy.findByTestId('buy-tickets-button')
        .should('be.visible')
        .and('have.attr', 'aria-label')
        .click();

      cy.findByTestId('ticket-quantity-input')
        .should('be.visible')
        .and('have.attr', 'aria-label')
        .type('2');

      cy.findByTestId('ticket-total')
        .should('contain', new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: lotteryCampaign.currency
        }).format(lotteryCampaign.lotteryDetails.ticketPrice * 2));
    });
  });

  describe('Internationalization Support', () => {
    it('displays Hebrew content in RTL layout', () => {
      cy.visit(`/campaigns/${standardCampaign.id}`, {
        onBeforeLoad: (win) => {
          Object.defineProperty(win.navigator, 'language', {
            value: 'he'
          });
        }
      });

      cy.wait('@getStandardCampaign');

      // Verify RTL layout
      cy.get('html')
        .should('have.attr', 'dir', 'rtl');

      // Check translated content
      cy.findByTestId('campaign-title')
        .should('have.text', standardCampaign.translations.he.title);

      cy.findByTestId('campaign-description')
        .should('have.text', standardCampaign.translations.he.description);

      // Verify RTL-specific styling
      cy.findByTestId('campaign-progress')
        .should('have.css', 'direction', 'rtl');
    });

    it('displays French content correctly', () => {
      cy.visit(`/campaigns/${standardCampaign.id}`, {
        onBeforeLoad: (win) => {
          Object.defineProperty(win.navigator, 'language', {
            value: 'fr'
          });
        }
      });

      cy.wait('@getStandardCampaign');

      cy.findByTestId('campaign-title')
        .should('have.text', standardCampaign.translations.fr.title);

      cy.findByTestId('campaign-description')
        .should('have.text', standardCampaign.translations.fr.description);

      // Verify currency format in French locale
      cy.findByTestId('campaign-goal')
        .should('contain', new Intl.NumberFormat('fr', {
          style: 'currency',
          currency: standardCampaign.currency
        }).format(standardCampaign.goalAmount));
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('provides appropriate ARIA labels and live regions', () => {
      cy.wait('@getStandardCampaign');

      // Check campaign status live region
      cy.findByTestId('campaign-status')
        .should('have.attr', 'aria-live', 'polite');

      // Verify image descriptions
      cy.findAllByTestId('campaign-image')
        .each(($img) => {
          cy.wrap($img)
            .should('have.attr', 'alt')
            .and('have.attr', 'aria-label');
        });

      // Check progress announcements
      cy.findByTestId('campaign-progress-announcement')
        .should('have.attr', 'role', 'status')
        .and('have.attr', 'aria-live', 'polite');
    });
  });
});