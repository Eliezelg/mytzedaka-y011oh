import { faker } from '@faker-js/faker'; // ^8.0.0
import { Campaign, CampaignStatus, CampaignLotteryDetails, CampaignPrize } from '../../src/modules/campaign/entities/campaign.entity';

// Constants for mock data generation
const MOCK_CAMPAIGN_CURRENCIES = ['USD', 'EUR', 'ILS'] as const;
const MOCK_CAMPAIGN_STATUSES = Object.values(CampaignStatus);

// Realistic currency ranges for campaign goals
const CURRENCY_RANGES = {
  USD: { min: 1000, max: 1000000 },
  EUR: { min: 1000, max: 1000000 },
  ILS: { min: 5000, max: 5000000 }
};

const DEFAULT_LOTTERY_RATIO = 0.3;

/**
 * Creates a mock campaign entity with realistic data and validation
 * @param overrides Optional partial campaign properties to override defaults
 * @returns A complete mock Campaign entity
 */
export function createMockCampaign(overrides: Partial<Campaign> = {}): Campaign {
  const currency = faker.helpers.arrayElement(MOCK_CAMPAIGN_CURRENCIES);
  const startDate = faker.date.future();
  const endDate = new Date(startDate.getTime() + faker.number.int({ min: 7, max: 90 }) * 24 * 60 * 60 * 1000);
  
  const campaign = {
    id: faker.string.uuid(),
    title: faker.commerce.productName(),
    description: faker.lorem.paragraphs(2),
    goalAmount: faker.number.float({
      min: CURRENCY_RANGES[currency].min,
      max: CURRENCY_RANGES[currency].max,
      precision: 2
    }),
    currency,
    startDate,
    endDate,
    associationId: faker.string.uuid(),
    images: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => 
      faker.image.url()
    ),
    tags: Array.from({ length: faker.number.int({ min: 2, max: 6 }) }, () =>
      faker.word.noun()
    ),
    currentAmount: 0,
    donorCount: 0,
    isLottery: false,
    status: faker.helpers.arrayElement(MOCK_CAMPAIGN_STATUSES),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
    ...overrides
  } as Campaign;

  // Ensure currentAmount doesn't exceed goalAmount
  if (campaign.currentAmount > campaign.goalAmount) {
    campaign.currentAmount = campaign.goalAmount;
  }

  return campaign;
}

/**
 * Creates a mock lottery campaign with realistic prize structure
 * @param overrides Optional partial campaign properties to override defaults
 * @returns A complete mock lottery Campaign entity
 */
export function createMockLotteryCampaign(overrides: Partial<Campaign> = {}): Campaign {
  const baseCampaign = createMockCampaign(overrides);
  const currency = baseCampaign.currency;
  
  const lotteryDetails: CampaignLotteryDetails = {
    drawDate: new Date(baseCampaign.endDate.getTime() - 24 * 60 * 60 * 1000),
    ticketPrice: faker.number.float({
      min: currency === 'ILS' ? 50 : 10,
      max: currency === 'ILS' ? 500 : 100,
      precision: 2
    }),
    currency,
    maxTickets: faker.number.int({ min: 1000, max: 10000 }),
    prizes: generatePrizeStructure(currency, baseCampaign.goalAmount)
  };

  return {
    ...baseCampaign,
    isLottery: true,
    lotteryDetails,
    ...overrides
  } as Campaign;
}

/**
 * Creates an array of mixed campaign types with realistic distribution
 * @param count Number of campaigns to generate
 * @param options Configuration options for campaign generation
 * @returns Array of mock campaign entities
 */
export function createMockCampaignArray(
  count: number,
  options: { lotteryRatio?: number } = {}
): Campaign[] {
  if (count < 1) {
    throw new Error('Count must be greater than 0');
  }

  const lotteryRatio = options.lotteryRatio ?? DEFAULT_LOTTERY_RATIO;
  const lotteryCount = Math.floor(count * lotteryRatio);
  const regularCount = count - lotteryCount;

  const campaigns: Campaign[] = [
    ...Array.from({ length: regularCount }, () => createMockCampaign()),
    ...Array.from({ length: lotteryCount }, () => createMockLotteryCampaign())
  ];

  // Shuffle array to mix campaign types
  return campaigns.sort(() => Math.random() - 0.5);
}

/**
 * Generates a realistic prize structure for lottery campaigns
 * @param currency Campaign currency
 * @param goalAmount Campaign goal amount
 * @returns Array of prize details
 */
function generatePrizeStructure(currency: string, goalAmount: number): CampaignPrize[] {
  const prizeCount = faker.number.int({ min: 3, max: 10 });
  const maxPrizeValue = goalAmount * 0.5; // Maximum prize is 50% of goal

  return Array.from({ length: prizeCount }, (_, index) => {
    const rank = index + 1;
    const value = rank === 1
      ? faker.number.float({ min: maxPrizeValue * 0.2, max: maxPrizeValue, precision: 2 })
      : faker.number.float({ 
          min: maxPrizeValue * 0.01, 
          max: maxPrizeValue * 0.1, 
          precision: 2 
        });

    return {
      name: `${rank === 1 ? 'Grand' : rank === 2 ? 'Second' : rank === 3 ? 'Third' : `${rank}th`} Prize`,
      description: faker.commerce.productDescription(),
      value,
      currency,
      rank
    };
  }).sort((a, b) => a.rank - b.rank);
}