/**
 * @fileoverview Enhanced authentication context provider with advanced security features
 * including device fingerprinting, token encryption, and session management
 * @version 1.0.0
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { AuthService } from '../services/auth.service';
import { User } from '../interfaces/user.interface';
import { setItem, getItem, removeItem } from '../utils/storage.utils';

// Constants for session management
const SESSION_TIMEOUT = 900000; // 15 minutes in milliseconds
const TOKEN_REFRESH_INTERVAL = 840000; // 14 minutes in milliseconds

// Auth error type definition
interface AuthError {
  message: string;
  code: string;
}

// Auth context type definition
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: AuthError | null;
  requires2FA: boolean;
  deviceId: string | null;
  isTokenRefreshing: boolean;
  sessionTimeout: number | null;
  login: (email: string, password: string, deviceFingerprint: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    deviceFingerprint: string;
  }) => Promise<void>;
  verify2FA: (code: string, trustDevice: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

// Create auth context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Custom hook for accessing auth context with type safety
 */
export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
};

/**
 * Enhanced authentication context provider with security features
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // State management
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<AuthError | null>(null);
  const [requires2FA, setRequires2FA] = useState<boolean>(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [isTokenRefreshing, setIsTokenRefreshing] = useState<boolean>(false);
  const [sessionTimeout, setSessionTimeout] = useState<number | null>(null);

  // Initialize auth service
  const authService = useMemo(() => new AuthService(), []);

  /**
   * Session timeout handler
   */
  const handleSessionTimeout = useCallback(() => {
    if (sessionTimeout) {
      clearTimeout(sessionTimeout);
    }
    const timeout = setTimeout(() => {
      logout();
    }, SESSION_TIMEOUT);
    setSessionTimeout(timeout);
  }, []);

  /**
   * Token refresh handler
   */
  const refreshTokenHandler = useCallback(async () => {
    try {
      setIsTokenRefreshing(true);
      await authService.refreshToken();
      handleSessionTimeout();
    } catch (error) {
      await logout();
    } finally {
      setIsTokenRefreshing(false);
    }
  }, [handleSessionTimeout]);

  /**
   * Enhanced login handler with device binding
   */
  const login = useCallback(async (
    email: string,
    password: string,
    deviceFingerprint: string
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const response = await authService.loginUser({
        email,
        password,
        deviceId: deviceFingerprint
      });

      if (response.requiresTwoFactor) {
        setRequires2FA(true);
        setDeviceId(deviceFingerprint);
      } else {
        setUser(response.user);
        setDeviceId(deviceFingerprint);
        await setItem('device_id', deviceFingerprint, 'secure');
        handleSessionTimeout();
        setInterval(refreshTokenHandler, TOKEN_REFRESH_INTERVAL);
      }
    } catch (err: any) {
      setError({
        message: err.message || 'Login failed',
        code: err.code || 'AUTH_ERROR'
      });
    } finally {
      setLoading(false);
    }
  }, [handleSessionTimeout, refreshTokenHandler]);

  /**
   * Enhanced registration handler with profile validation
   */
  const register = useCallback(async (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    deviceFingerprint: string;
  }): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const user = await authService.registerUser({
        ...data,
        deviceId: data.deviceFingerprint
      });
      setUser(user);
      setDeviceId(data.deviceFingerprint);
      await setItem('device_id', data.deviceFingerprint, 'secure');
      handleSessionTimeout();
    } catch (err: any) {
      setError({
        message: err.message || 'Registration failed',
        code: err.code || 'AUTH_ERROR'
      });
    } finally {
      setLoading(false);
    }
  }, [handleSessionTimeout]);

  /**
   * Enhanced 2FA verification with device trust
   */
  const verify2FA = useCallback(async (
    code: string,
    trustDevice: boolean
  ): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const user = await authService.verifyTwoFactorAuth(code, trustDevice);
      setUser(user);
      setRequires2FA(false);
      if (trustDevice && deviceId) {
        await authService.verifyDeviceTrust(deviceId);
      }
      handleSessionTimeout();
    } catch (err: any) {
      setError({
        message: err.message || '2FA verification failed',
        code: err.code || 'AUTH_ERROR'
      });
    } finally {
      setLoading(false);
    }
  }, [deviceId, handleSessionTimeout]);

  /**
   * Enhanced logout handler with session cleanup
   */
  const logout = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      await authService.logoutUser();
      if (sessionTimeout) {
        clearTimeout(sessionTimeout);
      }
      await removeItem('device_id', 'secure');
      setUser(null);
      setDeviceId(null);
      setRequires2FA(false);
    } catch (err: any) {
      setError({
        message: err.message || 'Logout failed',
        code: err.code || 'AUTH_ERROR'
      });
    } finally {
      setLoading(false);
    }
  }, [sessionTimeout]);

  // Initialize authentication state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          const storedDeviceId = await getItem<string>('device_id', 'secure');
          if (storedDeviceId.success && storedDeviceId.data) {
            setDeviceId(storedDeviceId.data);
          }
          handleSessionTimeout();
          setInterval(refreshTokenHandler, TOKEN_REFRESH_INTERVAL);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [handleSessionTimeout, refreshTokenHandler]);

  // Context value
  const value = useMemo(() => ({
    user,
    loading,
    error,
    requires2FA,
    deviceId,
    isTokenRefreshing,
    sessionTimeout,
    login,
    register,
    verify2FA,
    logout
  }), [
    user,
    loading,
    error,
    requires2FA,
    deviceId,
    isTokenRefreshing,
    sessionTimeout,
    login,
    register,
    verify2FA,
    logout
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};