import { createAction, createAsyncThunk } from '@reduxjs/toolkit'; // ^1.9.0
import { ICampaign } from '../../interfaces/campaign.interface';
import CampaignService from '../../services/campaign.service';

// Action Types
export const FETCH_CAMPAIGNS = 'campaigns/fetchCampaigns';
export const FETCH_CAMPAIGN_BY_ID = 'campaigns/fetchCampaignById';
export const CREATE_CAMPAIGN = 'campaigns/createCampaign';
export const UPDATE_CAMPAIGN = 'campaigns/updateCampaign';
export const DELETE_CAMPAIGN = 'campaigns/deleteCampaign';
export const FETCH_CAMPAIGN_PROGRESS = 'campaigns/fetchProgress';
export const FETCH_LOTTERY_CAMPAIGNS = 'campaigns/fetchLotteryCampaigns';

// Sync Actions
export const resetCampaignState = createAction('campaigns/reset');
export const setCampaignFilter = createAction<Record<string, any>>('campaigns/setFilter');
export const clearCampaignFilter = createAction('campaigns/clearFilter');

// Async Actions
export const fetchCampaigns = createAsyncThunk(
  FETCH_CAMPAIGNS,
  async (filters: Record<string, any> = {}, { rejectWithValue }) => {
    try {
      const response = await CampaignService.fetchCampaigns(1, 10, filters);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCampaignById = createAsyncThunk(
  FETCH_CAMPAIGN_BY_ID,
  async (id: string, { rejectWithValue }) => {
    try {
      const campaign = await CampaignService.fetchCampaignById(id);
      return campaign;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const createCampaign = createAsyncThunk(
  CREATE_CAMPAIGN,
  async (campaignData: Omit<ICampaign, 'id'>, { rejectWithValue }) => {
    try {
      const campaign = await CampaignService.createNewCampaign(campaignData);
      return campaign;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const updateCampaign = createAsyncThunk(
  UPDATE_CAMPAIGN,
  async ({ id, updateData }: { id: string; updateData: Partial<ICampaign> }, { rejectWithValue }) => {
    try {
      const campaign = await CampaignService.updateExistingCampaign(id, updateData);
      return campaign;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const deleteCampaign = createAsyncThunk(
  DELETE_CAMPAIGN,
  async (id: string, { rejectWithValue }) => {
    try {
      await CampaignService.removeCampaign(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchCampaignProgress = createAsyncThunk(
  FETCH_CAMPAIGN_PROGRESS,
  async (id: string, { rejectWithValue }) => {
    try {
      const progress = await CampaignService.fetchCampaignProgress(id);
      return { id, progress };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

export const fetchLotteryCampaigns = createAsyncThunk(
  FETCH_LOTTERY_CAMPAIGNS,
  async (filters: Record<string, any> = {}, { rejectWithValue }) => {
    try {
      const campaigns = await CampaignService.fetchLotteryCampaigns(filters);
      return campaigns;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Action Types for TypeScript
export type CampaignActions = 
  | ReturnType<typeof resetCampaignState>
  | ReturnType<typeof setCampaignFilter>
  | ReturnType<typeof clearCampaignFilter>
  | ReturnType<typeof fetchCampaigns.pending>
  | ReturnType<typeof fetchCampaigns.fulfilled>
  | ReturnType<typeof fetchCampaigns.rejected>
  | ReturnType<typeof fetchCampaignById.pending>
  | ReturnType<typeof fetchCampaignById.fulfilled>
  | ReturnType<typeof fetchCampaignById.rejected>
  | ReturnType<typeof createCampaign.pending>
  | ReturnType<typeof createCampaign.fulfilled>
  | ReturnType<typeof createCampaign.rejected>
  | ReturnType<typeof updateCampaign.pending>
  | ReturnType<typeof updateCampaign.fulfilled>
  | ReturnType<typeof updateCampaign.rejected>
  | ReturnType<typeof deleteCampaign.pending>
  | ReturnType<typeof deleteCampaign.fulfilled>
  | ReturnType<typeof deleteCampaign.rejected>
  | ReturnType<typeof fetchCampaignProgress.pending>
  | ReturnType<typeof fetchCampaignProgress.fulfilled>
  | ReturnType<typeof fetchCampaignProgress.rejected>
  | ReturnType<typeof fetchLotteryCampaigns.pending>
  | ReturnType<typeof fetchLotteryCampaigns.fulfilled>
  | ReturnType<typeof fetchLotteryCampaigns.rejected>;