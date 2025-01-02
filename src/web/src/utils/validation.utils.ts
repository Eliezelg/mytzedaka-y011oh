/**
 * Core validation utility functions for the International Jewish Association Donation Platform
 * Provides comprehensive validation for forms, data integrity, and business rules
 * with multi-language support (Hebrew, English, French) and currency-specific validations
 * @version 1.0.0
 */

import { EMAIL_REGEX, PASSWORD_REGEX, CURRENCY_REGEX, NAME_REGEX } from '../../backend/src/constants/regex.constant';
import * as yup from 'yup'; // v1.3.2
import validator from 'validator'; // v13.11.0

// Global validation constants
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;
const MIN_DONATION_AMOUNTS = { USD: 5, EUR: 5, ILS: 18 };
const MAX_DONATION_AMOUNTS = { USD: 1000000, EUR: 1000000, ILS: 5000000 };
const CURRENCY_DECIMAL_PLACES = { USD: 2, EUR: 2, ILS: 2 };
const SUPPORTED_LANGUAGES = ['en', 'he', 'fr'] as const;
const CAMPAIGN_TITLE_MAX_LENGTH = 100;
const CAMPAIGN_DESCRIPTION_MAX_LENGTH = 5000;

// Type definitions
type ValidationResult = {
  isValid: boolean;
  error?: string;
};

type CampaignData = {
  title: string;
  description: string;
  goalAmount: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  isLottery?: boolean;
};

type Language = typeof SUPPORTED_LANGUAGES[number];

/**
 * Validates email address format with RFC 5322 compliance
 * @param email - Email address to validate
 * @returns ValidationResult object
 */
export const validateEmail = (email: string): ValidationResult => {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }

  const sanitizedEmail = validator.trim(email).toLowerCase();

  if (!EMAIL_REGEX.test(sanitizedEmail)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
};

/**
 * Validates password strength and compliance with security requirements
 * @param password - Password to validate
 * @returns ValidationResult object
 */
export const validatePassword = (password: string): ValidationResult => {
  if (!password) {
    return { isValid: false, error: 'Password is required' };
  }

  if (password.length < MIN_PASSWORD_LENGTH || password.length > MAX_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must be between ${MIN_PASSWORD_LENGTH} and ${MAX_PASSWORD_LENGTH} characters`
    };
  }

  if (!PASSWORD_REGEX.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'
    };
  }

  return { isValid: true };
};

/**
 * Validates donation amount with currency-specific rules
 * @param amount - Donation amount
 * @param currency - Currency code (USD, EUR, ILS)
 * @param isRecurring - Optional flag for recurring donations
 * @returns ValidationResult object
 */
export const validateDonationAmount = (
  amount: number,
  currency: string,
  isRecurring?: boolean
): ValidationResult => {
  if (!amount || typeof amount !== 'number') {
    return { isValid: false, error: 'Amount is required' };
  }

  const currencyUpper = currency.toUpperCase();
  if (!Object.keys(MIN_DONATION_AMOUNTS).includes(currencyUpper)) {
    return { isValid: false, error: 'Invalid currency' };
  }

  if (amount < MIN_DONATION_AMOUNTS[currencyUpper]) {
    return {
      isValid: false,
      error: `Minimum donation amount is ${MIN_DONATION_AMOUNTS[currencyUpper]} ${currencyUpper}`
    };
  }

  if (amount > MAX_DONATION_AMOUNTS[currencyUpper]) {
    return {
      isValid: false,
      error: `Maximum donation amount is ${MAX_DONATION_AMOUNTS[currencyUpper]} ${currencyUpper}`
    };
  }

  const amountString = amount.toString();
  if (!CURRENCY_REGEX.test(amountString)) {
    return {
      isValid: false,
      error: `Invalid amount format. Maximum ${CURRENCY_DECIMAL_PLACES[currencyUpper]} decimal places allowed`
    };
  }

  // Additional validation for recurring donations
  if (isRecurring && amount < MIN_DONATION_AMOUNTS[currencyUpper] * 2) {
    return {
      isValid: false,
      error: `Minimum recurring donation amount is ${MIN_DONATION_AMOUNTS[currencyUpper] * 2} ${currencyUpper}`
    };
  }

  return { isValid: true };
};

/**
 * Validates name with multi-language support
 * @param name - Name to validate
 * @param language - Optional language code (en, he, fr)
 * @returns ValidationResult object
 */
export const validateName = (name: string, language?: Language): ValidationResult => {
  if (!name || typeof name !== 'string') {
    return { isValid: false, error: 'Name is required' };
  }

  const sanitizedName = validator.trim(name);

  if (!NAME_REGEX.test(sanitizedName)) {
    return {
      isValid: false,
      error: 'Name must contain only letters, hyphens, and apostrophes, and be between 2-50 characters'
    };
  }

  // Additional language-specific validations
  if (language === 'he' && !/[\u0590-\u05FF]/.test(sanitizedName)) {
    return { isValid: false, error: 'Name must contain Hebrew characters' };
  }

  return { isValid: true };
};

/**
 * Validates campaign data
 * @param campaign - Campaign data object
 * @returns ValidationResult object
 */
export const validateCampaign = (campaign: CampaignData): ValidationResult => {
  const campaignSchema = yup.object().shape({
    title: yup
      .string()
      .required('Campaign title is required')
      .max(CAMPAIGN_TITLE_MAX_LENGTH, `Title cannot exceed ${CAMPAIGN_TITLE_MAX_LENGTH} characters`),
    description: yup
      .string()
      .required('Campaign description is required')
      .max(CAMPAIGN_DESCRIPTION_MAX_LENGTH, `Description cannot exceed ${CAMPAIGN_DESCRIPTION_MAX_LENGTH} characters`),
    goalAmount: yup
      .number()
      .required('Goal amount is required')
      .positive('Goal amount must be positive'),
    currency: yup
      .string()
      .required('Currency is required')
      .oneOf(Object.keys(MIN_DONATION_AMOUNTS), 'Invalid currency'),
    startDate: yup
      .date()
      .required('Start date is required')
      .min(new Date(), 'Start date cannot be in the past'),
    endDate: yup
      .date()
      .required('End date is required')
      .min(yup.ref('startDate'), 'End date must be after start date'),
    isLottery: yup.boolean().optional()
  });

  try {
    campaignSchema.validateSync(campaign, { abortEarly: false });
    return { isValid: true };
  } catch (error) {
    if (error instanceof yup.ValidationError) {
      return { isValid: false, error: error.errors[0] };
    }
    return { isValid: false, error: 'Invalid campaign data' };
  }
};