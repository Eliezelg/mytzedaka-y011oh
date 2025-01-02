/**
 * @fileoverview User validation schemas and rules for the International Jewish Association Donation Platform
 * Implements comprehensive validation for user registration, profile updates, and settings
 * with multi-language support (Hebrew, English, French)
 * @version 1.0.0
 */

import * as yup from 'yup'; // v1.3.2
import { User, UserProfile, UserSettings } from '../interfaces/user.interface';
import { validateEmail, validatePassword, validateName } from '../utils/validation.utils';

// Global validation constants
const SUPPORTED_LANGUAGES = ['en', 'fr', 'he'] as const;
const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/;
const EMAIL_RFC5322_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{12,}$/;
const AUTO_LOGOUT_RANGE = { min: 5, max: 60 };

/**
 * Enhanced validation schema for user registration
 * Implements strict validation rules with RFC 5322 email compliance
 */
export const userRegistrationSchema = yup.object().shape({
  email: yup
    .string()
    .required('Email is required')
    .matches(EMAIL_RFC5322_REGEX, 'Invalid email format')
    .test('email-validation', 'Invalid email', (value) => {
      if (!value) return false;
      return validateEmail(value).isValid;
    }),

  password: yup
    .string()
    .required('Password is required')
    .matches(
      PASSWORD_REGEX,
      'Password must contain at least 12 characters, including uppercase, lowercase, number, and special character'
    )
    .test('password-validation', 'Invalid password', (value) => {
      if (!value) return false;
      return validatePassword(value).isValid;
    }),

  firstName: yup
    .string()
    .required('First name is required')
    .test('name-validation', 'Invalid first name', (value) => {
      if (!value) return false;
      return validateName(value).isValid;
    }),

  lastName: yup
    .string()
    .required('Last name is required')
    .test('name-validation', 'Invalid last name', (value) => {
      if (!value) return false;
      return validateName(value).isValid;
    }),

  phoneNumber: yup
    .string()
    .nullable()
    .matches(PHONE_REGEX, 'Invalid phone number format')
    .transform((value) => (value === '' ? null : value)),

  preferredLanguage: yup
    .string()
    .oneOf(SUPPORTED_LANGUAGES, 'Invalid language selection')
    .required('Preferred language is required'),

  recoveryEmail: yup
    .string()
    .nullable()
    .matches(EMAIL_RFC5322_REGEX, 'Invalid recovery email format')
    .transform((value) => (value === '' ? null : value))
});

/**
 * Enhanced validation schema for user profile updates
 * Supports multi-language input and RTL considerations
 */
export const userProfileSchema = yup.object().shape({
  firstName: yup
    .string()
    .required('First name is required')
    .test('name-validation', 'Invalid first name', (value, context) => {
      if (!value) return false;
      return validateName(value, context.parent.preferredLanguage).isValid;
    }),

  lastName: yup
    .string()
    .required('Last name is required')
    .test('name-validation', 'Invalid last name', (value, context) => {
      if (!value) return false;
      return validateName(value, context.parent.preferredLanguage).isValid;
    }),

  phoneNumber: yup
    .string()
    .nullable()
    .matches(PHONE_REGEX, 'Invalid phone number format')
    .transform((value) => (value === '' ? null : value)),

  preferredLanguage: yup
    .string()
    .oneOf(SUPPORTED_LANGUAGES, 'Invalid language selection')
    .required('Preferred language is required'),

  recoveryEmail: yup
    .string()
    .nullable()
    .matches(EMAIL_RFC5322_REGEX, 'Invalid recovery email format')
    .transform((value) => (value === '' ? null : value))
});

/**
 * Enhanced validation schema for user settings
 * Implements security-focused validation rules
 */
export const userSettingsSchema = yup.object().shape({
  twoFactorEnabled: yup
    .boolean()
    .required('Two-factor authentication setting is required'),

  preferredLanguage: yup
    .string()
    .oneOf(SUPPORTED_LANGUAGES, 'Invalid language selection')
    .required('Preferred language is required'),

  emailNotifications: yup
    .boolean()
    .required('Email notification preference is required'),

  autoLogoutTime: yup
    .number()
    .min(AUTO_LOGOUT_RANGE.min, `Auto-logout time must be at least ${AUTO_LOGOUT_RANGE.min} minutes`)
    .max(AUTO_LOGOUT_RANGE.max, `Auto-logout time cannot exceed ${AUTO_LOGOUT_RANGE.max} minutes`)
    .required('Auto-logout time is required')
});

/**
 * Validates user registration data with enhanced security checks
 * @param registrationData - User registration data
 * @returns Promise<boolean> - Validation result
 */
export const validateUserRegistration = async (
  registrationData: Partial<User>
): Promise<boolean> => {
  try {
    await userRegistrationSchema.validate(registrationData, { abortEarly: false });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validates user profile updates with multi-language support
 * @param profileData - User profile data
 * @returns Promise<boolean> - Validation result
 */
export const validateUserProfile = async (
  profileData: Partial<UserProfile>
): Promise<boolean> => {
  try {
    await userProfileSchema.validate(profileData, { abortEarly: false });
    return true;
  } catch (error) {
    return false;
  }
};

/**
 * Validates user settings with security considerations
 * @param settingsData - User settings data
 * @returns Promise<boolean> - Validation result
 */
export const validateUserSettings = async (
  settingsData: Partial<UserSettings>
): Promise<boolean> => {
  try {
    await userSettingsSchema.validate(settingsData, { abortEarly: false });
    return true;
  } catch (error) {
    return false;
  }
};