/**
 * Data Transfer Object (DTO) for user registration with comprehensive validation
 * Supports multi-language inputs (Hebrew, English, French) and enforces security requirements
 * @version 1.0.0
 */

import { IsEmail, IsString, IsNotEmpty, Matches, IsIn } from 'class-validator'; // v0.14.0
import { EMAIL_REGEX, PASSWORD_REGEX, NAME_REGEX } from '../../../constants/regex.constant';

/**
 * Supported language codes for the platform
 */
const SUPPORTED_LANGUAGES = ['he', 'en', 'fr'];

/**
 * RegisterDto - Validates user registration data with strong typing and security rules
 * Implements multi-language support and comprehensive input validation
 */
export class RegisterDto {
  /**
   * User's email address
   * Validated using:
   * - RFC 5322 compliant email format
   * - Custom regex for additional security checks
   * - Required field validation
   */
  @IsEmail({}, { message: 'Invalid email format' })
  @IsNotEmpty({ message: 'Email is required' })
  @Matches(EMAIL_REGEX, { message: 'Email format is invalid' })
  email: string;

  /**
   * User's password
   * Must meet security requirements:
   * - 8-64 characters
   * - At least 1 uppercase letter
   * - At least 1 lowercase letter
   * - At least 1 number
   * - At least 1 special character
   */
  @IsString({ message: 'Password must be a string' })
  @IsNotEmpty({ message: 'Password is required' })
  @Matches(PASSWORD_REGEX, {
    message: 'Password must be 8-64 characters long and include uppercase, lowercase, number, and special character'
  })
  password: string;

  /**
   * User's first name
   * Supports Hebrew, English, and French characters
   * Length: 2-50 characters
   */
  @IsString({ message: 'First name must be a string' })
  @IsNotEmpty({ message: 'First name is required' })
  @Matches(NAME_REGEX, {
    message: 'First name must be 2-50 characters and contain only valid characters'
  })
  firstName: string;

  /**
   * User's last name
   * Supports Hebrew, English, and French characters
   * Length: 2-50 characters
   */
  @IsString({ message: 'Last name must be a string' })
  @IsNotEmpty({ message: 'Last name is required' })
  @Matches(NAME_REGEX, {
    message: 'Last name must be 2-50 characters and contain only valid characters'
  })
  lastName: string;

  /**
   * User's preferred language for platform interaction
   * Supported values: 'he' (Hebrew), 'en' (English), 'fr' (French)
   */
  @IsString({ message: 'Language must be a string' })
  @IsNotEmpty({ message: 'Language preference is required' })
  @IsIn(SUPPORTED_LANGUAGES, { message: 'Invalid language selection' })
  preferredLanguage: string;
}