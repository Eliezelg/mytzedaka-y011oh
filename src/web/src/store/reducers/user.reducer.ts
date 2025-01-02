/**
 * @fileoverview Redux reducer for managing user-related state with enhanced security features
 * @version 1.0.0
 */

import { createReducer, PayloadAction } from '@reduxjs/toolkit'; // v1.9.0
import { User } from '../../interfaces/user.interface';
import { UserActionTypes } from '../actions/user.actions';

/**
 * Interface for error state tracking
 */
interface ErrorState {
  code: string;
  message: string;
  field?: string;
  timestamp: number;
}

/**
 * Interface for user settings that need to be persisted
 */
interface UserSettings {
  preferredLanguage: 'en' | 'he' | 'fr';
  twoFactorEnabled: boolean;
  emailNotifications: boolean;
  autoLogoutTime: number;
}

/**
 * Interface defining the shape of the user state
 */
export interface UserState {
  user: User | null;
  loading: boolean;
  error: ErrorState | null;
  lastSync: number;
  persistedSettings: UserSettings;
}

/**
 * Initial state for the user reducer
 */
const initialState: UserState = {
  user: null,
  loading: false,
  error: null,
  lastSync: 0,
  persistedSettings: {
    preferredLanguage: 'en',
    twoFactorEnabled: false,
    emailNotifications: true,
    autoLogoutTime: 30
  }
};

/**
 * User reducer with enhanced security features and proper state persistence
 */
export const userReducer = createReducer(initialState, (builder) => {
  builder
    // Handle profile fetch loading state
    .addCase(`${UserActionTypes.GET_PROFILE}/pending`, (state) => {
      state.loading = true;
      state.error = null;
    })
    // Handle successful profile fetch
    .addCase(`${UserActionTypes.GET_PROFILE}/fulfilled`, (state, action: PayloadAction<User>) => {
      state.loading = false;
      state.user = action.payload;
      state.lastSync = Date.now();
      state.persistedSettings = {
        ...state.persistedSettings,
        preferredLanguage: action.payload.preferredLanguage,
        twoFactorEnabled: action.payload.twoFactorEnabled
      };
    })
    // Handle profile fetch error
    .addCase(`${UserActionTypes.GET_PROFILE}/rejected`, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.payload?.code || 'UNKNOWN_ERROR',
        message: action.payload?.message || 'Failed to fetch profile',
        timestamp: Date.now()
      };
    })
    // Handle profile update loading state
    .addCase(`${UserActionTypes.UPDATE_PROFILE}/pending`, (state) => {
      state.loading = true;
      state.error = null;
    })
    // Handle successful profile update
    .addCase(`${UserActionTypes.UPDATE_PROFILE}/fulfilled`, (state, action: PayloadAction<User>) => {
      state.loading = false;
      state.user = action.payload;
      state.lastSync = Date.now();
    })
    // Handle profile update error
    .addCase(`${UserActionTypes.UPDATE_PROFILE}/rejected`, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.payload?.code || 'UPDATE_ERROR',
        message: action.payload?.message || 'Failed to update profile',
        field: action.payload?.field,
        timestamp: Date.now()
      };
    })
    // Handle settings update loading state
    .addCase(`${UserActionTypes.UPDATE_SETTINGS}/pending`, (state) => {
      state.loading = true;
      state.error = null;
    })
    // Handle successful settings update
    .addCase(`${UserActionTypes.UPDATE_SETTINGS}/fulfilled`, (state, action: PayloadAction<User>) => {
      state.loading = false;
      state.user = action.payload;
      state.persistedSettings = {
        ...state.persistedSettings,
        preferredLanguage: action.payload.preferredLanguage,
        twoFactorEnabled: action.payload.twoFactorEnabled
      };
      state.lastSync = Date.now();
    })
    // Handle settings update error
    .addCase(`${UserActionTypes.UPDATE_SETTINGS}/rejected`, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.payload?.code || 'SETTINGS_ERROR',
        message: action.payload?.message || 'Failed to update settings',
        timestamp: Date.now()
      };
    })
    // Handle 2FA enable loading state
    .addCase(`${UserActionTypes.ENABLE_2FA}/pending`, (state) => {
      state.loading = true;
      state.error = null;
    })
    // Handle successful 2FA enable
    .addCase(`${UserActionTypes.ENABLE_2FA}/fulfilled`, (state) => {
      if (state.user) {
        state.user.twoFactorEnabled = true;
        state.persistedSettings.twoFactorEnabled = true;
      }
      state.loading = false;
      state.lastSync = Date.now();
    })
    // Handle 2FA enable error
    .addCase(`${UserActionTypes.ENABLE_2FA}/rejected`, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.payload?.code || '2FA_ERROR',
        message: action.payload?.message || 'Failed to enable 2FA',
        timestamp: Date.now()
      };
    })
    // Handle 2FA disable loading state
    .addCase(`${UserActionTypes.DISABLE_2FA}/pending`, (state) => {
      state.loading = true;
      state.error = null;
    })
    // Handle successful 2FA disable
    .addCase(`${UserActionTypes.DISABLE_2FA}/fulfilled`, (state) => {
      if (state.user) {
        state.user.twoFactorEnabled = false;
        state.persistedSettings.twoFactorEnabled = false;
      }
      state.loading = false;
      state.lastSync = Date.now();
    })
    // Handle 2FA disable error
    .addCase(`${UserActionTypes.DISABLE_2FA}/rejected`, (state, action) => {
      state.loading = false;
      state.error = {
        code: action.payload?.code || '2FA_ERROR',
        message: action.payload?.message || 'Failed to disable 2FA',
        timestamp: Date.now()
      };
    })
    // Handle state clearing (logout)
    .addCase(UserActionTypes.CLEAR_STATE, (state) => {
      return {
        ...initialState,
        persistedSettings: {
          ...state.persistedSettings,
          preferredLanguage: state.persistedSettings.preferredLanguage // Preserve language preference
        }
      };
    });
});

export default userReducer;