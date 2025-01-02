/**
 * @fileoverview Redux action creators for authentication flows with enhanced security features
 * including device fingerprinting, 2FA, and comprehensive validation
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import FingerprintJS from '@fingerprintjs/fingerprintjs-pro'; // ^3.8.1
import { AuthService } from '../../services/auth.service';
import { User } from '../../interfaces/user.interface';
import { ValidationSchemas } from '../../validators/auth.validator';

// Initialize FingerprintJS for device identification
const fpPromise = FingerprintJS.load({
  apiKey: process.env.REACT_APP_FP_API_KEY as string
});

/**
 * Device trust status enum
 */
export enum DeviceTrustStatus {
  TRUSTED = 'trusted',
  PENDING = 'pending',
  UNTRUSTED = 'untrusted'
}

/**
 * Login request action creator with enhanced security
 */
export const loginRequest = createAsyncThunk(
  'auth/login',
  async (credentials: {
    email: string;
    password: string;
    rememberDevice?: boolean;
  }, { rejectWithValue }) => {
    try {
      // Validate login credentials
      await ValidationSchemas.loginSchema.validate(credentials);

      // Generate device fingerprint
      const fp = await fpPromise;
      const result = await fp.get();
      const deviceFingerprint = result.visitorId;

      // Attempt login with device fingerprint
      const response = await AuthService.loginUser({
        ...credentials,
        deviceFingerprint,
        rememberDevice: credentials.rememberDevice || false
      });

      // Handle 2FA requirement
      if (response.requiresTwoFactor) {
        return {
          requiresTwoFactor: true,
          temporaryToken: response.temporaryToken,
          deviceTrustStatus: DeviceTrustStatus.PENDING
        };
      }

      // Verify device trust status
      const deviceTrustStatus = await AuthService.verifyDeviceTrust(deviceFingerprint);

      return {
        user: response.user,
        requiresTwoFactor: false,
        deviceTrustStatus: deviceTrustStatus ? 
          DeviceTrustStatus.TRUSTED : 
          DeviceTrustStatus.UNTRUSTED
      };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code || 'AUTH_ERROR'
      });
    }
  }
);

/**
 * Registration request action creator with enhanced validation
 */
export const registerRequest = createAsyncThunk(
  'auth/register',
  async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: string;
  }, { rejectWithValue }) => {
    try {
      // Validate registration data
      await ValidationSchemas.registerSchema.validate(data);

      // Generate device fingerprint for new registration
      const fp = await fpPromise;
      const result = await fp.get();
      const deviceFingerprint = result.visitorId;

      // Register user with device fingerprint
      const response = await AuthService.registerUser({
        ...data,
        deviceFingerprint
      });

      return {
        user: response,
        verificationRequired: true
      };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code || 'REGISTRATION_ERROR'
      });
    }
  }
);

/**
 * Two-factor authentication verification action creator
 */
export const verifyTwoFactorRequest = createAsyncThunk(
  'auth/verifyTwoFactor',
  async (data: {
    code: string;
    temporaryToken: string;
  }, { rejectWithValue }) => {
    try {
      // Validate 2FA code
      await ValidationSchemas.twoFactorSchema.validate({ code: data.code });

      // Verify 2FA code
      const response = await AuthService.verifyTwoFactorAuth(
        data.code,
        data.temporaryToken
      );

      return {
        user: response,
        deviceTrustStatus: DeviceTrustStatus.TRUSTED
      };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code || 'TWO_FACTOR_ERROR'
      });
    }
  }
);

/**
 * Logout request action creator with device cleanup
 */
export const logoutRequest = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await AuthService.logoutUser();
      return { success: true };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code || 'LOGOUT_ERROR'
      });
    }
  }
);

/**
 * Device trust verification action creator
 */
export const verifyDeviceTrustRequest = createAsyncThunk(
  'auth/verifyDeviceTrust',
  async (_, { rejectWithValue }) => {
    try {
      const fp = await fpPromise;
      const result = await fp.get();
      const deviceFingerprint = result.visitorId;

      const isTrusted = await AuthService.verifyDeviceTrust(deviceFingerprint);

      return {
        deviceTrustStatus: isTrusted ? 
          DeviceTrustStatus.TRUSTED : 
          DeviceTrustStatus.UNTRUSTED
      };
    } catch (error: any) {
      return rejectWithValue({
        message: error.message,
        code: error.code || 'DEVICE_TRUST_ERROR'
      });
    }
  }
);