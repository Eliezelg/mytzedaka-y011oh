import { createSlice, PayloadAction } from '@reduxjs/toolkit'; // ^1.9.5
import { IDonation } from '../../interfaces/donation.interface';
import { createDonation, getDonationById, getUserDonations, getAssociationDonations } from '../actions/donation.actions';

/**
 * Interface for granular error state tracking
 */
interface ErrorState {
  code: string;
  message: string;
  technical: string;
}

/**
 * Interface for donation slice state with enhanced tracking
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
 * Initial state with granular loading and error tracking
 */
const initialState: DonationState = {
  currentDonation: null,
  userDonations: [],
  associationDonations: [],
  loadingStates: {
    create: false,
    fetch: false,
    update: false,
    userDonations: false,
    associationDonations: false
  },
  error: null,
  optimisticUpdates: {},
  pagination: {
    total: 0,
    currentPage: 1
  }
};

/**
 * Donation reducer slice with enhanced error handling and optimistic updates
 */
const donationSlice = createSlice({
  name: 'donation',
  initialState,
  reducers: {
    resetError: (state) => {
      state.error = null;
    },
    clearCurrentDonation: (state) => {
      state.currentDonation = null;
    },
    rollbackOptimisticUpdate: (state, action: PayloadAction<string>) => {
      const { [action.payload]: removed, ...remaining } = state.optimisticUpdates;
      state.optimisticUpdates = remaining;
      
      // Remove optimistic donation from lists
      state.userDonations = state.userDonations.filter(d => d.id !== action.payload);
      state.associationDonations = state.associationDonations.filter(d => d.id !== action.payload);
    }
  },
  extraReducers: (builder) => {
    // Create donation handlers
    builder.addCase(createDonation.pending, (state, action) => {
      state.loadingStates.create = true;
      state.error = null;
      
      // Add optimistic update
      const optimisticDonation: IDonation = {
        id: `temp_${Date.now()}`,
        amount: action.meta.arg.amount,
        currency: action.meta.arg.currency,
        campaignId: action.meta.arg.campaignId,
        paymentStatus: 'PENDING',
        ...action.meta.arg
      };
      
      state.optimisticUpdates[optimisticDonation.id] = optimisticDonation;
      state.userDonations.unshift(optimisticDonation);
    });

    builder.addCase(createDonation.fulfilled, (state, action) => {
      state.loadingStates.create = false;
      
      // Remove optimistic update and add real donation
      const tempId = Object.keys(state.optimisticUpdates)[0];
      const { [tempId]: removed, ...remaining } = state.optimisticUpdates;
      state.optimisticUpdates = remaining;
      
      // Update lists with real donation
      state.userDonations = state.userDonations.map(d => 
        d.id === tempId ? action.payload : d
      );
      
      if (action.payload.campaignId) {
        state.associationDonations = state.associationDonations.map(d =>
          d.id === tempId ? action.payload : d
        );
      }
      
      state.currentDonation = action.payload;
    });

    builder.addCase(createDonation.rejected, (state, action) => {
      state.loadingStates.create = false;
      state.error = {
        code: action.payload?.code || 'UNKNOWN_ERROR',
        message: action.payload?.message || 'Failed to create donation',
        technical: action.error.message || 'Unknown technical error'
      };
      
      // Rollback optimistic update
      const tempId = Object.keys(state.optimisticUpdates)[0];
      if (tempId) {
        const { [tempId]: removed, ...remaining } = state.optimisticUpdates;
        state.optimisticUpdates = remaining;
        state.userDonations = state.userDonations.filter(d => d.id !== tempId);
        state.associationDonations = state.associationDonations.filter(d => d.id !== tempId);
      }
    });

    // Get donation by ID handlers
    builder.addCase(getDonationById.pending, (state) => {
      state.loadingStates.fetch = true;
      state.error = null;
    });

    builder.addCase(getDonationById.fulfilled, (state, action) => {
      state.loadingStates.fetch = false;
      state.currentDonation = action.payload;
    });

    builder.addCase(getDonationById.rejected, (state, action) => {
      state.loadingStates.fetch = false;
      state.error = {
        code: 'FETCH_ERROR',
        message: 'Failed to retrieve donation',
        technical: action.error.message || 'Unknown technical error'
      };
    });

    // Get user donations handlers
    builder.addCase(getUserDonations.pending, (state) => {
      state.loadingStates.userDonations = true;
      state.error = null;
    });

    builder.addCase(getUserDonations.fulfilled, (state, action) => {
      state.loadingStates.userDonations = false;
      state.userDonations = action.payload.donations;
      state.pagination.total = action.payload.total;
    });

    builder.addCase(getUserDonations.rejected, (state, action) => {
      state.loadingStates.userDonations = false;
      state.error = {
        code: 'USER_DONATIONS_ERROR',
        message: 'Failed to retrieve user donations',
        technical: action.error.message || 'Unknown technical error'
      };
    });

    // Get association donations handlers
    builder.addCase(getAssociationDonations.pending, (state) => {
      state.loadingStates.associationDonations = true;
      state.error = null;
    });

    builder.addCase(getAssociationDonations.fulfilled, (state, action) => {
      state.loadingStates.associationDonations = false;
      state.associationDonations = action.payload.donations;
      state.pagination.total = action.payload.total;
    });

    builder.addCase(getAssociationDonations.rejected, (state, action) => {
      state.loadingStates.associationDonations = false;
      state.error = {
        code: 'ASSOCIATION_DONATIONS_ERROR',
        message: 'Failed to retrieve association donations',
        technical: action.error.message || 'Unknown technical error'
      };
    });
  }
});

export const { resetError, clearCurrentDonation, rollbackOptimisticUpdate } = donationSlice.actions;
export default donationSlice.reducer;