import { 
  IsEmail, 
  IsString, 
  IsEnum, 
  IsOptional, 
  Matches, 
  MinLength, 
  MaxLength 
} from 'class-validator'; // ^0.14.0

import { 
  EMAIL_REGEX, 
  PASSWORD_REGEX, 
  NAME_REGEX, 
  PHONE_REGEX 
} from '../../../constants/regex.constant';

import { Roles } from '../../../constants/roles.constant';

/**
 * Data Transfer Object for user creation with comprehensive validation rules
 * Supports multi-language input (Hebrew, English, French) and implements
 * strict security validation for all fields
 */
export class CreateUserDto {
  /**
   * User's email address
   * Validated against RFC 5322 standard with additional security checks
   */
  @IsEmail()
  @Matches(EMAIL_REGEX, { 
    message: 'Invalid email format' 
  })
  @MaxLength(255, { 
    message: 'Email must not exceed 255 characters' 
  })
  email: string;

  /**
   * User's password with strong security requirements
   * Must contain: uppercase, lowercase, number, special character
   */
  @IsString()
  @Matches(PASSWORD_REGEX, { 
    message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
  })
  @MinLength(8, { 
    message: 'Password must be at least 8 characters long' 
  })
  @MaxLength(50, { 
    message: 'Password must not exceed 50 characters' 
  })
  password: string;

  /**
   * User's first name with multi-language support
   * Supports Hebrew, English, and French characters
   */
  @IsString()
  @Matches(NAME_REGEX, { 
    message: 'Invalid first name format' 
  })
  @MinLength(2, { 
    message: 'First name must be at least 2 characters long' 
  })
  @MaxLength(50, { 
    message: 'First name must not exceed 50 characters' 
  })
  firstName: string;

  /**
   * User's last name with multi-language support
   * Supports Hebrew, English, and French characters
   */
  @IsString()
  @Matches(NAME_REGEX, { 
    message: 'Invalid last name format' 
  })
  @MinLength(2, { 
    message: 'Last name must be at least 2 characters long' 
  })
  @MaxLength(50, { 
    message: 'Last name must not exceed 50 characters' 
  })
  lastName: string;

  /**
   * Optional phone number in E.164 format
   * Supports international phone numbers with validation
   */
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { 
    message: 'Invalid phone number format' 
  })
  phoneNumber?: string;

  /**
   * User role for role-based access control
   * Limited to DONOR and ASSOCIATION roles for registration
   */
  @IsEnum(Roles, { 
    message: 'Invalid role selected' 
  })
  @IsOptional()
  role?: Roles;

  /**
   * Preferred language for user interface
   * Supports English (en), French (fr), and Hebrew (he)
   */
  @IsString()
  @IsOptional()
  @IsEnum(['en', 'fr', 'he'], { 
    message: 'Invalid language selected' 
  })
  preferredLanguage?: string;
}