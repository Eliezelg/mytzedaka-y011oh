/**
 * @fileoverview API module for managing Jewish charitable associations
 * Provides CRUD operations, payment gateway integration, and document verification workflows
 * with multi-language support and enhanced security measures
 * @version 1.0.0
 */

import apiClient from './apiClient';
import { IAssociation, IAssociationStatus } from '../interfaces/association.interface';
import axiosRetry from 'axios-retry'; // ^3.8.0
import { CACHE_DURATION, API_ENDPOINTS, ERROR_MESSAGES } from '../config/constants';

// Configure retry logic for resilient API calls
axiosRetry(apiClient, { 
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => {
    return axiosRetry.isNetworkOrIdempotentRequestError(error) || error.response?.status === 429;
  }
});

/**
 * Cache interface for association data
 */
interface IAssociationCache {
  data: IAssociation[];
  timestamp: number;
  total: number;
}

/**
 * Parameters for association listing
 */
interface IAssociationParams {
  page?: number;
  limit?: number;
  status?: IAssociationStatus;
  category?: string;
  language?: string;
  search?: string;
}

/**
 * Retrieves a paginated list of associations with optional filters
 * Implements caching and language-specific content delivery
 */
export const getAssociations = async (params: IAssociationParams = {}): Promise<{
  data: IAssociation[];
  total: number;
}> => {
  try {
    // Generate cache key based on request parameters
    const cacheKey = `associations_${JSON.stringify(params)}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      const parsed: IAssociationCache = JSON.parse(cachedData);
      const isValid = Date.now() - parsed.timestamp < CACHE_DURATION.ASSOCIATION_DETAILS * 1000;
      
      if (isValid) {
        return { data: parsed.data, total: parsed.total };
      }
    }

    // Prepare request parameters with defaults
    const queryParams = {
      page: params.page || 1,
      limit: params.limit || 10,
      status: params.status,
      category: params.category,
      language: params.language || localStorage.getItem('selected_language') || 'en',
      search: params.search
    };

    const response = await apiClient.get<{
      data: IAssociation[];
      total: number;
    }>('/associations', { params: queryParams });

    // Cache the successful response
    const cacheData: IAssociationCache = {
      data: response.data.data,
      total: response.data.total,
      timestamp: Date.now()
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));

    return response.data;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
  }
};

/**
 * Retrieves detailed information for a specific association
 * Includes payment gateway status and document verification state
 */
export const getAssociationById = async (id: string): Promise<IAssociation> => {
  try {
    const cacheKey = `association_${id}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      const parsed = JSON.parse(cachedData);
      const isValid = Date.now() - parsed.timestamp < CACHE_DURATION.ASSOCIATION_DETAILS * 1000;
      
      if (isValid) {
        return parsed.data;
      }
    }

    const response = await apiClient.get<IAssociation>(`/associations/${id}`);
    
    // Cache the successful response
    localStorage.setItem(cacheKey, JSON.stringify({
      data: response.data,
      timestamp: Date.now()
    }));

    return response.data;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
  }
};

/**
 * Creates a new association with required verification documents
 */
export const createAssociation = async (
  associationData: Omit<IAssociation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<IAssociation> => {
  try {
    const response = await apiClient.post<IAssociation>('/associations', associationData);
    return response.data;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
  }
};

/**
 * Updates an existing association's information
 */
export const updateAssociation = async (
  id: string,
  updateData: Partial<IAssociation>
): Promise<IAssociation> => {
  try {
    const response = await apiClient.put<IAssociation>(`/associations/${id}`, updateData);
    
    // Invalidate related caches
    localStorage.removeItem(`association_${id}`);
    Object.keys(localStorage)
      .filter(key => key.startsWith('associations_'))
      .forEach(key => localStorage.removeItem(key));

    return response.data;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
  }
};

/**
 * Updates association payment gateway configuration
 */
export const updateAssociationPaymentGateways = async (
  id: string,
  gatewayConfig: IAssociation['paymentGateways']
): Promise<IAssociation> => {
  try {
    const response = await apiClient.put<IAssociation>(
      `/associations/${id}/payment-gateways`,
      gatewayConfig
    );
    
    // Invalidate cached data
    localStorage.removeItem(`association_${id}`);
    return response.data;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
  }
};

/**
 * Submits association documents for verification
 */
export const submitVerificationDocuments = async (
  id: string,
  documents: Array<{ type: string; file: File }>
): Promise<void> => {
  try {
    const formData = new FormData();
    documents.forEach(doc => {
      formData.append(doc.type, doc.file);
    });

    await apiClient.post(`/associations/${id}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    
    // Invalidate cached data
    localStorage.removeItem(`association_${id}`);
  } catch (error) {
    throw new Error(ERROR_MESSAGES.VALIDATION_ERROR);
  }
};

/**
 * Updates association status with audit logging
 */
export const updateAssociationStatus = async (
  id: string,
  status: IAssociationStatus,
  reason: string
): Promise<IAssociation> => {
  try {
    const response = await apiClient.put<IAssociation>(`/associations/${id}/status`, {
      status,
      reason,
      updatedAt: new Date().toISOString()
    });
    
    // Invalidate cached data
    localStorage.removeItem(`association_${id}`);
    Object.keys(localStorage)
      .filter(key => key.startsWith('associations_'))
      .forEach(key => localStorage.removeItem(key));

    return response.data;
  } catch (error) {
    throw new Error(ERROR_MESSAGES.PERMISSION_ERROR);
  }
};