/**
 * @fileoverview API module for handling donation-related HTTP requests
 * Supports dual payment gateway integration (Stripe/Tranzilla), multi-currency,
 * and comprehensive error handling
 * @version 1.0.0
 */

import axiosRetry from 'axios-retry'; // ^3.5.0
import apiClient from './apiClient';
import { IDonation, IDonationForm } from '../interfaces/donation.interface';
import { 
  API_ENDPOINTS, 
  PAYMENT_CONFIG, 
  ERROR_MESSAGES,
  CACHE_DURATION 
} from '../config/constants';

// Configure retry mechanism for payment-related requests
axiosRetry(apiClient, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || 
           error.response?.status === 500;
  }
});

/**
 * Creates a new donation with enhanced payment processing
 * @param donationData - Validated donation form data
 * @returns Promise resolving to created donation with transaction details
 */
export const createDonation = async (donationData: IDonationForm): Promise<IDonation> => {
  // Validate donation amount against configured limits
  if (donationData.amount < PAYMENT_CONFIG.MIN_DONATION_AMOUNT || 
      donationData.amount > PAYMENT_CONFIG.MAX_DONATION_AMOUNT) {
    throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
  }

  try {
    const response = await apiClient.post<IDonation>(
      API_ENDPOINTS.DONATIONS.CREATE,
      donationData,
      {
        headers: {
          'Idempotency-Key': `${Date.now()}-${donationData.associationId}`,
          'X-Payment-Gateway': donationData.paymentGateway
        }
      }
    );

    return response.data;
  } catch (error: any) {
    if (error.response?.data?.message) {
      throw new Error(error.response.data.message);
    }
    throw new Error(ERROR_MESSAGES.PAYMENT_ERROR);
  }
};

/**
 * Retrieves a specific donation with caching support
 * @param donationId - Unique identifier of the donation
 * @returns Promise resolving to donation details
 */
export const getDonationById = async (donationId: string): Promise<IDonation> => {
  const cacheKey = `donation_${donationId}`;
  const cachedData = localStorage.getItem(cacheKey);

  if (cachedData) {
    const { data, timestamp } = JSON.parse(cachedData);
    const isCacheValid = Date.now() - timestamp < CACHE_DURATION.DONATION_HISTORY * 1000;
    
    if (isCacheValid) {
      return data as IDonation;
    }
  }

  const response = await apiClient.get<IDonation>(
    API_ENDPOINTS.DONATIONS.DETAIL.replace(':id', donationId)
  );

  // Cache the fresh data
  localStorage.setItem(cacheKey, JSON.stringify({
    data: response.data,
    timestamp: Date.now()
  }));

  return response.data;
};

/**
 * Interface for donation filter parameters
 */
interface DonationFilters {
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  currency?: string;
  campaignId?: string;
  status?: string;
  page?: number;
  limit?: number;
}

/**
 * Retrieves user donations with enhanced filtering
 * @param filters - Optional filter parameters
 * @returns Promise resolving to filtered list of donations
 */
export const getUserDonations = async (filters: DonationFilters = {}): Promise<IDonation[]> => {
  const queryParams = new URLSearchParams();

  // Add validated filters to query parameters
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, value.toString());
    }
  });

  try {
    const response = await apiClient.get<IDonation[]>(
      `${API_ENDPOINTS.DONATIONS.LIST}?${queryParams.toString()}`
    );

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      return [];
    }
    throw error;
  }
};

/**
 * Generates and downloads a tax receipt for a specific donation
 * @param donationId - Unique identifier of the donation
 * @returns Promise resolving to the receipt download URL
 */
export const generateDonationReceipt = async (donationId: string): Promise<string> => {
  const response = await apiClient.get<{ downloadUrl: string }>(
    API_ENDPOINTS.DONATIONS.RECEIPT.replace(':id', donationId),
    {
      responseType: 'blob'
    }
  );

  return response.data.downloadUrl;
};

/**
 * Updates the payment status of a donation
 * @param donationId - Unique identifier of the donation
 * @param status - New payment status
 * @returns Promise resolving to updated donation
 */
export const updateDonationStatus = async (
  donationId: string, 
  status: string
): Promise<IDonation> => {
  const response = await apiClient.post<IDonation>(
    `${API_ENDPOINTS.DONATIONS.DETAIL.replace(':id', donationId)}/status`,
    { status }
  );

  // Invalidate cache after status update
  localStorage.removeItem(`donation_${donationId}`);

  return response.data;
};