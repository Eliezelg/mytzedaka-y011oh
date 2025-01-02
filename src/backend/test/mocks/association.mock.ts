import { faker } from '@faker-js/faker'; // ^8.0.0
import { Association } from '../../src/modules/association/entities/association.entity';
import { PaymentMethodType } from '../../src/interfaces/payment-gateway.interface';

/**
 * Pre-defined mock templates for common association types
 */
export const mockAssociationTemplates = {
  israeliCharity: {
    registrationType: 'AMUTA',
    country: 'Israel',
    paymentMethods: [PaymentMethodType.ISRAELI_CREDIT_CARD, PaymentMethodType.ISRAELI_DIRECT_DEBIT],
    languages: ['he', 'en']
  },
  internationalCharity: {
    registrationType: 'NGO',
    country: 'United States',
    paymentMethods: [PaymentMethodType.CREDIT_CARD, PaymentMethodType.BANK_TRANSFER],
    languages: ['en', 'he', 'fr']
  }
};

/**
 * Generates a valid Israeli company registration number
 */
const generateIsraeliRegistrationNumber = (): string => {
  return `580${faker.string.numeric(6)}`;
};

/**
 * Generates a valid Israeli tax ID
 */
const generateIsraeliTaxId = (): string => {
  return faker.string.numeric(9);
};

/**
 * Generates culturally appropriate association names
 */
const generateAssociationName = (locale: string): { he: string; en: string } => {
  const hebrewPrefixes = ['בית', 'יד', 'קרן', 'מרכז', 'מוסדות'];
  const hebrewSuffixes = ['חסד', 'צדקה', 'תורה', 'חיים', 'שלום'];
  
  return {
    he: `${faker.helpers.arrayElement(hebrewPrefixes)} ${faker.helpers.arrayElement(hebrewSuffixes)}`,
    en: `${faker.company.name()} Jewish Foundation`
  };
};

/**
 * Creates a mock association entity with realistic test data
 * @param overrides - Optional property overrides
 * @param locale - Locale for generating culturally appropriate content
 * @returns Mock association entity
 */
export const createMockAssociation = (
  overrides: Partial<Association> = {},
  locale: string = 'en'
): Association => {
  faker.setLocale(locale);
  
  const names = generateAssociationName(locale);
  const isIsraeli = locale === 'he' || overrides?.address?.country === 'Israel';
  
  const association = new Association();
  
  // Basic Information
  association.id = faker.string.uuid();
  association.name = names.en;
  association.email = faker.internet.email().toLowerCase();
  association.phone = isIsraeli ? 
    `+972-${faker.string.numeric(2)}-${faker.string.numeric(7)}` :
    faker.phone.number('+1-###-###-####');
  association.description = faker.lorem.paragraphs(2);
  association.website = `https://www.${faker.internet.domainName()}`;
  
  // Registration & Legal
  association.registrationNumber = isIsraeli ? 
    generateIsraeliRegistrationNumber() : 
    faker.string.alphanumeric(10).toUpperCase();
  association.taxId = isIsraeli ? 
    generateIsraeliTaxId() : 
    faker.string.numeric(9);
  
  // Address Information
  association.address = {
    street: faker.location.streetAddress(),
    city: isIsraeli ? faker.helpers.arrayElement(['Jerusalem', 'Tel Aviv', 'Haifa', 'Beer Sheva']) : faker.location.city(),
    state: isIsraeli ? '' : faker.location.state(),
    country: isIsraeli ? 'Israel' : faker.location.country(),
    postalCode: isIsraeli ? faker.string.numeric(7) : faker.location.zipCode()
  };
  
  // Legal Information
  association.legalInfo = {
    registrationType: isIsraeli ? 'AMUTA' : 'NGO',
    registrationDate: faker.date.past(),
    registrationCountry: association.address.country,
    taxExemptionNumber: faker.string.alphanumeric(10).toUpperCase(),
    isNonProfit: true
  };
  
  // Bank Information (Encrypted in production)
  association.bankInfo = {
    bankName: isIsraeli ? 
      faker.helpers.arrayElement(['Bank Leumi', 'Bank Hapoalim', 'Mizrahi Tefahot']) :
      faker.company.name(),
    accountNumber: faker.string.numeric(10),
    routingNumber: faker.string.numeric(9),
    swiftCode: faker.string.alphanumeric(8).toUpperCase(),
    ibanNumber: isIsraeli ? undefined : `IL${faker.string.numeric(20)}`
  };
  
  // Categories & Languages
  association.categories = faker.helpers.arrayElements(
    ['Education', 'Welfare', 'Health', 'Religion', 'Culture'],
    faker.number.int({ min: 1, max: 3 })
  );
  
  association.primaryLanguage = isIsraeli ? 'he' : 'en';
  association.supportedLanguages = isIsraeli ? 
    ['he', 'en'] : 
    ['en', 'he', 'fr'];
  
  // Payment Gateway Configuration
  association.paymentGateways = {
    stripe: isIsraeli ? undefined : {
      accountId: `acct_${faker.string.alphanumeric(16)}`,
      publicKey: `pk_test_${faker.string.alphanumeric(24)}`,
      secretKey: `sk_test_${faker.string.alphanumeric(24)}`,
      webhookSecret: `whsec_${faker.string.alphanumeric(24)}`,
      enabledMethods: [PaymentMethodType.CREDIT_CARD, PaymentMethodType.BANK_TRANSFER]
    },
    tranzilla: isIsraeli ? {
      terminalId: faker.string.numeric(7),
      username: faker.internet.userName(),
      password: faker.internet.password(),
      supplierNumber: faker.string.numeric(5),
      enabledMethods: [PaymentMethodType.ISRAELI_CREDIT_CARD, PaymentMethodType.ISRAELI_DIRECT_DEBIT]
    } : undefined
  };
  
  // Status Information
  association.isVerified = faker.datatype.boolean();
  association.status = faker.helpers.arrayElement(['ACTIVE', 'PENDING', 'INACTIVE', 'SUSPENDED']);
  
  // Timestamps
  association.createdAt = faker.date.past();
  association.updatedAt = faker.date.recent();
  
  // Apply any overrides
  return { ...association, ...overrides };
};

/**
 * Creates an array of mock association entities
 * @param count - Number of mock associations to create
 * @param locale - Locale for generating culturally appropriate content
 * @returns Array of mock associations
 */
export const createMockAssociationArray = (
  count: number,
  locale: string = 'en'
): Association[] => {
  if (count < 1) {
    throw new Error('Count must be greater than 0');
  }
  
  return Array.from({ length: count }, (_, index) => {
    // Alternate between Israeli and international associations
    const associationLocale = index % 2 === 0 ? 'he' : locale;
    return createMockAssociation({}, associationLocale);
  });
};