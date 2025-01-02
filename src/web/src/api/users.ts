/**
 * @fileoverview API module for user-related operations including profile management,
 * settings updates, and enhanced security features with multi-language support
 * @version 1.0.0
 */

import apiClient from './apiClient';
import { User, UserProfile, UserSettings } from '../interfaces/user.interface';
import { CACHE_DURATION } from '../config/constants';

// Cache key for current user data
const USER_CACHE_KEY = 'current_user_data';

/**
 * Retrieves the currently authenticated user's data with caching support
 * @returns Promise resolving to current user data
 */
export const getCurrentUser = async (): Promise<User> => {
  // Check cache first
  const cachedData = localStorage.getItem(USER_CACHE_KEY);
  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);
    const isValid = Date.now() - timestamp < CACHE_DURATION.USER_PROFILE * 1000;
    if (isValid) {
      return data as User;
    }
  }

  // Fetch fresh data if cache miss or expired
  const response = await apiClient.get<User>('/users/me');
  
  // Cache the response
  localStorage.setItem(USER_CACHE_KEY, JSON.stringify({
    data: response.data,
    timestamp: Date.now()
  }));

  return response.data;
};

/**
 * Updates the user's profile information with validation
 * @param profile Updated profile data
 * @returns Promise resolving to updated user data
 */
export const updateProfile = async (profile: UserProfile): Promise<User> => {
  // Validate required fields
  if (!profile.firstName || !profile.lastName) {
    throw new Error('First name and last name are required');
  }

  // Sanitize input data
  const sanitizedProfile = {
    ...profile,
    firstName: profile.firstName.trim(),
    lastName: profile.lastName.trim(),
    phoneNumber: profile.phoneNumber?.trim() || null,
    recoveryEmail: profile.recoveryEmail?.trim().toLowerCase() || null
  };

  const response = await apiClient.put<User>('/users/profile', sanitizedProfile);
  
  // Invalidate user cache
  localStorage.removeItem(USER_CACHE_KEY);

  return response.data;
};

/**
 * Updates the user's application settings with enhanced security
 * @param settings Updated settings data
 * @returns Promise resolving to updated user data
 */
export const updateSettings = async (settings: UserSettings): Promise<User> => {
  // Validate settings
  if (settings.autoLogoutTime < 5 || settings.autoLogoutTime > 1440) {
    throw new Error('Auto-logout time must be between 5 and 1440 minutes');
  }

  const response = await apiClient.put<User>('/users/settings', settings);
  
  // Update local session with new settings
  if (settings.preferredLanguage) {
    localStorage.setItem('selected_language', settings.preferredLanguage);
  }

  // Invalidate user cache
  localStorage.removeItem(USER_CACHE_KEY);

  return response.data;
};

/**
 * Interface for 2FA setup response
 */
interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  backupCodes: string[];
}

/**
 * Enables two-factor authentication with enhanced security measures
 * @returns Promise resolving to 2FA setup data including backup codes
 */
export const enableTwoFactor = async (): Promise<TwoFactorSetupResponse> => {
  const response = await apiClient.post<TwoFactorSetupResponse>('/users/2fa/enable');
  
  // Store encrypted backup codes locally for emergency access
  const encryptedCodes = btoa(JSON.stringify(response.data.backupCodes));
  localStorage.setItem('2fa_backup_codes', encryptedCodes);

  return response.data;
};

/**
 * Disables two-factor authentication with verification
 * @param code Current 2FA code
 * @param password User's current password
 * @returns Promise resolving to void on success
 */
export const disableTwoFactor = async (code: string, password: string): Promise<void> => {
  await apiClient.post('/users/2fa/disable', {
    code,
    password,
    timestamp: Date.now() // For request freshness verification
  });

  // Clear stored 2FA data
  localStorage.removeItem('2fa_backup_codes');
  
  // Invalidate user cache to reflect updated 2FA status
  localStorage.removeItem(USER_CACHE_KEY);
};

/**
 * Validates a 2FA backup code
 * @param backupCode Backup code to validate
 * @returns Promise resolving to void on success
 */
export const validateBackupCode = async (backupCode: string): Promise<void> => {
  await apiClient.post('/users/2fa/validate-backup', {
    code: backupCode,
    timestamp: Date.now()
  });
};

/**
 * Updates user's preferred language
 * @param language New language preference
 * @returns Promise resolving to updated user data
 */
export const updateLanguage = async (language: User['preferredLanguage']): Promise<User> => {
  const response = await apiClient.put<User>('/users/language', { language });
  
  // Update local language setting
  localStorage.setItem('selected_language', language);
  
  // Invalidate user cache
  localStorage.removeItem(USER_CACHE_KEY);

  return response.data;
};