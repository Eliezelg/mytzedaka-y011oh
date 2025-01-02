import { IsString, IsNotEmpty, Matches, MinLength, MaxLength } from 'class-validator'; // v0.14.0
import { PASSWORD_REGEX } from '../../../constants/regex.constant';

/**
 * Data Transfer Object for password reset functionality
 * Validates and ensures security requirements for password reset requests
 */
export class ResetPasswordDto {
  /**
   * Reset password token received via email
   * Must be a non-empty string for security
   */
  @IsString()
  @IsNotEmpty()
  token: string;

  /**
   * New password that must meet security requirements:
   * - 8-32 characters long
   * - At least 1 lowercase letter
   * - At least 1 uppercase letter
   * - At least 1 number
   * - At least 1 special character
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(32)
  @Matches(PASSWORD_REGEX, {
    message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character'
  })
  newPassword: string;

  /**
   * Confirmation of new password
   * Must match exactly with newPassword
   */
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(32)
  @Matches(PASSWORD_REGEX, {
    message: 'Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character'
  })
  confirmPassword: string;
}