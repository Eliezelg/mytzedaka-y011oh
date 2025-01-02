/**
 * @fileoverview Service layer for managing user-related operations with enhanced features
 * @version 1.0.0
 */

import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry'; // v3.5.0
import { User, UserProfile, UserSettings, SupportedLanguage } from '../interfaces/user.interface';
import { 
  API_CONFIG, 
  API_ENDPOINTS, 
  CACHE_DURATION, 
  ERROR_MESSAGES,
  LOCAL_STORAGE_KEYS 
} from '../config/constants';

/**
 * Cache interface for storing user data
 */
interface UserCache {
  data: User | null;
  timestamp: number;
}

/**
 * Service class for managing user-related operations
 */
export class UserService {
  private static instance: UserService;
  private cache: UserCache = { data: null, timestamp: 0 };
  private readonly apiClient;

  private constructor() {
    this.apiClient = axios.create({
      baseURL: `${API_CONFIG.BASE_URL}/api/${API_CONFIG.API_VERSION}`,
      timeout: API_CONFIG.TIMEOUT,
    });

    // Configure retry logic for failed requests
    axiosRetry(this.apiClient, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (error: AxiosError) => {
        return axiosRetry.isNetworkOrIdempotentRequestError(error) 
          && error.response?.status !== 401 
          && error.response?.status !== 403;
      }
    });
  }

  /**
   * Get singleton instance of UserService
   */
  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }

  /**
   * Retrieves the current user's profile with caching
   */
  public async getUserProfile(): Promise<User> {
    try {
      // Check cache validity
      if (this.isCacheValid()) {
        return this.cache.data!;
      }

      const response = await this.apiClient.get('/users/profile');
      const userData: User = response.data;

      // Update cache
      this.updateCache(userData);
      return userData;

    } catch (error) {
      this.handleError(error as AxiosError, 'Failed to fetch user profile');
      throw error;
    }
  }

  /**
   * Updates the user's profile information
   */
  public async updateUserProfile(profileData: UserProfile): Promise<User> {
    try {
      this.validateProfileData(profileData);

      const response = await this.apiClient.put('/users/profile', profileData);
      const updatedUser: User = response.data;

      // Update cache with new data
      this.updateCache(updatedUser);
      
      // Log profile update for audit
      this.logAuditEvent('PROFILE_UPDATE', updatedUser.id);

      return updatedUser;

    } catch (error) {
      this.handleError(error as AxiosError, 'Failed to update user profile');
      throw error;
    }
  }

  /**
   * Updates user settings including language and notification preferences
   */
  public async updateUserSettings(settings: UserSettings): Promise<User> {
    try {
      this.validateSettings(settings);

      const response = await this.apiClient.put('/users/settings', settings);
      const updatedUser: User = response.data;

      // Update cache
      this.updateCache(updatedUser);

      // Update local storage language preference if changed
      if (settings.preferredLanguage) {
        localStorage.setItem(LOCAL_STORAGE_KEYS.LANGUAGE, settings.preferredLanguage);
      }

      // Log settings update for audit
      this.logAuditEvent('SETTINGS_UPDATE', updatedUser.id);

      return updatedUser;

    } catch (error) {
      this.handleError(error as AxiosError, 'Failed to update user settings');
      throw error;
    }
  }

  /**
   * Initiates 2FA setup process
   */
  public async setupTwoFactorAuth(): Promise<{ qrCodeUrl: string; secret: string }> {
    try {
      const response = await this.apiClient.post('/users/2fa/setup');
      return response.data;
    } catch (error) {
      this.handleError(error as AxiosError, 'Failed to setup 2FA');
      throw error;
    }
  }

  /**
   * Disables 2FA for the user account
   */
  public async disableTwoFactorAuth(verificationCode: string): Promise<void> {
    try {
      await this.apiClient.post('/users/2fa/disable', { verificationCode });
      
      // Update cache to reflect 2FA status
      if (this.cache.data) {
        this.cache.data.twoFactorEnabled = false;
      }

      this.logAuditEvent('2FA_DISABLED', this.cache.data?.id);
    } catch (error) {
      this.handleError(error as AxiosError, 'Failed to disable 2FA');
      throw error;
    }
  }

  /**
   * Validates if the current cache is still valid
   */
  private isCacheValid(): boolean {
    const now = Date.now();
    return (
      this.cache.data !== null &&
      now - this.cache.timestamp < CACHE_DURATION.USER_PROFILE * 1000
    );
  }

  /**
   * Updates the user data cache
   */
  private updateCache(userData: User): void {
    this.cache = {
      data: userData,
      timestamp: Date.now(),
    };
  }

  /**
   * Validates user profile data
   */
  private validateProfileData(profile: UserProfile): void {
    if (!profile.firstName || !profile.lastName) {
      throw new Error('First name and last name are required');
    }

    if (profile.preferredLanguage && !['en', 'fr', 'he'].includes(profile.preferredLanguage)) {
      throw new Error('Invalid language preference');
    }
  }

  /**
   * Validates user settings
   */
  private validateSettings(settings: UserSettings): void {
    if (settings.preferredLanguage && !['en', 'fr', 'he'].includes(settings.preferredLanguage)) {
      throw new Error('Invalid language preference');
    }

    if (typeof settings.twoFactorEnabled !== 'undefined' && typeof settings.twoFactorEnabled !== 'boolean') {
      throw new Error('Invalid 2FA setting');
    }
  }

  /**
   * Handles API errors with consistent error messages
   */
  private handleError(error: AxiosError, defaultMessage: string): void {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          throw new Error(ERROR_MESSAGES.AUTH_ERROR);
        case 403:
          throw new Error(ERROR_MESSAGES.PERMISSION_ERROR);
        case 400:
          throw new Error(error.response.data?.message || ERROR_MESSAGES.VALIDATION_ERROR);
        default:
          throw new Error(defaultMessage);
      }
    } else if (error.request) {
      throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
    } else {
      throw error;
    }
  }

  /**
   * Logs audit events for user actions
   */
  private logAuditEvent(action: string, userId?: string): void {
    // Implementation would typically send to logging service
    console.log({
      action,
      userId,
      timestamp: new Date().toISOString(),
      source: 'UserService'
    });
  }
}

// Export singleton instance
export default UserService.getInstance();