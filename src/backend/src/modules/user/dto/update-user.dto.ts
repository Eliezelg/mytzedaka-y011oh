import { IsString, IsOptional, Matches, MinLength, MaxLength, IsEnum } from 'class-validator'; // v0.14.0
import { NAME_REGEX, PHONE_REGEX } from '../../../constants/regex.constant';

/**
 * Data Transfer Object for user profile updates
 * Supports multi-language input validation for Hebrew, English, and French
 * Implements partial update pattern allowing optional fields
 */
export class UpdateUserDto {
  /**
   * User's first name with multi-language support
   * Validates:
   * - Hebrew, English, and French characters
   * - Proper name formatting with Unicode support
   * - Length between 2-50 characters
   */
  @IsOptional()
  @IsString()
  @Matches(NAME_REGEX, { message: 'First name must contain valid characters' })
  @MinLength(2, { message: 'First name must be at least 2 characters' })
  @MaxLength(50, { message: 'First name must not exceed 50 characters' })
  firstName?: string;

  /**
   * User's last name with multi-language support
   * Validates:
   * - Hebrew, English, and French characters
   * - Proper name formatting with Unicode support
   * - Length between 2-50 characters
   */
  @IsOptional()
  @IsString()
  @Matches(NAME_REGEX, { message: 'Last name must contain valid characters' })
  @MinLength(2, { message: 'Last name must be at least 2 characters' })
  @MaxLength(50, { message: 'Last name must not exceed 50 characters' })
  lastName?: string;

  /**
   * User's phone number in E.164 format
   * Example: +972501234567
   */
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: 'Invalid phone number format' })
  phoneNumber?: string;

  /**
   * User's preferred language for platform interaction
   * Supports: English (en), French (fr), Hebrew (he)
   */
  @IsOptional()
  @IsString()
  @IsEnum(['en', 'fr', 'he'], { message: 'Language must be one of: English, French, Hebrew' })
  preferredLanguage?: string;
}