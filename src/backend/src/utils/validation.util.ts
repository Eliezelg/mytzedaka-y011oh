/**
 * Comprehensive validation utilities for the International Jewish Association Donation Platform
 * Provides input validation with multi-language support (Hebrew, English, French)
 * Version: 1.0.0
 */

import { EMAIL_REGEX, PASSWORD_REGEX, CURRENCY_REGEX } from '../constants/regex.constant';
import { Messages } from '../constants/messages.constant';

// Type definitions for validation results
interface ValidationResult {
  isValid: boolean;
  error?: string;
  details?: Record<string, string>;
}

interface ValidationOptions {
  language?: 'en' | 'he' | 'fr';
  strict?: boolean;
}

// Global constants for donation validation
const MIN_DONATION_AMOUNT = 1;
const MAX_DONATION_AMOUNT = 1000000;
const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'ILS'] as const;
const CURRENCY_DECIMAL_PLACES: Record<typeof SUPPORTED_CURRENCIES[number], number> = {
  USD: 2,
  EUR: 2,
  ILS: 2
};

/**
 * Validates email format with enhanced security checks
 * @param email - Email address to validate
 * @param options - Validation options including language preference
 * @returns ValidationResult with validation status and error message if invalid
 */
export function validateEmail(
  email: string,
  options: ValidationOptions = { language: 'en' }
): ValidationResult {
  // Sanitize input
  const sanitizedEmail = email?.trim().toLowerCase();

  // Basic validation
  if (!sanitizedEmail) {
    return {
      isValid: false,
      error: Messages.VALIDATION.REQUIRED_FIELD.templates[options.language || 'en']
        .replace('{field}', 'email')
    };
  }

  // Length validation
  if (sanitizedEmail.length > 254) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'email')
    };
  }

  // Pattern validation
  if (!EMAIL_REGEX.test(sanitizedEmail)) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'email')
    };
  }

  // Domain validation
  const [, domain] = sanitizedEmail.split('@');
  if (!domain || domain.length > 253 || !domain.includes('.')) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'email')
    };
  }

  return { isValid: true };
}

/**
 * Validates password strength with comprehensive security rules
 * @param password - Password to validate
 * @param options - Validation options including language preference
 * @returns ValidationResult with validation status and detailed strength assessment
 */
export function validatePassword(
  password: string,
  options: ValidationOptions = { language: 'en' }
): ValidationResult {
  if (!password) {
    return {
      isValid: false,
      error: Messages.VALIDATION.REQUIRED_FIELD.templates[options.language || 'en']
        .replace('{field}', 'password')
    };
  }

  // Length validation
  if (password.length < 8 || password.length > 64) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'password')
    };
  }

  // Pattern validation using PASSWORD_REGEX
  if (!PASSWORD_REGEX.test(password)) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'password')
    };
  }

  // Check for sequential characters
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/.test(password.toLowerCase())) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'password')
    };
  }

  return { isValid: true };
}

/**
 * Validates donation amount with currency format and range checks
 * @param amount - Donation amount to validate
 * @param currency - Currency code (USD, EUR, ILS)
 * @param options - Validation options including language preference
 * @returns ValidationResult with validation status and formatted amount
 */
export function validateDonationAmount(
  amount: number,
  currency: typeof SUPPORTED_CURRENCIES[number],
  options: ValidationOptions = { language: 'en' }
): ValidationResult {
  // Currency validation
  if (!SUPPORTED_CURRENCIES.includes(currency)) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'currency')
    };
  }

  // Amount range validation
  if (amount < MIN_DONATION_AMOUNT || amount > MAX_DONATION_AMOUNT) {
    return {
      isValid: false,
      error: Messages.VALIDATION.AMOUNT_RANGE.templates[options.language || 'en']
        .replace('{min}', MIN_DONATION_AMOUNT.toString())
        .replace('{max}', MAX_DONATION_AMOUNT.toString())
    };
  }

  // Format validation
  const decimalPlaces = CURRENCY_DECIMAL_PLACES[currency];
  const amountStr = amount.toFixed(decimalPlaces);
  
  if (!CURRENCY_REGEX.test(amountStr)) {
    return {
      isValid: false,
      error: Messages.VALIDATION.INVALID_FORMAT.templates[options.language || 'en']
        .replace('{field}', 'amount')
    };
  }

  return {
    isValid: true,
    details: {
      formattedAmount: amountStr
    }
  };
}

/**
 * Validates presence and format of required fields in nested objects
 * @param data - Object containing fields to validate
 * @param requiredFields - Array of required field paths
 * @param options - Validation options including language preference
 * @returns ValidationResult with validation errors for each field
 */
export function validateRequiredFields(
  data: Record<string, any>,
  requiredFields: string[],
  options: ValidationOptions = { language: 'en', strict: true }
): ValidationResult {
  const errors: Record<string, string> = {};

  for (const field of requiredFields) {
    const fieldParts = field.split('.');
    let value = data;
    let isValid = true;

    // Traverse nested object path
    for (const part of fieldParts) {
      if (value === undefined || value === null) {
        isValid = false;
        break;
      }
      value = value[part];
    }

    // Validate field presence
    if (!isValid || value === undefined || value === null || value === '') {
      errors[field] = Messages.VALIDATION.REQUIRED_FIELD.templates[options.language || 'en']
        .replace('{field}', field);
      continue;
    }

    // Type-specific validation for known fields
    if (field.endsWith('email') && typeof value === 'string') {
      const emailValidation = validateEmail(value, options);
      if (!emailValidation.isValid) {
        errors[field] = emailValidation.error!;
      }
    } else if (field.endsWith('amount') && typeof value === 'number') {
      const amountValidation = validateDonationAmount(value, 'USD', options);
      if (!amountValidation.isValid) {
        errors[field] = amountValidation.error!;
      }
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    details: errors
  };
}