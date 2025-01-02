/**
 * @fileoverview Root reducer combining all feature reducers with enhanced security,
 * performance monitoring, and type-safe state management
 * @version 1.0.0
 */

import { combineReducers } from '@reduxjs/toolkit'; // ^1.9.5
import { reducer as authReducer } from './auth.reducer';
import { reducer as campaignReducer } from './campaign.reducer';
import { reducer as donationReducer } from './donation.reducer';
import { User } from '../../interfaces/user.interface';
import { ICampaign, ICampaignProgress } from '../../interfaces/campaign.interface';
import { IDonation } from '../../interfaces/donation.interface';

/**
 * Enhanced error state interface for granular error tracking
 */
interface ErrorState {
  code: string;
  message: string;
  technical?: string;
}

/**
 * Type-safe interface for authentication state
 */
interface AuthState {
  user: User | null;
  loading: boolean;
  error: ErrorState | null;
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
 * Type-safe interface for campaign state
 */
interface CampaignState {
  campaigns: Record<string, ICampaign>;
  campaignProgress: Record<string, ICampaignProgress>;
  loading: boolean;
  error: ErrorState | null;
  selectedCampaignId: string | null;
}

/**
 * Type-safe interface for donation state
 */
interface DonationState {
  currentDonation: IDonation | null;
  userDonations: IDonation[];
  associationDonations: IDonation[];
  loadingStates: {
    create: boolean;
    fetch: boolean;
    update: boolean;
    userDonations: boolean;
    associationDonations: boolean;
  };
  error: ErrorState | null;
  optimisticUpdates: Record<string, IDonation>;
  pagination: {
    total: number;
    currentPage: number;
  };
}

/**
 * Type-safe interface for the complete application state tree
 */
export interface RootState {
  auth: AuthState;
  campaigns: CampaignState;
  donations: DonationState;
}

/**
 * Performance monitoring wrapper for reducers
 * @param reducer - The reducer to be monitored
 * @param name - The name of the reducer for tracking
 */
const monitorReducerPerformance = (reducer: any, name: string) => {
  return (state: any, action: any) => {
    const start = performance.now();
    const newState = reducer(state, action);
    const end = performance.now();
    const duration = end - start;

    // Log performance metrics if duration exceeds threshold
    if (duration > 16) { // ~1 frame at 60fps
      console.warn(`Reducer ${name} took ${duration.toFixed(2)}ms to process ${action.type}`);
    }

    return newState;
  };
};

/**
 * Root reducer combining all feature reducers with performance monitoring
 * and type safety
 */
export const rootReducer = combineReducers<RootState>({
  auth: monitorReducerPerformance(authReducer, 'auth'),
  campaigns: monitorReducerPerformance(campaignReducer, 'campaigns'),
  donations: monitorReducerPerformance(donationReducer, 'donations')
});

/**
 * Type-safe selector for accessing the root state
 * @param state - The root state
 */
export const selectRootState = (state: RootState): RootState => state;

export default rootReducer;