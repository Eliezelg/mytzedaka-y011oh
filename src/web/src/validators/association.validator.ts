import * as yup from 'yup'; // v1.3.2
import { Stripe } from '@stripe/stripe-js'; // v2.1.0
import { IAssociation, IAssociationStatus } from '../interfaces/association.interface';
import { validateEmail, validateName } from '../utils/validation.utils';

// Global validation constants
const SUPPORTED_LANGUAGES = ['en', 'he', 'fr'] as const;
const SUPPORTED_COUNTRIES = ['IL', 'US', 'FR', 'GB'] as const;
const CURRENCY_CODES = ['USD', 'ILS', 'EUR', 'GBP'] as const;
const MIN_NAME_LENGTH = 3;
const MAX_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;
const SOCIAL_MEDIA_PLATFORMS = ['facebook', 'twitter', 'instagram', 'linkedin'] as const;

// Country-specific tax ID validation patterns
const TAX_ID_PATTERNS = {
    IL: /^\d{9}$/, // Israeli tax ID (9 digits)
    US: /^\d{2}-\d{7}$/, // US EIN format
    FR: /^[0-9A-Z]{14}$/, // French SIRET
    GB: /^[0-9]{7}$/ // UK Charity Number
};

// Helper function to validate multi-language content
const createMultiLanguageValidator = (fieldName: string, minLength: number, maxLength: number) => {
    return yup.object().shape(
        SUPPORTED_LANGUAGES.reduce((acc, lang) => ({
            ...acc,
            [lang]: yup.string()
                .min(minLength, `${fieldName} in ${lang} must be at least ${minLength} characters`)
                .max(maxLength, `${fieldName} in ${lang} must not exceed ${maxLength} characters`)
                .when('supportedLanguages', {
                    is: (languages: string[]) => languages.includes(lang),
                    then: yup.string().required(`${fieldName} is required for ${lang}`)
                })
        }), {})
    );
};

// Payment gateway validation schemas
const stripeGatewaySchema = yup.object().shape({
    accountId: yup.string().required('Stripe account ID is required'),
    enabled: yup.boolean(),
    capabilities: yup.array().of(yup.string()),
    currencies: yup.array().of(
        yup.string().oneOf(CURRENCY_CODES, 'Invalid currency code')
    )
});

const tranzillaGatewaySchema = yup.object().shape({
    terminalId: yup.string().required('Tranzilla terminal ID is required'),
    enabled: yup.boolean(),
    merchantId: yup.string().required('Merchant ID is required'),
    supportedCards: yup.array().of(yup.string())
});

// Main association validation schema
export const associationValidationSchema = yup.object().shape({
    id: yup.string().uuid('Invalid association ID'),

    // Multi-language name and description validation
    name: createMultiLanguageValidator('Name', MIN_NAME_LENGTH, MAX_NAME_LENGTH),
    description: createMultiLanguageValidator('Description', MIN_NAME_LENGTH, MAX_DESCRIPTION_LENGTH),

    // Contact information validation
    email: yup.string()
        .required('Email is required')
        .test('email', 'Invalid email format', value => validateEmail(value).isValid),

    phone: yup.string()
        .required('Phone number is required')
        .matches(/^\+?[1-9]\d{7,14}$/, 'Invalid phone number format'),

    website: yup.string()
        .url('Invalid website URL')
        .required('Website is required'),

    socialMedia: yup.object().shape(
        SOCIAL_MEDIA_PLATFORMS.reduce((acc, platform) => ({
            ...acc,
            [platform]: yup.string().url(`Invalid ${platform} URL`)
        }), {})
    ),

    // Address validation
    address: yup.object().shape({
        street: yup.string().required('Street address is required'),
        city: yup.string().required('City is required'),
        state: yup.string().required('State/Province is required'),
        country: yup.string()
            .required('Country is required')
            .oneOf(SUPPORTED_COUNTRIES, 'Unsupported country'),
        postalCode: yup.string().required('Postal code is required'),
        coordinates: yup.object().shape({
            latitude: yup.number().required('Latitude is required'),
            longitude: yup.number().required('Longitude is required')
        })
    }),

    // Legal information validation
    legalInfo: yup.object().shape({
        registrationNumber: yup.string()
            .required('Registration number is required')
            .test('registration-format', 'Invalid registration number format', 
                (value, context) => {
                    const country = context.parent.registrationCountry;
                    return TAX_ID_PATTERNS[country].test(value);
                }),
        taxId: yup.string().required('Tax ID is required'),
        registrationDate: yup.date()
            .required('Registration date is required')
            .max(new Date(), 'Registration date cannot be in the future'),
        registrationCountry: yup.string()
            .required('Registration country is required')
            .oneOf(SUPPORTED_COUNTRIES, 'Unsupported country'),
        legalStatus: yup.string().required('Legal status is required'),
        complianceDocuments: yup.array().of(
            yup.object().shape({
                type: yup.string().required('Document type is required'),
                url: yup.string().url('Invalid document URL').required('Document URL is required'),
                expiryDate: yup.date().required('Document expiry date is required')
            })
        )
    }),

    // Classification and language support
    categories: yup.array()
        .of(yup.string())
        .min(1, 'At least one category is required'),

    primaryLanguage: yup.string()
        .required('Primary language is required')
        .oneOf(SUPPORTED_LANGUAGES, 'Unsupported language'),

    supportedLanguages: yup.array()
        .of(yup.string().oneOf(SUPPORTED_LANGUAGES, 'Unsupported language'))
        .min(1, 'At least one supported language is required'),

    // Payment gateway validation
    paymentGateways: yup.object().shape({
        stripe: stripeGatewaySchema,
        tranzilla: tranzillaGatewaySchema,
        defaultGateway: yup.string()
            .required('Default payment gateway is required')
            .oneOf(['stripe', 'tranzilla'], 'Invalid payment gateway'),
        supportedCurrencies: yup.array()
            .of(yup.string().oneOf(CURRENCY_CODES, 'Invalid currency code'))
            .min(1, 'At least one currency must be supported')
    }),

    // Verification and status
    isVerified: yup.boolean().required('Verification status is required'),
    verificationDetails: yup.object().shape({
        lastVerified: yup.date(),
        verifiedBy: yup.string(),
        documents: yup.array().of(
            yup.object().shape({
                type: yup.string().required('Document type is required'),
                url: yup.string().url('Invalid document URL').required('Document URL is required')
            })
        )
    }),
    status: yup.string()
        .required('Association status is required')
        .oneOf(Object.values(IAssociationStatus), 'Invalid association status'),

    // Operational settings
    settings: yup.object().shape({
        autoApprovalThreshold: yup.number()
            .min(0, 'Auto approval threshold must be non-negative'),
        defaultCurrency: yup.string()
            .required('Default currency is required')
            .oneOf(CURRENCY_CODES, 'Invalid currency code'),
        notificationPreferences: yup.object()
    }),

    // Timestamps
    createdAt: yup.date().required('Creation date is required'),
    updatedAt: yup.date().required('Update date is required')
});

export default associationValidationSchema;