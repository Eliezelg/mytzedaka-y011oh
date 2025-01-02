/**
 * @fileoverview Redux reducer for authentication state management with enhanced security features
 * including JWT token handling, 2FA, device trust verification, and automatic token refresh
 * @version 1.0.0
 */

import { createSlice } from '@reduxjs/toolkit'; // ^1.9.5
import { User } from '../../interfaces/user.interface';
import { 
  loginRequest, 
  registerRequest, 
  verifyTwoFactorRequest, 
  logoutRequest 
} from '../actions/auth.actions';

/**
 * Authentication state interface with enhanced security features
 */
interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  requiresTwoFactor: boolean;
  twoFactorToken: string | null;
  deviceTrust: {
    verified: boolean;
    fingerprint: string | null;
  };
  tokenRefresh: {
    pending: boolean;
    lastRefresh: number | null;
  };
}

/**
 * Initial authentication state
 */
const initialState: AuthState = {
  user: null,
  loading: false,
  error: null,
  requiresTwoFactor: false,
  twoFactorToken: null,
  deviceTrust: {
    verified: false,
    fingerprint: null
  },
  tokenRefresh: {
    pending: false,
    lastRefresh: null
  }
};

/**
 * Authentication slice with enhanced security features
 */
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Clear authentication error state
     */
    clearError: (state) => {
      state.error = null;
    },

    /**
     * Reset authentication state
     */
    resetState: (state) => {
      Object.assign(state, initialState);
    },

    /**
     * Update device trust verification status
     */
    verifyDevice: (state, action) => {
      state.deviceTrust = {
        verified: true,
        fingerprint: action.payload
      };
    },

    /**
     * Update token refresh status
     */
    refreshToken: (state) => {
      state.tokenRefresh = {
        pending: true,
        lastRefresh: Date.now()
      };
    }
  },
  extraReducers: (builder) => {
    // Login request handling
    builder.addCase(loginRequest.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(loginRequest.fulfilled, (state, action) => {
      state.loading = false;
      
      if (action.payload.requiresTwoFactor) {
        state.requiresTwoFactor = true;
        state.twoFactorToken = action.payload.temporaryToken;
      } else {
        state.user = action.payload.user;
        state.deviceTrust = {
          verified: action.payload.deviceTrustStatus === 'trusted',
          fingerprint: action.payload.deviceFingerprint
        };
      }
      
      state.tokenRefresh.lastRefresh = Date.now();
    });

    builder.addCase(loginRequest.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || 'Login failed';
      state.deviceTrust.verified = false;
    });

    // Registration request handling
    builder.addCase(registerRequest.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(registerRequest.fulfilled, (state, action) => {
      state.loading = false;
      state.user = action.payload.user;
      state.deviceTrust = {
        verified: true,
        fingerprint: action.payload.deviceFingerprint
      };
      state.tokenRefresh.lastRefresh = Date.now();
    });

    builder.addCase(registerRequest.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || 'Registration failed';
    });

    // Two-factor authentication handling
    builder.addCase(verifyTwoFactorRequest.pending, (state) => {
      state.loading = true;
      state.error = null;
    });

    builder.addCase(verifyTwoFactorRequest.fulfilled, (state, action) => {
      state.loading = false;
      state.requiresTwoFactor = false;
      state.twoFactorToken = null;
      state.user = action.payload.user;
      state.deviceTrust = {
        verified: true,
        fingerprint: action.payload.deviceFingerprint
      };
      state.tokenRefresh.lastRefresh = Date.now();
    });

    builder.addCase(verifyTwoFactorRequest.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload?.message || '2FA verification failed';
    });

    // Logout handling
    builder.addCase(logoutRequest.fulfilled, (state) => {
      Object.assign(state, initialState);
    });
  }
});

// Export actions
export const { clearError, resetState, verifyDevice, refreshToken } = authSlice.actions;

// Export reducer
export default authSlice.reducer;