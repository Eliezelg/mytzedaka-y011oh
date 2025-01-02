import { faker } from '@faker-js/faker';
import { PaymentMethodType, PaymentStatus } from '../../src/interfaces/payment-gateway.interface';
import { CreateDonationDto } from '../../src/modules/donation/dto/create-donation.dto';

// Supported currencies with their minimum and maximum donation amounts
const CURRENCY_CONFIGS = {
  USD: { min: 1, max: 1000000, symbol: '$' },
  EUR: { min: 1, max: 1000000, symbol: '€' },
  ILS: { min: 3, max: 3500000, symbol: '₪' }
} as const;

// Payment method mappings by currency for realistic test data
const CURRENCY_PAYMENT_METHODS: Record<string, PaymentMethodType[]> = {
  USD: [PaymentMethodType.CREDIT_CARD, PaymentMethodType.DIRECT_DEBIT],
  EUR: [PaymentMethodType.CREDIT_CARD, PaymentMethodType.DIRECT_DEBIT],
  ILS: [PaymentMethodType.ISRAELI_CREDIT_CARD, PaymentMethodType.ISRAELI_DIRECT_DEBIT]
};

// Recurring donation frequencies
const RECURRING_FREQUENCIES = ['monthly', 'quarterly', 'annual'] as const;

interface MockDonationOverrides {
  amount?: number;
  currency?: keyof typeof CURRENCY_CONFIGS;
  paymentMethodType?: PaymentMethodType;
  associationId?: string;
  campaignId?: string;
  isAnonymous?: boolean;
  isRecurring?: boolean;
  recurringFrequency?: typeof RECURRING_FREQUENCIES[number];
  status?: PaymentStatus;
}

/**
 * Creates a PCI-compliant mock donation object with secure random data
 * @param overrides Optional overrides for specific donation properties
 * @returns A validated mock donation object
 */
export function createMockDonation(overrides: MockDonationOverrides = {}): Record<string, any> {
  const currency = overrides.currency || faker.helpers.arrayElement(Object.keys(CURRENCY_CONFIGS)) as keyof typeof CURRENCY_CONFIGS;
  const currencyConfig = CURRENCY_CONFIGS[currency];
  
  // Generate PCI-compliant random amount between configured limits
  const amount = overrides.amount || 
    faker.number.float({ 
      min: currencyConfig.min,
      max: currencyConfig.max,
      precision: 2 
    });

  // Select appropriate payment method based on currency
  const availablePaymentMethods = CURRENCY_PAYMENT_METHODS[currency];
  const paymentMethodType = overrides.paymentMethodType || 
    faker.helpers.arrayElement(availablePaymentMethods);

  const isRecurring = overrides.isRecurring ?? faker.datatype.boolean();
  const recurringFrequency = isRecurring ? 
    (overrides.recurringFrequency || faker.helpers.arrayElement(RECURRING_FREQUENCIES)) : 
    undefined;

  return {
    id: faker.string.uuid(),
    amount,
    currency,
    paymentMethodType,
    associationId: overrides.associationId || faker.string.uuid(),
    campaignId: overrides.campaignId || faker.string.uuid(),
    donorId: faker.string.uuid(),
    isAnonymous: overrides.isAnonymous ?? faker.datatype.boolean(),
    isRecurring,
    recurringFrequency,
    status: overrides.status || PaymentStatus.COMPLETED,
    transactionId: faker.string.alphanumeric({ length: 24, casing: 'upper' }),
    createdAt: faker.date.recent(),
    updatedAt: faker.date.recent(),
    metadata: {
      ipAddress: faker.internet.ip(),
      userAgent: faker.internet.userAgent(),
      riskScore: faker.number.float({ min: 0, max: 100, precision: 2 })
    }
  };
}

/**
 * Creates a validated mock CreateDonationDto object
 * @param overrides Optional overrides for specific DTO properties
 * @returns A validated mock CreateDonationDto object
 */
export function createMockDonationDto(overrides: Partial<CreateDonationDto> = {}): CreateDonationDto {
  const currency = overrides.currency || faker.helpers.arrayElement(Object.keys(CURRENCY_CONFIGS)) as keyof typeof CURRENCY_CONFIGS;
  const currencyConfig = CURRENCY_CONFIGS[currency];

  const dto = new CreateDonationDto();
  dto.amount = overrides.amount || 
    faker.number.float({ 
      min: currencyConfig.min,
      max: currencyConfig.max,
      precision: 2 
    });
  dto.currency = currency;
  dto.paymentMethodType = overrides.paymentMethodType || 
    faker.helpers.arrayElement(CURRENCY_PAYMENT_METHODS[currency]);
  dto.associationId = overrides.associationId || faker.string.uuid();
  dto.campaignId = overrides.campaignId || faker.string.uuid();
  dto.isAnonymous = overrides.isAnonymous ?? faker.datatype.boolean();
  dto.isRecurring = overrides.isRecurring ?? faker.datatype.boolean();
  
  if (dto.isRecurring) {
    dto.recurringFrequency = overrides.recurringFrequency || 
      faker.helpers.arrayElement(RECURRING_FREQUENCIES);
  }

  return dto;
}

/**
 * Creates an array of validated mock donations with memory optimization
 * @param count Number of mock donations to generate
 * @returns Array of validated mock donation objects
 */
export function createMockDonationArray(count: number): Record<string, any>[] {
  // Input validation
  const safeCount = Math.min(Math.max(1, count), 1000);
  
  // Memory-optimized array generation
  return Array.from({ length: safeCount }, () => createMockDonation());
}