/**
 * @fileoverview TypeScript interface definitions for user-related types in the web frontend
 * @version 1.0.0
 */

import { Roles } from '../../constants/roles.constant';

/**
 * Supported language codes for the application
 */
export type SupportedLanguage = 'en' | 'fr' | 'he';

/**
 * Comprehensive user interface representing a user in the system
 * Includes all necessary fields for user management, authentication, and tracking
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  
  /** User's email address used for authentication */
  email: string;
  
  /** User's first name */
  firstName: string;
  
  /** User's last name */
  lastName: string;
  
  /** Optional phone number for contact and 2FA */
  phoneNumber: string | null;
  
  /** User's role for access control */
  role: Roles;
  
  /** User's preferred language for UI */
  preferredLanguage: SupportedLanguage;
  
  /** Indicates if user's email is verified */
  isVerified: boolean;
  
  /** Indicates if 2FA is enabled for the account */
  twoFactorEnabled: boolean;
  
  /** Timestamp of last successful login */
  lastLoginAt: string;
  
  /** Account creation timestamp */
  createdAt: string;
  
  /** Timestamp of last password change */
  lastPasswordChange: string;
  
  /** Counter for failed login attempts */
  failedLoginAttempts: number;
  
  /** Secondary email for account recovery */
  recoveryEmail: string | null;
}

/**
 * Interface for user profile update operations
 * Contains subset of User fields that can be modified by the user
 */
export interface UserProfile {
  /** User's first name */
  firstName: string;
  
  /** User's last name */
  lastName: string;
  
  /** Optional phone number */
  phoneNumber: string | null;
  
  /** Preferred language setting */
  preferredLanguage: SupportedLanguage;
  
  /** Secondary email for account recovery */
  recoveryEmail: string | null;
}

/**
 * Interface for user settings management
 * Contains user preferences and security settings
 */
export interface UserSettings {
  /** Two-factor authentication toggle */
  twoFactorEnabled: boolean;
  
  /** UI language preference */
  preferredLanguage: SupportedLanguage;
  
  /** Email notification preferences */
  emailNotifications: boolean;
  
  /** Auto-logout time in minutes */
  autoLogoutTime: number;
}