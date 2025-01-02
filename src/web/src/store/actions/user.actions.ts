/**
 * @fileoverview Redux action creators for user-related state management
 * @version 1.0.0
 */

import { createAction, createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.0
import { User, UserProfile } from '../../interfaces/user.interface';
import UserService from '../../services/user.service';

/**
 * User action type constants
 */
export enum UserActionTypes {
  GET_PROFILE = 'user/getProfile',
  UPDATE_PROFILE = 'user/updateProfile',
  UPDATE_SETTINGS = 'user/updateSettings',
  ENABLE_2FA = 'user/enable2FA',
  DISABLE_2FA = 'user/disable2FA',
  SET_ERROR = 'user/setError',
  CLEAR_ERROR = 'user/clearError'
}

/**
 * Error type for user-related actions
 */
export interface UserError {
  code: string;
  message: string;
  field?: string;
}

/**
 * Type for 2FA setup response
 */
export interface TwoFactorSetup {
  qrCodeUrl: string;
  secret: string;
}

/**
 * Action creator for setting user error state
 */
export const setUserError = createAction<UserError>(UserActionTypes.SET_ERROR);

/**
 * Action creator for clearing user error state
 */
export const clearUserError = createAction(UserActionTypes.CLEAR_ERROR);

/**
 * Async thunk action to fetch user profile
 */
export const getProfile = createAsyncThunk<
  User,
  void,
  { rejectValue: UserError }
>(UserActionTypes.GET_PROFILE, async (_, { rejectWithValue }) => {
  try {
    const user = await UserService.getUserProfile();
    return user;
  } catch (error: any) {
    return rejectWithValue({
      code: 'PROFILE_FETCH_ERROR',
      message: error.message || 'Failed to fetch user profile'
    });
  }
});

/**
 * Async thunk action to update user profile
 */
export const updateProfile = createAsyncThunk<
  User,
  UserProfile,
  { rejectValue: UserError }
>(UserActionTypes.UPDATE_PROFILE, async (profileData, { rejectWithValue }) => {
  try {
    const updatedUser = await UserService.updateUserProfile(profileData);
    return updatedUser;
  } catch (error: any) {
    return rejectWithValue({
      code: 'PROFILE_UPDATE_ERROR',
      message: error.message || 'Failed to update user profile',
      field: error.field
    });
  }
});

/**
 * Async thunk action to update user settings
 */
export const updateSettings = createAsyncThunk<
  User,
  Partial<User>,
  { rejectValue: UserError }
>(UserActionTypes.UPDATE_SETTINGS, async (settings, { rejectWithValue }) => {
  try {
    const updatedUser = await UserService.updateUserSettings({
      twoFactorEnabled: settings.twoFactorEnabled ?? false,
      preferredLanguage: settings.preferredLanguage ?? 'en',
      emailNotifications: true,
      autoLogoutTime: 30
    });
    return updatedUser;
  } catch (error: any) {
    return rejectWithValue({
      code: 'SETTINGS_UPDATE_ERROR',
      message: error.message || 'Failed to update user settings'
    });
  }
});

/**
 * Async thunk action to enable 2FA
 */
export const enable2FA = createAsyncThunk<
  TwoFactorSetup,
  void,
  { rejectValue: UserError }
>(UserActionTypes.ENABLE_2FA, async (_, { rejectWithValue }) => {
  try {
    const setup = await UserService.setupTwoFactorAuth();
    return setup;
  } catch (error: any) {
    return rejectWithValue({
      code: '2FA_SETUP_ERROR',
      message: error.message || 'Failed to setup 2FA'
    });
  }
});

/**
 * Async thunk action to disable 2FA
 */
export const disable2FA = createAsyncThunk<
  void,
  string,
  { rejectValue: UserError }
>(UserActionTypes.DISABLE_2FA, async (verificationCode, { rejectWithValue }) => {
  try {
    await UserService.disableTwoFactorAuth(verificationCode);
  } catch (error: any) {
    return rejectWithValue({
      code: '2FA_DISABLE_ERROR',
      message: error.message || 'Failed to disable 2FA'
    });
  }
});