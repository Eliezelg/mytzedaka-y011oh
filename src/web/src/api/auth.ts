/**
 * @fileoverview Authentication service module handling user authentication, registration,
 * and session management with enhanced security features
 * @version 1.0.0
 */

import apiClient from './apiClient';
import { User } from '../interfaces/user.interface';
import { ERROR_MESSAGES } from '../config/constants';
import FingerprintJS from '@fingerprintjs/fingerprintjs'; // ^3.4.0

// Authentication endpoints
const AUTH_ENDPOINTS = {
  LOGIN: '/auth/login',
  REGISTER: '/auth/register',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  TWO_FACTOR_VERIFY: '/auth/two-factor/verify',
  PASSWORD_RESET: '/auth/password/reset',
  PASSWORD_RESET_CONFIRM: '/auth/password/reset/confirm'
} as const;

// Security configuration
const SECURITY_CONFIG = {
  ACCESS_TOKEN_EXPIRY: 900000, // 15 minutes
  REFRESH_TOKEN_EXPIRY: 604800000, // 7 days
  REFRESH_THRESHOLD: 300000, // 5 minutes
  MAX_LOGIN_ATTEMPTS: 5,
  LOCKOUT_DURATION: 900000, // 15 minutes
  PASSWORD_MIN_LENGTH: 12,
  REQUIRE_SPECIAL_CHARS: true
} as const;

// Response interfaces
interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  twoFactorRequired?: boolean;
  temporaryToken?: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

interface DeviceInfo {
  fingerprint: string;
  userAgent: string;
  ipAddress?: string;
  timestamp: number;
}

/**
 * Authentication service class with enhanced security features
 */
export class AuthService {
  private refreshTokenTimeout?: NodeJS.Timeout;
  private fpPromise: Promise<any>;

  constructor() {
    this.fpPromise = FingerprintJS.load();
    this.initializeRefreshTokenTimer();
  }

  /**
   * Authenticates user with email and password
   */
  public async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await apiClient.post<AuthResponse>(AUTH_ENDPOINTS.LOGIN, {
        email,
        password,
        deviceInfo
      });

      if (response.data.accessToken) {
        this.setTokens(response.data);
        this.startRefreshTokenTimer();
      }

      return response.data;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Registers a new user account with enhanced validation
   */
  public async register(registerData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }): Promise<AuthResponse> {
    if (!this.validatePassword(registerData.password)) {
      throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
    }

    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await apiClient.post<AuthResponse>(AUTH_ENDPOINTS.REGISTER, {
        ...registerData,
        deviceInfo
      });

      if (response.data.accessToken) {
        this.setTokens(response.data);
        this.startRefreshTokenTimer();
      }

      return response.data;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Verifies two-factor authentication code
   */
  public async verifyTwoFactor(code: string, temporaryToken: string): Promise<AuthResponse> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await apiClient.post<AuthResponse>(AUTH_ENDPOINTS.TWO_FACTOR_VERIFY, {
        code,
        temporaryToken,
        deviceInfo
      });

      if (response.data.accessToken) {
        this.setTokens(response.data);
        this.startRefreshTokenTimer();
      }

      return response.data;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Refreshes access token using refresh token
   */
  public async refreshToken(refreshToken: string): Promise<TokenResponse> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      
      const response = await apiClient.post<TokenResponse>(AUTH_ENDPOINTS.REFRESH, {
        refreshToken,
        deviceInfo
      });

      if (response.data.accessToken) {
        this.setTokens(response.data);
        this.startRefreshTokenTimer();
      }

      return response.data;
    } catch (error: any) {
      this.handleAuthError(error);
      throw error;
    }
  }

  /**
   * Logs out user and clears session
   */
  public async logout(): Promise<void> {
    try {
      const deviceInfo = await this.getDeviceInfo();
      await apiClient.post(AUTH_ENDPOINTS.LOGOUT, { deviceInfo });
    } finally {
      this.clearTokens();
      this.stopRefreshTokenTimer();
    }
  }

  /**
   * Generates device fingerprint and info
   */
  private async getDeviceInfo(): Promise<DeviceInfo> {
    const fp = await this.fpPromise;
    const result = await fp.get();

    return {
      fingerprint: result.visitorId,
      userAgent: navigator.userAgent,
      timestamp: Date.now()
    };
  }

  /**
   * Validates password strength
   */
  private validatePassword(password: string): boolean {
    const hasMinLength = password.length >= SECURITY_CONFIG.PASSWORD_MIN_LENGTH;
    const hasSpecialChar = SECURITY_CONFIG.REQUIRE_SPECIAL_CHARS ? 
      /[!@#$%^&*(),.?":{}|<>]/.test(password) : true;
    const hasNumber = /\d/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);

    return hasMinLength && hasSpecialChar && hasNumber && hasUpperCase && hasLowerCase;
  }

  /**
   * Handles authentication errors
   */
  private handleAuthError(error: any): void {
    if (error.response?.status === 401) {
      this.clearTokens();
      this.stopRefreshTokenTimer();
    }
  }

  /**
   * Sets authentication tokens in secure storage
   */
  private setTokens(tokens: { accessToken: string; refreshToken?: string; expiresIn: number }): void {
    localStorage.setItem('auth_token', tokens.accessToken);
    if (tokens.refreshToken) {
      localStorage.setItem('refresh_token', tokens.refreshToken);
    }
  }

  /**
   * Clears authentication tokens from storage
   */
  private clearTokens(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('refresh_token');
  }

  /**
   * Starts automatic token refresh timer
   */
  private startRefreshTokenTimer(): void {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      const timeout = SECURITY_CONFIG.ACCESS_TOKEN_EXPIRY - SECURITY_CONFIG.REFRESH_THRESHOLD;
      this.refreshTokenTimeout = setTimeout(() => {
        this.refreshToken(refreshToken).catch(console.error);
      }, timeout);
    }
  }

  /**
   * Stops automatic token refresh timer
   */
  private stopRefreshTokenTimer(): void {
    if (this.refreshTokenTimeout) {
      clearTimeout(this.refreshTokenTimeout);
    }
  }

  /**
   * Initializes refresh token timer on service instantiation
   */
  private initializeRefreshTokenTimer(): void {
    const refreshToken = localStorage.getItem('refresh_token');
    if (refreshToken) {
      this.startRefreshTokenTimer();
    }
  }
}

// Export singleton instance
export const authService = new AuthService();