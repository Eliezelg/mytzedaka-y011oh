/**
 * Payment validation schema and rules for dual payment gateway integration
 * Supports Stripe Connect (international) and Tranzilla (Israeli market)
 * Implements enhanced security validation patterns and fraud prevention
 * @version 1.0.0
 */

import * as yup from 'yup'; // v1.3.2
import { PaymentMethodType, PaymentGateway } from '../interfaces/payment.interface';
import { validateDonationAmount } from '../utils/validation.utils';

// Currency and amount validation constants
const SUPPORTED_CURRENCIES = {
  USD: 'USD',
  EUR: 'EUR',
  ILS: 'ILS'
} as const;

// Card expiry validation constants
const MIN_EXPIRY_MONTHS = 1;
const MAX_EXPIRY_MONTHS = 12;
const CURRENT_YEAR = new Date().getFullYear();
const MAX_FUTURE_YEARS = 20;

// Payment method validation patterns
const CARD_NUMBER_PATTERN = /^(?:[0-9]{16}|[0-9]{15}|[0-9]{14})$/;
const SECURITY_CODE_PATTERN = /^[0-9]{3,4}$/;
const POSTAL_CODE_PATTERNS = {
  US: /^\d{5}(-\d{4})?$/,
  IL: /^\d{5,7}$/,
  DEFAULT: /^[A-Z0-9]{3,10}$/i
};

/**
 * Enhanced validation schema for payment methods with security patterns
 */
export const paymentMethodSchema = yup.object().shape({
  id: yup.string().required('Payment method ID is required'),
  
  type: yup.string()
    .required('Payment method type is required')
    .oneOf(Object.values(PaymentMethodType), 'Invalid payment method type'),
  
  gateway: yup.string()
    .required('Payment gateway is required')
    .oneOf(Object.values(PaymentGateway), 'Invalid payment gateway'),
  
  lastFourDigits: yup.string()
    .when('type', {
      is: PaymentMethodType.CREDIT_CARD,
      then: yup.string()
        .required('Last four digits are required')
        .matches(/^\d{4}$/, 'Invalid card digits format')
    }),
  
  cardBrand: yup.string()
    .when('type', {
      is: PaymentMethodType.CREDIT_CARD,
      then: yup.string().required('Card brand is required')
    }),
  
  cardholderName: yup.string()
    .when('type', {
      is: PaymentMethodType.CREDIT_CARD,
      then: yup.string()
        .required('Cardholder name is required')
        .min(2, 'Name too short')
        .max(50, 'Name too long')
        .matches(/^[\p{L}\p{M}'][\p{L}\p{M}'\s-]{0,48}[\p{L}\p{M}']$/u, 'Invalid name format')
    }),
  
  expiryMonth: yup.number()
    .when('type', {
      is: PaymentMethodType.CREDIT_CARD,
      then: yup.number()
        .required('Expiry month is required')
        .min(MIN_EXPIRY_MONTHS, 'Invalid month')
        .max(MAX_EXPIRY_MONTHS, 'Invalid month')
    }),
  
  expiryYear: yup.number()
    .when('type', {
      is: PaymentMethodType.CREDIT_CARD,
      then: yup.number()
        .required('Expiry year is required')
        .min(CURRENT_YEAR, 'Card expired')
        .max(CURRENT_YEAR + MAX_FUTURE_YEARS, 'Invalid expiry year')
    }),
  
  isDefault: yup.boolean().required('Default status is required'),
  
  billingAddress: yup.object().shape({
    street: yup.string().required('Street is required').max(100, 'Street too long'),
    city: yup.string().required('City is required').max(50, 'City too long'),
    state: yup.string().required('State is required').max(50, 'State too long'),
    postalCode: yup.string()
      .required('Postal code is required')
      .test('postal-code-format', 'Invalid postal code format', function(value) {
        const country = this.parent.country;
        const pattern = POSTAL_CODE_PATTERNS[country] || POSTAL_CODE_PATTERNS.DEFAULT;
        return pattern.test(value);
      }),
    country: yup.string()
      .required('Country is required')
      .length(2, 'Invalid country code')
      .uppercase()
  })
});

/**
 * Enhanced validation schema for payment requests with fraud prevention rules
 */
export const paymentRequestSchema = yup.object().shape({
  amount: yup.number()
    .required('Amount is required')
    .test('valid-amount', 'Invalid amount', function(value) {
      const currency = this.parent.currency;
      if (!value || !currency) return false;
      const validation = validateDonationAmount(value, currency, this.parent.isRecurring);
      return validation.isValid;
    }),
  
  currency: yup.string()
    .required('Currency is required')
    .oneOf(Object.keys(SUPPORTED_CURRENCIES), 'Unsupported currency')
    .test('gateway-currency', 'Currency not supported by gateway', function(value) {
      const gateway = this.parent.gateway;
      if (gateway === PaymentGateway.TRANZILLA && value !== SUPPORTED_CURRENCIES.ILS) {
        return false;
      }
      return true;
    }),
  
  paymentMethodId: yup.string()
    .required('Payment method ID is required')
    .matches(/^[a-zA-Z0-9_-]{10,50}$/, 'Invalid payment method ID format'),
  
  donorId: yup.string()
    .required('Donor ID is required')
    .uuid('Invalid donor ID format'),
  
  associationId: yup.string()
    .required('Association ID is required')
    .uuid('Invalid association ID format'),
  
  campaignId: yup.string()
    .optional()
    .uuid('Invalid campaign ID format'),
  
  isRecurring: yup.boolean()
    .required('Recurring payment flag is required')
    .test('recurring-amount', 'Amount too low for recurring payment', function(value) {
      if (!value) return true;
      const { amount, currency } = this.parent;
      const validation = validateDonationAmount(amount, currency, true);
      return validation.isValid;
    })
});