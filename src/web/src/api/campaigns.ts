/**
 * @fileoverview API module for campaign management including creation, updates,
 * progress tracking, and lottery campaign handling with multi-currency support
 * @version 1.0.0
 */

import apiClient from './apiClient'; // ^1.6.0
import { ICampaign, ICampaignProgress, CampaignStatus } from '../interfaces/campaign.interface';
import { API_ENDPOINTS, CACHE_DURATION, SUPPORTED_CURRENCIES } from '../config/constants';

// Validation constants
const SUPPORTED_CAMPAIGN_CURRENCIES = SUPPORTED_CURRENCIES;
const VALID_CAMPAIGN_STATUSES = Object.values(CampaignStatus);

/**
 * Interface for campaign filter parameters
 */
interface ICampaignFilters {
  status?: CampaignStatus;
  associationId?: string;
  isLottery?: boolean;
  startDate?: Date;
  endDate?: Date;
  currency?: string;
}

/**
 * Interface for pagination parameters
 */
interface IPaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Retrieves a paginated list of campaigns with optional filtering
 */
export const getCampaigns = async (
  filters: ICampaignFilters = {},
  pagination: IPaginationParams
): Promise<{ campaigns: ICampaign[]; total: number }> => {
  try {
    // Construct query parameters
    const params = {
      ...filters,
      page: pagination.page,
      limit: pagination.limit,
      sortBy: pagination.sortBy,
      sortOrder: pagination.sortOrder,
    };

    const response = await apiClient.get(API_ENDPOINTS.CAMPAIGNS.LIST, { 
      params,
      headers: {
        'Cache-Control': `max-age=${CACHE_DURATION.CAMPAIGN_LIST}`
      }
    });

    return {
      campaigns: response.data.campaigns,
      total: response.data.total
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves a specific campaign by ID
 */
export const getCampaignById = async (campaignId: string): Promise<ICampaign> => {
  try {
    const response = await apiClient.get(
      API_ENDPOINTS.CAMPAIGNS.DETAIL.replace(':id', campaignId)
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Validates campaign data before creation or update
 */
const validateCampaignData = (campaignData: Partial<ICampaign>): void => {
  if (campaignData.currency && !SUPPORTED_CAMPAIGN_CURRENCIES.includes(campaignData.currency)) {
    throw new Error(`Unsupported currency. Supported currencies: ${SUPPORTED_CAMPAIGN_CURRENCIES.join(', ')}`);
  }

  if (campaignData.status && !VALID_CAMPAIGN_STATUSES.includes(campaignData.status)) {
    throw new Error(`Invalid campaign status. Valid statuses: ${VALID_CAMPAIGN_STATUSES.join(', ')}`);
  }

  if (campaignData.startDate && campaignData.endDate) {
    const start = new Date(campaignData.startDate);
    const end = new Date(campaignData.endDate);
    if (start >= end) {
      throw new Error('End date must be after start date');
    }
  }
};

/**
 * Creates a new campaign with validation
 */
export const createCampaign = async (campaignData: Omit<ICampaign, 'id'>): Promise<ICampaign> => {
  try {
    validateCampaignData(campaignData);

    const response = await apiClient.post(
      API_ENDPOINTS.CAMPAIGNS.CREATE,
      campaignData
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Updates an existing campaign with status transition validation
 */
export const updateCampaign = async (
  campaignId: string,
  updateData: Partial<ICampaign>
): Promise<ICampaign> => {
  try {
    validateCampaignData(updateData);

    const response = await apiClient.put(
      API_ENDPOINTS.CAMPAIGNS.UPDATE.replace(':id', campaignId),
      updateData
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Soft deletes a campaign with status check
 */
export const deleteCampaign = async (campaignId: string): Promise<void> => {
  try {
    // Check campaign status before deletion
    const campaign = await getCampaignById(campaignId);
    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new Error('Cannot delete an active campaign');
    }

    await apiClient.delete(
      API_ENDPOINTS.CAMPAIGNS.DELETE.replace(':id', campaignId)
    );
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves real-time campaign progress metrics
 */
export const getCampaignProgress = async (campaignId: string): Promise<ICampaignProgress> => {
  try {
    const response = await apiClient.get(
      `${API_ENDPOINTS.CAMPAIGNS.DETAIL.replace(':id', campaignId)}/progress`
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

/**
 * Retrieves active lottery campaigns with specialized filtering
 */
export const getLotteryCampaigns = async (
  filters: Omit<ICampaignFilters, 'isLottery'> = {}
): Promise<ICampaign[]> => {
  try {
    const response = await apiClient.get(
      `${API_ENDPOINTS.CAMPAIGNS.LIST}/lottery`,
      {
        params: {
          ...filters,
          status: CampaignStatus.ACTIVE,
          isLottery: true
        }
      }
    );
    return response.data.campaigns;
  } catch (error) {
    throw error;
  }
};