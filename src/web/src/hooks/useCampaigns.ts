import { useState, useEffect, useCallback } from 'react'; // ^18.2.0
import { useSelector, useDispatch } from 'react-redux'; // ^8.1.0
import { ICampaign, ICampaignProgress } from '../interfaces/campaign.interface';
import { 
  fetchCampaigns,
  fetchCampaignById,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  fetchCampaignProgress,
  fetchLotteryCampaigns
} from '../store/actions/campaign.actions';
import { CACHE_DURATION } from '../config/constants';

/**
 * Interface for campaign error state
 */
interface ICampaignError {
  message: string;
  code?: string;
  field?: string;
}

/**
 * Interface for campaign filters
 */
interface ICampaignFilters {
  status?: string;
  associationId?: string;
  isLottery?: boolean;
  startDate?: Date;
  endDate?: Date;
  currency?: string;
}

/**
 * Interface for pagination options
 */
interface IPaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Custom hook for managing campaign operations with enhanced features
 */
export const useCampaigns = (options?: {
  autoLoad?: boolean;
  filters?: ICampaignFilters;
  pagination?: IPaginationOptions;
  cacheTimeout?: number;
}) => {
  // Default options
  const defaultOptions = {
    autoLoad: true,
    filters: {},
    pagination: { page: 1, limit: 10 },
    cacheTimeout: CACHE_DURATION.CAMPAIGN_LIST
  };

  const mergedOptions = { ...defaultOptions, ...options };

  // State management
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<ICampaignError | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());
  const [retryCount, setRetryCount] = useState<number>(0);

  // Redux hooks
  const dispatch = useDispatch();
  const campaigns = useSelector((state: any) => state.campaigns.items);

  // WebSocket setup for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/campaigns`);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'CAMPAIGN_UPDATE') {
        refreshCampaign(update.campaignId);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Cache invalidation timer
  useEffect(() => {
    const timer = setInterval(() => {
      if (Date.now() - lastUpdated > mergedOptions.cacheTimeout * 1000) {
        setLastUpdated(Date.now());
        if (mergedOptions.autoLoad) {
          fetchCampaignsList();
        }
      }
    }, mergedOptions.cacheTimeout * 1000);

    return () => clearInterval(timer);
  }, [lastUpdated, mergedOptions.cacheTimeout]);

  // Auto-load campaigns on mount if enabled
  useEffect(() => {
    if (mergedOptions.autoLoad) {
      fetchCampaignsList();
    }
  }, [mergedOptions.filters, mergedOptions.pagination]);

  /**
   * Fetch campaigns list with filtering and pagination
   */
  const fetchCampaignsList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await dispatch(fetchCampaigns({
        ...mergedOptions.filters,
        ...mergedOptions.pagination
      }));
      setLastUpdated(Date.now());
    } catch (err: any) {
      setError({
        message: err.message,
        code: err.code
      });
    } finally {
      setLoading(false);
    }
  }, [dispatch, mergedOptions.filters, mergedOptions.pagination]);

  /**
   * Fetch single campaign by ID
   */
  const fetchCampaignById = useCallback(async (id: string): Promise<ICampaign> => {
    try {
      setLoading(true);
      setError(null);
      const response = await dispatch(fetchCampaignById(id));
      return response.payload;
    } catch (err: any) {
      setError({
        message: err.message,
        code: err.code
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Create new campaign with validation
   */
  const createNewCampaign = useCallback(async (data: Omit<ICampaign, 'id'>): Promise<ICampaign> => {
    try {
      setLoading(true);
      setError(null);
      const response = await dispatch(createCampaign(data));
      await fetchCampaignsList();
      return response.payload;
    } catch (err: any) {
      setError({
        message: err.message,
        code: err.code,
        field: err.field
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Update existing campaign
   */
  const updateExistingCampaign = useCallback(async (
    id: string,
    data: Partial<ICampaign>
  ): Promise<ICampaign> => {
    try {
      setLoading(true);
      setError(null);
      const response = await dispatch(updateCampaign({ id, updateData: data }));
      await fetchCampaignsList();
      return response.payload;
    } catch (err: any) {
      setError({
        message: err.message,
        code: err.code,
        field: err.field
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Delete campaign with confirmation
   */
  const removeCampaign = useCallback(async (id: string): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await dispatch(deleteCampaign(id));
      await fetchCampaignsList();
    } catch (err: any) {
      setError({
        message: err.message,
        code: err.code
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Get campaign progress metrics
   */
  const getCampaignProgress = useCallback(async (id: string): Promise<ICampaignProgress> => {
    try {
      const response = await dispatch(fetchCampaignProgress(id));
      return response.payload.progress;
    } catch (err: any) {
      setError({
        message: err.message,
        code: err.code
      });
      throw err;
    }
  }, [dispatch]);

  /**
   * Fetch active lottery campaigns
   */
  const getLotteryCampaigns = useCallback(async (): Promise<ICampaign[]> => {
    try {
      setLoading(true);
      setError(null);
      const response = await dispatch(fetchLotteryCampaigns());
      return response.payload;
    } catch (err: any) {
      setError({
        message: err.message,
        code: err.code
      });
      throw err;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Refresh single campaign data
   */
  const refreshCampaign = useCallback(async (id: string): Promise<void> => {
    try {
      await fetchCampaignById(id);
      setLastUpdated(Date.now());
    } catch (err: any) {
      // Silent refresh errors
      console.error('Campaign refresh failed:', err);
    }
  }, [fetchCampaignById]);

  /**
   * Clear campaign cache and fetch fresh data
   */
  const clearCache = useCallback((): void => {
    setLastUpdated(0);
    fetchCampaignsList();
  }, []);

  /**
   * Retry failed operation with exponential backoff
   */
  const retryFailedOperation = useCallback(async (): Promise<void> => {
    if (retryCount >= 3 || !error) return;

    const backoffDelay = Math.pow(2, retryCount) * 1000;
    setRetryCount(prev => prev + 1);

    setTimeout(() => {
      fetchCampaignsList();
    }, backoffDelay);
  }, [error, retryCount]);

  return {
    campaigns,
    loading,
    error,
    fetchCampaigns: fetchCampaignsList,
    fetchCampaignById,
    createCampaign: createNewCampaign,
    updateCampaign: updateExistingCampaign,
    deleteCampaign: removeCampaign,
    getCampaignProgress,
    getLotteryCampaigns,
    refreshCampaign,
    clearCache,
    retryFailedOperation
  };
};