/**
 * @fileoverview Authentication form validation schemas using Yup
 * @version 1.0.0
 */

import { object, string, ref } from 'yup'; // yup v1.2.0
import { User } from '../interfaces/user.interface';
import { VALIDATION_RULES } from '../config/constants';

/**
 * Regular expressions for validation
 */
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const HEBREW_CHAR_REGEX = /[\u0590-\u05ff]/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*])[A-Za-z\d!@#$%^&*]{8,}$/;

/**
 * Validation constants
 */
const PASSWORD_MIN_LENGTH = VALIDATION_RULES.PASSWORD_MIN_LENGTH;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 50;
const OTP_LENGTH = 6;

/**
 * Enhanced password validation with comprehensive security rules
 */
const validatePassword = (value: string): boolean => {
  return PASSWORD_REGEX.test(value);
};

/**
 * Hebrew name validation supporting Hebrew characters
 */
const validateHebrewName = (value: string): boolean => {
  return HEBREW_CHAR_REGEX.test(value) && 
         value.length >= NAME_MIN_LENGTH && 
         value.length <= NAME_MAX_LENGTH;
};

/**
 * Login form validation schema
 */
export const loginSchema = object().shape({
  email: string()
    .required('auth.validation.email.required')
    .email('auth.validation.email.invalid')
    .matches(EMAIL_REGEX, 'auth.validation.email.format')
    .max(255, 'auth.validation.email.maxLength'),
  
  password: string()
    .required('auth.validation.password.required')
    .min(PASSWORD_MIN_LENGTH, 'auth.validation.password.minLength')
    .test('password-strength', 'auth.validation.password.strength', validatePassword)
});

/**
 * Registration form validation schema with enhanced security
 */
export const registerSchema = object().shape({
  email: string()
    .required('auth.validation.email.required')
    .email('auth.validation.email.invalid')
    .matches(EMAIL_REGEX, 'auth.validation.email.format')
    .max(255, 'auth.validation.email.maxLength'),
  
  password: string()
    .required('auth.validation.password.required')
    .min(PASSWORD_MIN_LENGTH, 'auth.validation.password.minLength')
    .test('password-strength', 'auth.validation.password.strength', validatePassword),
  
  confirmPassword: string()
    .required('auth.validation.confirmPassword.required')
    .oneOf([ref('password')], 'auth.validation.confirmPassword.match'),
  
  firstName: string()
    .required('auth.validation.firstName.required')
    .min(NAME_MIN_LENGTH, 'auth.validation.firstName.minLength')
    .max(NAME_MAX_LENGTH, 'auth.validation.firstName.maxLength')
    .test('hebrew-name', 'auth.validation.firstName.hebrew', validateHebrewName),
  
  lastName: string()
    .required('auth.validation.lastName.required')
    .min(NAME_MIN_LENGTH, 'auth.validation.lastName.minLength')
    .max(NAME_MAX_LENGTH, 'auth.validation.lastName.maxLength')
    .test('hebrew-name', 'auth.validation.lastName.hebrew', validateHebrewName)
});

/**
 * Password reset request validation schema
 */
export const resetPasswordSchema = object().shape({
  email: string()
    .required('auth.validation.email.required')
    .email('auth.validation.email.invalid')
    .matches(EMAIL_REGEX, 'auth.validation.email.format')
    .max(255, 'auth.validation.email.maxLength')
});

/**
 * New password validation schema for password reset
 */
export const newPasswordSchema = object().shape({
  password: string()
    .required('auth.validation.password.required')
    .min(PASSWORD_MIN_LENGTH, 'auth.validation.password.minLength')
    .test('password-strength', 'auth.validation.password.strength', validatePassword),
  
  confirmPassword: string()
    .required('auth.validation.confirmPassword.required')
    .oneOf([ref('password')], 'auth.validation.confirmPassword.match')
});

/**
 * Two-factor authentication code validation schema
 */
export const twoFactorSchema = object().shape({
  code: string()
    .required('auth.validation.twoFactor.required')
    .length(OTP_LENGTH, 'auth.validation.twoFactor.length')
    .matches(/^\d+$/, 'auth.validation.twoFactor.numeric')
});

/**
 * Change password validation schema
 */
export const changePasswordSchema = object().shape({
  currentPassword: string()
    .required('auth.validation.currentPassword.required'),
  
  newPassword: string()
    .required('auth.validation.newPassword.required')
    .min(PASSWORD_MIN_LENGTH, 'auth.validation.newPassword.minLength')
    .test('password-strength', 'auth.validation.newPassword.strength', validatePassword)
    .notOneOf([ref('currentPassword')], 'auth.validation.newPassword.different'),
  
  confirmPassword: string()
    .required('auth.validation.confirmPassword.required')
    .oneOf([ref('newPassword')], 'auth.validation.confirmPassword.match')
});