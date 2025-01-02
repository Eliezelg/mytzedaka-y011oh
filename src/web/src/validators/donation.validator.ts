/**
 * Comprehensive donation validation module for the International Jewish Association Donation Platform
 * Implements enhanced security validation patterns and compliance rules for international and Israeli markets
 * @version 1.0.0
 */

import * as yup from 'yup'; // v1.3.2
import i18next from 'i18next'; // v23.5.1
import { IDonation, IDonationForm } from '../interfaces/donation.interface';
import { validateDonationAmount } from '../utils/validation.utils';
import { validatePaymentMethod } from './payment.validator';
import { validateCampaign } from './campaign.validator';

// Global validation constants
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'ILS', 'GBP', 'CAD', 'AUD'];
export const RECURRING_FREQUENCIES = ['weekly', 'monthly', 'quarterly', 'annual'];
export const MIN_DONATION_AMOUNTS = {
  USD: 5,
  EUR: 5,
  ILS: 18,
  GBP: 5,
  CAD: 5,
  AUD: 5
};
export const MAX_DONATION_AMOUNTS = {
  USD: 1000000,
  EUR: 1000000,
  ILS: 5000000,
  GBP: 1000000,
  CAD: 1000000,
  AUD: 1000000
};
export const VALIDATION_PATTERNS = {
  amount: /^\d+(\.\d{1,2})?$/,
  email: /^[^@]+@[^@]+\.[^@]+$/,
  phone: /^\+?[1-9]\d{1,14}$/
};

// Validation error and warning types
interface ValidationError {
  field: string;
  code: string;
  message: string;
}

interface ValidationWarning {
  field: string;
  code: string;
  message: string;
}

/**
 * Enhanced Yup schema for donation validation with comprehensive security rules
 */
export const donationSchema = yup.object().shape({
  amount: yup.number()
    .required('donation.amount.required')
    .test('valid-amount', 'donation.amount.invalid', function(value) {
      const { currency, isRecurring } = this.parent;
      if (!value || !currency) return false;
      return validateDonationAmount(value, currency, isRecurring).isValid;
    }),

  currency: yup.string()
    .required('donation.currency.required')
    .oneOf(SUPPORTED_CURRENCIES, 'donation.currency.unsupported'),

  paymentMethodType: yup.string()
    .required('donation.paymentMethod.required'),

  paymentGateway: yup.string()
    .required('donation.gateway.required')
    .test('valid-gateway', 'donation.gateway.invalid', function(value) {
      const { currency } = this.parent;
      if (value === 'TRANZILLA' && currency !== 'ILS') {
        return false;
      }
      return true;
    }),

  associationId: yup.string()
    .required('donation.association.required')
    .uuid('donation.association.invalid'),

  campaignId: yup.string()
    .nullable()
    .test('valid-campaign', 'donation.campaign.invalid', async function(value) {
      if (!value) return true;
      const campaign = await validateCampaign({ id: value });
      return campaign.isValid;
    }),

  isAnonymous: yup.boolean()
    .required('donation.anonymous.required'),

  isRecurring: yup.boolean()
    .required('donation.recurring.required'),

  recurringFrequency: yup.string()
    .when('isRecurring', {
      is: true,
      then: yup.string()
        .required('donation.frequency.required')
        .oneOf(RECURRING_FREQUENCIES, 'donation.frequency.invalid'),
      otherwise: yup.string().nullable()
    }),

  taxReceiptRequired: yup.boolean()
    .required('donation.taxReceipt.required')
});

/**
 * Validates a complete donation object with enhanced security checks
 * @param donation - Donation object to validate
 * @returns Validation result with detailed errors and warnings
 */
export const validateDonation = async (donation: IDonation): Promise<{
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Validate basic donation structure
    await donationSchema.validate(donation, { abortEarly: false });

    // Enhanced payment method validation
    const paymentValidation = await validatePaymentMethod({
      type: donation.paymentMethodType,
      gateway: donation.paymentGateway
    });

    if (!paymentValidation.isValid) {
      errors.push({
        field: 'paymentMethod',
        code: 'INVALID_PAYMENT_METHOD',
        message: paymentValidation.error || 'Invalid payment method'
      });
    }

    // Campaign-specific validation
    if (donation.campaignId) {
      const campaignValidation = await validateCampaign({ id: donation.campaignId });
      if (!campaignValidation.isValid) {
        errors.push({
          field: 'campaignId',
          code: 'INVALID_CAMPAIGN',
          message: campaignValidation.error || 'Invalid campaign'
        });
      }
    }

    // Recurring donation validation
    if (donation.isRecurring) {
      const minAmount = MIN_DONATION_AMOUNTS[donation.currency] * 2;
      if (donation.amount < minAmount) {
        errors.push({
          field: 'amount',
          code: 'RECURRING_AMOUNT_TOO_LOW',
          message: `Minimum recurring donation amount is ${minAmount} ${donation.currency}`
        });
      }
    }

    // Add warnings for large donations
    const warningThreshold = MAX_DONATION_AMOUNTS[donation.currency] * 0.75;
    if (donation.amount > warningThreshold) {
      warnings.push({
        field: 'amount',
        code: 'LARGE_DONATION',
        message: 'Large donation amount detected'
      });
    }

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      error.inner.forEach((err) => {
        errors.push({
          field: err.path || 'unknown',
          code: 'VALIDATION_ERROR',
          message: i18next.t(err.message)
        });
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};

/**
 * Validates donation form data with enhanced user feedback
 * @param form - Donation form data to validate
 * @returns Validation result with detailed errors and warnings
 */
export const validateDonationForm = async (form: IDonationForm): Promise<{
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}> => {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    // Basic form validation
    await donationSchema.validate(form, { abortEarly: false });

    // Amount validation with currency-specific rules
    const amountValidation = validateDonationAmount(form.amount, form.currency);
    if (!amountValidation.isValid) {
      errors.push({
        field: 'amount',
        code: 'INVALID_AMOUNT',
        message: amountValidation.error || 'Invalid amount'
      });
    }

    // Payment method validation
    const paymentValidation = await validatePaymentMethod({
      type: form.paymentMethodType,
      gateway: form.paymentGateway
    });

    if (!paymentValidation.isValid) {
      errors.push({
        field: 'paymentMethod',
        code: 'INVALID_PAYMENT_METHOD',
        message: paymentValidation.error || 'Invalid payment method'
      });
    }

    // Add warnings for potentially problematic scenarios
    if (form.isAnonymous && form.taxReceiptRequired) {
      warnings.push({
        field: 'isAnonymous',
        code: 'ANONYMOUS_TAX_RECEIPT',
        message: 'Tax receipt may not be available for anonymous donations'
      });
    }

  } catch (error) {
    if (error instanceof yup.ValidationError) {
      error.inner.forEach((err) => {
        errors.push({
          field: err.path || 'unknown',
          code: 'VALIDATION_ERROR',
          message: i18next.t(err.message)
        });
      });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
};