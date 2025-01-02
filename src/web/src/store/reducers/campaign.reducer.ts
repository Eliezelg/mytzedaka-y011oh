import { createReducer, createSelector, PayloadAction } from '@reduxjs/toolkit';
import { ICampaign, ICampaignProgress, CampaignStatus } from '../../interfaces/campaign.interface';

// Enhanced error state interface with detailed error information
interface ErrorState {
  code: string;
  message: string;
  details?: Record<string, any>;
}

// Currency information interface for exchange rate support
interface CurrencyInfo {
  rate: number;
  symbol: string;
  decimalPlaces: number;
}

// Enhanced campaign state interface with comprehensive tracking
interface CampaignState {
  campaigns: Record<string, ICampaign>;
  campaignProgress: Record<string, ICampaignProgress>;
  loading: boolean;
  error: ErrorState | null;
  selectedCampaignId: string | null;
  currencies: Record<string, CurrencyInfo>;
}

// Initial state with proper typing
const initialState: CampaignState = {
  campaigns: {},
  campaignProgress: {},
  loading: false,
  error: null,
  selectedCampaignId: null,
  currencies: {
    USD: { rate: 1, symbol: '$', decimalPlaces: 2 },
    ILS: { rate: 3.5, symbol: '₪', decimalPlaces: 2 },
    EUR: { rate: 0.85, symbol: '€', decimalPlaces: 2 }
  }
};

// Create the enhanced campaign reducer with comprehensive error handling
export const campaignReducer = createReducer(initialState, {
  // Campaign CRUD operations
  'campaign/create': (state, action: PayloadAction<ICampaign>) => {
    state.loading = false;
    state.campaigns[action.payload.id] = action.payload;
    initializeCampaignProgress(state, action.payload);
  },

  'campaign/update': (state, action: PayloadAction<Partial<ICampaign> & { id: string }>) => {
    const { id, ...updates } = action.payload;
    if (state.campaigns[id]) {
      state.campaigns[id] = { ...state.campaigns[id], ...updates };
      updateCampaignProgress(state, id);
    }
  },

  'campaign/delete': (state, action: PayloadAction<string>) => {
    delete state.campaigns[action.payload];
    delete state.campaignProgress[action.payload];
    if (state.selectedCampaignId === action.payload) {
      state.selectedCampaignId = null;
    }
  },

  // Lottery-specific actions
  'campaign/lottery/updateTickets': (state, action: PayloadAction<{ 
    campaignId: string, 
    ticketsSold: number 
  }>) => {
    const campaign = state.campaigns[action.payload.campaignId];
    if (campaign?.isLottery && campaign.lotteryDetails) {
      campaign.lotteryDetails.ticketsSold = action.payload.ticketsSold;
      campaign.lotteryDetails.remainingTickets = 
        campaign.lotteryDetails.maxTickets - action.payload.ticketsSold;
      updateCampaignProgress(state, action.payload.campaignId);
    }
  },

  // Progress tracking actions
  'campaign/updateProgress': (state, action: PayloadAction<{ 
    campaignId: string, 
    currentAmount: number 
  }>) => {
    const campaign = state.campaigns[action.payload.campaignId];
    if (campaign) {
      campaign.currentAmount = action.payload.currentAmount;
      updateCampaignProgress(state, action.payload.campaignId);
    }
  },

  // Currency handling actions
  'campaign/updateCurrencyRates': (state, action: PayloadAction<Record<string, number>>) => {
    Object.entries(action.payload).forEach(([currency, rate]) => {
      if (state.currencies[currency]) {
        state.currencies[currency].rate = rate;
      }
    });
  },

  // Loading and error states
  'campaign/setLoading': (state, action: PayloadAction<boolean>) => {
    state.loading = action.payload;
    state.error = null;
  },

  'campaign/setError': (state, action: PayloadAction<ErrorState>) => {
    state.loading = false;
    state.error = action.payload;
  },

  'campaign/clearError': (state) => {
    state.error = null;
  }
});

// Helper function to initialize campaign progress
function initializeCampaignProgress(state: CampaignState, campaign: ICampaign): void {
  state.campaignProgress[campaign.id] = {
    currentAmount: campaign.currentAmount,
    goalAmount: campaign.goalAmount,
    percentage: calculatePercentage(campaign.currentAmount, campaign.goalAmount),
    donorsTarget: null,
    donorsPercentage: 0,
    timeRemainingDays: calculateRemainingDays(campaign.endDate)
  };
}

// Helper function to update campaign progress
function updateCampaignProgress(state: CampaignState, campaignId: string): void {
  const campaign = state.campaigns[campaignId];
  if (campaign) {
    state.campaignProgress[campaignId] = {
      ...state.campaignProgress[campaignId],
      currentAmount: campaign.currentAmount,
      goalAmount: campaign.goalAmount,
      percentage: calculatePercentage(campaign.currentAmount, campaign.goalAmount),
      timeRemainingDays: calculateRemainingDays(campaign.endDate)
    };
  }
}

// Helper function to calculate percentage
function calculatePercentage(current: number, goal: number): number {
  return Math.min(Math.round((current / goal) * 100), 100);
}

// Helper function to calculate remaining days
function calculateRemainingDays(endDate: Date): number {
  const now = new Date();
  const end = new Date(endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 0);
}

// Memoized selectors for optimized state access
export const selectCampaigns = createSelector(
  [(state: { campaign: CampaignState }) => state.campaign.campaigns],
  (campaigns) => Object.values(campaigns)
);

export const selectActiveCampaigns = createSelector(
  [selectCampaigns],
  (campaigns) => campaigns.filter(c => c.status === CampaignStatus.ACTIVE)
);

export const selectCampaignWithCurrency = createSelector(
  [(state: { campaign: CampaignState }) => state.campaign.campaigns,
   (state: { campaign: CampaignState }) => state.campaign.currencies,
   (_: any, campaignId: string) => campaignId,
   (_: any, _2: string, targetCurrency: string) => targetCurrency],
  (campaigns, currencies, campaignId, targetCurrency) => {
    const campaign = campaigns[campaignId];
    if (!campaign) return null;

    const sourceRate = currencies[campaign.currency]?.rate || 1;
    const targetRate = currencies[targetCurrency]?.rate || 1;
    const conversionRate = targetRate / sourceRate;

    return {
      ...campaign,
      goalAmount: campaign.goalAmount * conversionRate,
      currentAmount: campaign.currentAmount * conversionRate,
      currency: targetCurrency,
      lotteryDetails: campaign.lotteryDetails ? {
        ...campaign.lotteryDetails,
        ticketPrice: campaign.lotteryDetails.ticketPrice * conversionRate,
        currency: targetCurrency
      } : null
    };
  }
);

export default campaignReducer;