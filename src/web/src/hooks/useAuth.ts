/**
 * @fileoverview Enhanced authentication hook with advanced security features
 * including device fingerprinting, session management, and 2FA support
 * @version 1.0.0
 */

import { useCallback } from 'react';
import FingerprintJS from '@fingerprintjs/fingerprintjs'; // ^3.4.0
import { useAuthContext } from '../contexts/AuthContext';
import { User } from '../interfaces/user.interface';

// Types for authentication operations
interface LoginCredentials {
  email: string;
  password: string;
  deviceName?: string;
}

interface RegisterData extends LoginCredentials {
  firstName: string;
  lastName: string;
}

interface AuthResult {
  success: boolean;
  user?: User;
  requires2FA?: boolean;
  error?: string;
}

interface TwoFactorResult {
  success: boolean;
  error?: string;
}

/**
 * Enhanced authentication hook with security features
 */
export const useAuth = () => {
  const {
    user,
    loading,
    error,
    requires2FA,
    deviceTrusted,
    sessionTimeout
  } = useAuthContext();

  /**
   * Initialize device fingerprinting
   */
  const getDeviceFingerprint = useCallback(async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      return result.visitorId;
    } catch (error) {
      console.error('Device fingerprint error:', error);
      return null;
    }
  }, []);

  /**
   * Enhanced login handler with device fingerprinting
   */
  const login = useCallback(async ({
    email,
    password,
    deviceName
  }: LoginCredentials): Promise<AuthResult> => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      if (!deviceFingerprint) {
        throw new Error('Device fingerprint generation failed');
      }

      const response = await useAuthContext().login(
        email,
        password,
        deviceFingerprint,
        deviceName
      );

      return {
        success: true,
        user: response.user,
        requires2FA: response.requires2FA
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Login failed'
      };
    }
  }, [getDeviceFingerprint]);

  /**
   * Enhanced registration handler with extended profile
   */
  const register = useCallback(async ({
    email,
    password,
    firstName,
    lastName,
    deviceName
  }: RegisterData): Promise<AuthResult> => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      if (!deviceFingerprint) {
        throw new Error('Device fingerprint generation failed');
      }

      const response = await useAuthContext().register({
        email,
        password,
        firstName,
        lastName,
        deviceFingerprint,
        deviceName
      });

      return {
        success: true,
        user: response.user
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Registration failed'
      };
    }
  }, [getDeviceFingerprint]);

  /**
   * Enhanced 2FA verification with device trust
   */
  const verify2FA = useCallback(async (
    code: string,
    trustDevice: boolean
  ): Promise<TwoFactorResult> => {
    try {
      await useAuthContext().verify2FA(code, trustDevice);
      return { success: true };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || '2FA verification failed'
      };
    }
  }, []);

  /**
   * Enhanced logout with session cleanup
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      await useAuthContext().logout();
    } catch (error: any) {
      console.error('Logout error:', error);
      throw error;
    }
  }, []);

  /**
   * Trust current device for future logins
   */
  const trustDevice = useCallback(async (): Promise<boolean> => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      if (!deviceFingerprint) {
        return false;
      }
      await useAuthContext().trustDevice(deviceFingerprint);
      return true;
    } catch (error) {
      console.error('Trust device error:', error);
      return false;
    }
  }, [getDeviceFingerprint]);

  /**
   * Revoke trust for current device
   */
  const revokeDeviceTrust = useCallback(async (): Promise<boolean> => {
    try {
      const deviceFingerprint = await getDeviceFingerprint();
      if (!deviceFingerprint) {
        return false;
      }
      await useAuthContext().revokeDeviceTrust(deviceFingerprint);
      return true;
    } catch (error) {
      console.error('Revoke device trust error:', error);
      return false;
    }
  }, [getDeviceFingerprint]);

  return {
    // Authentication state
    user,
    loading,
    error,
    requires2FA,
    deviceTrusted,
    sessionTimeout,

    // Authentication methods
    login,
    register,
    logout,
    verify2FA,
    trustDevice,
    revokeDeviceTrust
  };
};