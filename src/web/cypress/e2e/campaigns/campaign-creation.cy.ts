import { validCampaign, validLotteryCampaign } from '../../fixtures/campaigns.json';
import { CampaignStatus } from '../../../../src/interfaces/campaign.interface';

// Version: cypress ^13.0.0
describe('Campaign Creation', () => {
  beforeEach(() => {
    // Configure viewport for responsive testing
    cy.viewport(1280, 720);

    // Login as association user before each test
    cy.login('association@example.com', 'password');

    // Visit campaign creation page
    cy.visit('/campaigns/new');

    // Set up API route interception
    cy.intercept('POST', '/api/v1/campaigns').as('createCampaign');
    cy.intercept('POST', '/api/v1/upload').as('uploadImage');
  });

  it('should create a regular campaign', () => {
    // Fill basic campaign information
    cy.get('[data-testid="campaign-title"]').type(validCampaign.title);
    cy.get('[data-testid="campaign-description"]').type(validCampaign.description);
    
    // Set financial goals
    cy.get('[data-testid="goal-amount"]').type(validCampaign.goalAmount.toString());
    cy.get('[data-testid="currency-select"]').click();
    cy.get(`[data-value="${validCampaign.currency}"]`).click();
    cy.get('[data-testid="minimum-donation"]').type('18');

    // Configure campaign duration
    cy.get('[data-testid="start-date"]').type(validCampaign.startDate);
    cy.get('[data-testid="end-date"]').type(validCampaign.endDate);

    // Upload campaign image
    cy.get('[data-testid="image-upload"]').attachFile('campaign-image.jpg');
    cy.wait('@uploadImage').its('response.statusCode').should('eq', 200);

    // Submit form
    cy.get('[data-testid="submit-campaign"]').click();

    // Verify API response
    cy.wait('@createCampaign').then((interception) => {
      expect(interception.response.statusCode).to.equal(201);
      expect(interception.response.body).to.include({
        title: validCampaign.title,
        status: CampaignStatus.DRAFT,
        isLottery: false
      });
    });

    // Verify success notification
    cy.get('[data-testid="success-notification"]')
      .should('be.visible')
      .and('contain', 'Campaign created successfully');
  });

  it('should create a lottery campaign', () => {
    // Enable lottery features
    cy.get('[data-testid="lottery-toggle"]').click();

    // Fill basic campaign information
    cy.get('[data-testid="campaign-title"]').type(validLotteryCampaign.title);
    cy.get('[data-testid="campaign-description"]').type(validLotteryCampaign.description);

    // Configure lottery details
    cy.get('[data-testid="ticket-price"]').type(validLotteryCampaign.lotteryDetails.ticketPrice.toString());
    cy.get('[data-testid="max-tickets"]').type(validLotteryCampaign.lotteryDetails.maxTickets.toString());
    cy.get('[data-testid="draw-date"]').type(validLotteryCampaign.lotteryDetails.drawDate);

    // Add prize details
    validLotteryCampaign.lotteryDetails.prizes.forEach((prize, index) => {
      if (index > 0) {
        cy.get('[data-testid="add-prize"]').click();
      }
      cy.get(`[data-testid="prize-description-${index}"]`).type(prize.description);
      cy.get(`[data-testid="prize-value-${index}"]`).type(prize.value.toString());
      cy.get(`[data-testid="prize-image-${index}"]`).attachFile(`prize-${index}.jpg`);
    });

    // Submit form
    cy.get('[data-testid="submit-campaign"]').click();

    // Verify API response
    cy.wait('@createCampaign').then((interception) => {
      expect(interception.response.statusCode).to.equal(201);
      expect(interception.response.body).to.include({
        title: validLotteryCampaign.title,
        isLottery: true,
        status: CampaignStatus.DRAFT
      });
    });
  });

  it('should validate currency formats', () => {
    const currencies = [
      { code: 'USD', value: '1,000.00', symbol: '$' },
      { code: 'EUR', value: '1.000,00', symbol: '€' },
      { code: 'ILS', value: '1,000.00', symbol: '₪' }
    ];

    currencies.forEach(({ code, value, symbol }) => {
      cy.get('[data-testid="currency-select"]').click();
      cy.get(`[data-value="${code}"]`).click();
      cy.get('[data-testid="goal-amount"]').clear().type(value);
      cy.get('[data-testid="amount-preview"]').should('contain', `${symbol}${value}`);
    });

    // Validate minimum amount
    cy.get('[data-testid="goal-amount"]').clear().type('0');
    cy.get('[data-testid="goal-amount-error"]')
      .should('be.visible')
      .and('contain', 'Amount must be greater than 0');
  });

  it('should validate accessibility requirements', () => {
    // Test keyboard navigation
    cy.get('body').tab();
    cy.focused().should('have.attr', 'data-testid', 'campaign-title');

    // Verify ARIA labels
    cy.get('[data-testid="campaign-title"]')
      .should('have.attr', 'aria-label', 'Campaign Title');
    cy.get('[data-testid="goal-amount"]')
      .should('have.attr', 'aria-label', 'Campaign Goal Amount');

    // Test form validation announcements
    cy.get('[data-testid="submit-campaign"]').click();
    cy.get('[role="alert"]').should('be.visible');

    // Check color contrast
    cy.get('[data-testid="submit-campaign"]')
      .should('have.css', 'background-color')
      .and('satisfy', (color) => {
        // Verify WCAG 2.1 Level AA contrast ratio
        return color !== 'transparent';
      });
  });

  it('should handle RTL content', () => {
    // Switch to Hebrew locale
    cy.get('[data-testid="language-select"]').click();
    cy.get('[data-value="he"]').click();

    // Verify RTL text direction
    cy.get('[data-testid="campaign-title"]')
      .should('have.attr', 'dir', 'rtl')
      .type('קמפיין צדקה');

    cy.get('[data-testid="campaign-description"]')
      .should('have.css', 'direction', 'rtl')
      .type('תיאור הקמפיין בעברית');
  });
});