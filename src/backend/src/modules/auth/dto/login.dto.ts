import { IsEmail, IsNotEmpty, IsString, Matches } from 'class-validator';
import { EMAIL_REGEX } from '../../../constants/regex.constant';

/**
 * Data Transfer Object for user login requests
 * Implements comprehensive validation for email and password fields
 * Supports international email formats and provides localized validation messages
 */
export class LoginDto {
  /**
   * User's email address
   * Validates:
   * - RFC 5322 compliant email format
   * - International email formats (Hebrew, English, French)
   * - Domain validation
   * - No consecutive dots
   * - UTF-8 local part support
   */
  @IsNotEmpty({ message: 'Please enter a valid email address' })
  @IsString()
  @IsEmail({
    allow_utf8_local_part: true,
    require_tld: true,
    checkMX: true
  })
  @Matches(EMAIL_REGEX, {
    message: 'Please enter a valid email address'
  })
  email: string;

  /**
   * User's password
   * Required field with basic validation
   * Note: Password complexity validation is handled separately during registration
   */
  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  password: string;
}