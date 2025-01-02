/**
 * @fileoverview Enhanced authentication service with advanced security features
 * including token encryption, device fingerprinting, and automatic token refresh
 * @version 1.0.0
 */

import { BehaviorSubject } from 'rxjs'; // ^7.5.0
import { 
  login, 
  register, 
  verifyTwoFactor, 
  refreshToken, 
  logout 
} from '../api/auth';
import { User } from '../interfaces/user.interface';
import { 
  setItem, 
  getItem, 
  removeItem, 
  encryptData 
} from '../utils/storage.utils';

// Storage keys
const TOKEN_KEY = 'auth_tokens';
const USER_KEY = 'current_user';
const DEVICE_KEY = 'device_id';

// Token refresh interval (5 minutes)
const tokenRefreshInterval = 5 * 60 * 1000;

/**
 * Enhanced authentication service class
 */
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  private refreshTokenTimeout?: NodeJS.Timeout;

  constructor() {
    this.currentUserSubject = new BehaviorSubject<User | null>(null);
    this.initializeFromStorage();
    this.setupTokenRefresh();
  }

  /**
   * Observable for current user state
   */
  public get currentUser$() {
    return this.currentUserSubject.asObservable();
  }

  /**
   * Current user value
   */
  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  /**
   * Enhanced user login with device fingerprinting
   */
  public async loginUser(credentials: { 
    email: string; 
    password: string; 
    deviceId?: string;
  }): Promise<{ user: User; requiresTwoFactor: boolean; deviceTrusted: boolean }> {
    try {
      const response = await login(credentials);
      
      if (!response.twoFactorRequired) {
        await this.handleAuthentication({
          user: response.user,
          tokens: {
            accessToken: response.accessToken,
            refreshToken: response.refreshToken
          },
          deviceId: credentials.deviceId || response.deviceId
        });
      }

      return {
        user: response.user,
        requiresTwoFactor: response.twoFactorRequired || false,
        deviceTrusted: response.deviceTrusted || false
      };
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Enhanced user registration with validation
   */
  public async registerUser(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    deviceId?: string;
  }): Promise<User> {
    try {
      const response = await register(data);
      await this.handleAuthentication({
        user: response.user,
        tokens: {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken
        },
        deviceId: data.deviceId || response.deviceId
      });
      return response.user;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Two-factor authentication verification
   */
  public async verifyTwoFactorAuth(code: string, temporaryToken: string): Promise<User> {
    try {
      const response = await verifyTwoFactor(code, temporaryToken);
      await this.handleAuthentication({
        user: response.user,
        tokens: {
          accessToken: response.accessToken,
          refreshToken: response.refreshToken
        },
        deviceId: response.deviceId
      });
      return response.user;
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * User logout with device cleanup
   */
  public async logoutUser(): Promise<void> {
    try {
      const deviceId = await getItem(DEVICE_KEY, 'secure');
      if (deviceId.success && deviceId.data) {
        await logout({ deviceId: deviceId.data });
      }
    } finally {
      this.clearAuthentication();
    }
  }

  /**
   * Check if user is authenticated
   */
  public isAuthenticated(): boolean {
    return !!this.currentUserValue && this.hasValidToken();
  }

  /**
   * Refresh authentication token
   */
  public async refreshAuthToken(): Promise<void> {
    try {
      const tokens = await getItem<{ refreshToken: string }>(TOKEN_KEY, 'secure');
      if (tokens.success && tokens.data?.refreshToken) {
        const response = await refreshToken(tokens.data.refreshToken);
        await this.updateTokens({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken
        });
      }
    } catch (error) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Validate device trust status
   */
  public async validateDeviceTrust(deviceId: string): Promise<boolean> {
    const storedDeviceId = await getItem<string>(DEVICE_KEY, 'secure');
    return storedDeviceId.success && storedDeviceId.data === deviceId;
  }

  /**
   * Handle successful authentication
   */
  private async handleAuthentication({ 
    user, 
    tokens, 
    deviceId 
  }: {
    user: User;
    tokens: { accessToken: string; refreshToken: string };
    deviceId: string;
  }): Promise<void> {
    const encryptedTokens = await encryptData({
      ...tokens,
      deviceId
    });

    if (encryptedTokens.success) {
      await setItem(TOKEN_KEY, encryptedTokens.data, 'secure');
      await setItem(DEVICE_KEY, deviceId, 'secure');
      await setItem(USER_KEY, user, 'secure');
      
      this.currentUserSubject.next(user);
      this.setupTokenRefresh();
    }
  }

  /**
   * Initialize service from storage
   */
  private async initializeFromStorage(): Promise<void> {
    const user = await getItem<User>(USER_KEY, 'secure');
    if (user.success && user.data) {
      this.currentUserSubject.next(user.data);
    }
  }

  /**
   * Setup automatic token refresh
   */
  private setupTokenRefresh(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }

    this.refreshTokenTimeout = setInterval(
      () => this.refreshAuthToken(),
      tokenRefreshInterval
    );
  }

  /**
   * Clear authentication state
   */
  private async clearAuthentication(): Promise<void> {
    await removeItem(TOKEN_KEY, 'secure');
    await removeItem(USER_KEY, 'secure');
    await removeItem(DEVICE_KEY, 'secure');
    
    this.currentUserSubject.next(null);
    
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }

  /**
   * Handle authentication errors
   */
  private handleAuthError(error: any): void {
    if (error?.response?.status === 401) {
      this.clearAuthentication();
    }
  }

  /**
   * Check for valid token
   */
  private async hasValidToken(): Promise<boolean> {
    const tokens = await getItem<{ accessToken: string }>(TOKEN_KEY, 'secure');
    return tokens.success && !!tokens.data?.accessToken;
  }
}

// Export singleton instance
export const authService = new AuthService();