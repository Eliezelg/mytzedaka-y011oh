import { createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.5
import { IDonation, IDonationForm } from '../../interfaces/donation.interface';
import DonationService from '../../services/donation.service';

// Initialize donation service
const donationService = new DonationService();

/**
 * Action type constants for donation operations
 */
export const DONATION_ACTIONS = {
  CREATE_DONATION: 'donation/createDonation',
  CREATE_DONATION_RETRY: 'donation/createDonation/retry',
  CREATE_DONATION_ERROR: 'donation/createDonation/error',
  GET_DONATION: 'donation/getDonationById',
  GET_USER_DONATIONS: 'donation/getUserDonations',
  GET_ASSOCIATION_DONATIONS: 'donation/getAssociationDonations',
  UPDATE_DONATION_STATUS: 'donation/updateStatus',
  CLEAR_DONATION_ERROR: 'donation/clearError'
} as const;

/**
 * Interface for error details with retry information
 */
interface DonationError {
  message: string;
  code: string;
  retryable: boolean;
  retryCount: number;
  lastAttempt: Date;
}

/**
 * Creates a new donation with comprehensive error handling and retry logic
 */
export const createDonation = createAsyncThunk<
  IDonation,
  IDonationForm,
  {
    rejectValue: DonationError;
  }
>(
  DONATION_ACTIONS.CREATE_DONATION,
  async (donationData: IDonationForm, { rejectWithValue }) => {
    try {
      const donation = await donationService.createDonation(donationData);
      return donation;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to process donation',
        code: error.code || 'DONATION_ERROR',
        retryable: error.response?.status !== 400, // Don't retry validation errors
        retryCount: 0,
        lastAttempt: new Date()
      });
    }
  }
);

/**
 * Retrieves a specific donation by ID
 */
export const getDonationById = createAsyncThunk<
  IDonation,
  string,
  {
    rejectValue: string;
  }
>(
  DONATION_ACTIONS.GET_DONATION,
  async (donationId: string, { rejectWithValue }) => {
    try {
      const donation = await donationService.getDonationById(donationId);
      return donation;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to retrieve donation');
    }
  }
);

/**
 * Retrieves donations for a specific user with pagination
 */
export const getUserDonations = createAsyncThunk<
  {
    donations: IDonation[];
    total: number;
  },
  {
    userId: string;
    page?: number;
    limit?: number;
  },
  {
    rejectValue: string;
  }
>(
  DONATION_ACTIONS.GET_USER_DONATIONS,
  async ({ userId, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const result = await donationService.getUserDonations(userId, page, limit);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to retrieve user donations');
    }
  }
);

/**
 * Retries a failed donation with updated payment information
 */
export const retryDonation = createAsyncThunk<
  IDonation,
  {
    donationId: string;
    updatedPaymentData: Partial<IDonationForm>;
  },
  {
    rejectValue: DonationError;
  }
>(
  DONATION_ACTIONS.CREATE_DONATION_RETRY,
  async ({ donationId, updatedPaymentData }, { rejectWithValue, getState }) => {
    try {
      // Get the original donation from state
      const state: any = getState();
      const originalDonation = state.donations.entities[donationId];

      if (!originalDonation) {
        throw new Error('Original donation not found');
      }

      // Merge original donation data with updated payment information
      const retryData: IDonationForm = {
        ...originalDonation,
        ...updatedPaymentData,
        retryCount: (originalDonation.retryCount || 0) + 1
      };

      const donation = await donationService.createDonation(retryData);
      return donation;
    } catch (error: any) {
      return rejectWithValue({
        message: error.message || 'Failed to retry donation',
        code: error.code || 'RETRY_ERROR',
        retryable: error.response?.status !== 400,
        retryCount: (error.retryCount || 0) + 1,
        lastAttempt: new Date()
      });
    }
  }
);

/**
 * Retrieves donations for a specific association with pagination
 */
export const getAssociationDonations = createAsyncThunk<
  {
    donations: IDonation[];
    total: number;
  },
  {
    associationId: string;
    page?: number;
    limit?: number;
  },
  {
    rejectValue: string;
  }
>(
  DONATION_ACTIONS.GET_ASSOCIATION_DONATIONS,
  async ({ associationId, page = 1, limit = 10 }, { rejectWithValue }) => {
    try {
      const result = await donationService.getUserDonations(associationId, page, limit);
      return result;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to retrieve association donations');
    }
  }
);

/**
 * Action creator for clearing donation errors
 */
export const clearDonationError = createAsyncThunk(
  DONATION_ACTIONS.CLEAR_DONATION_ERROR,
  async () => {
    return null;
  }
);