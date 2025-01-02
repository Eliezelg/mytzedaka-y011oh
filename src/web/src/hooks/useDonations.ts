import { useDispatch, useSelector } from 'react-redux'; // ^8.1.2
import { useState, useCallback, useEffect } from 'react'; // ^18.2.0
import { IDonation, IDonationForm } from '../interfaces/donation.interface';
import { 
  createDonation, 
  getUserDonations, 
  getAssociationDonations, 
  retryDonation,
  clearDonationError
} from '../store/actions/donation.actions';

/**
 * Custom hook for managing donation operations with enhanced error handling,
 * retry mechanisms, and real-time campaign progress tracking
 */
export const useDonations = () => {
  const dispatch = useDispatch();

  // Local state for loading, error handling, and progress tracking
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    current: number;
    total: number;
    percentage: number;
  }>({
    current: 0,
    total: 0,
    percentage: 0
  });

  // Redux state selectors
  const donations = useSelector((state: any) => state.donations.items);
  const donationStatus = useSelector((state: any) => state.donations.status);
  const donationError = useSelector((state: any) => state.donations.error);

  /**
   * Creates a new donation with comprehensive error handling and retry mechanism
   * @param donationData Validated donation form data
   */
  const handleCreateDonation = useCallback(async (donationData: IDonationForm) => {
    try {
      setLoading(true);
      setError(null);

      const result = await dispatch(createDonation(donationData)).unwrap();

      // Update progress if donation is part of a campaign
      if (result.campaignId) {
        setProgress(prev => ({
          ...prev,
          current: prev.current + result.amount,
          percentage: ((prev.current + result.amount) / prev.total) * 100
        }));
      }

      return result;
    } catch (error: any) {
      setError(error.message || 'Failed to process donation');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Retries a failed donation with exponential backoff
   * @param donationId ID of the failed donation
   * @param updatedPaymentData Optional updated payment information
   */
  const handleRetryDonation = useCallback(async (
    donationId: string,
    updatedPaymentData?: Partial<IDonationForm>
  ) => {
    try {
      setLoading(true);
      setError(null);

      const result = await dispatch(retryDonation({
        donationId,
        updatedPaymentData: updatedPaymentData || {}
      })).unwrap();

      return result;
    } catch (error: any) {
      setError(error.message || 'Failed to retry donation');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Fetches donations for a specific user with pagination
   * @param userId User identifier
   * @param page Page number
   * @param limit Items per page
   */
  const fetchUserDonations = useCallback(async (
    userId: string,
    page = 1,
    limit = 10
  ) => {
    try {
      setLoading(true);
      setError(null);

      const result = await dispatch(getUserDonations({
        userId,
        page,
        limit
      })).unwrap();

      return result;
    } catch (error: any) {
      setError(error.message || 'Failed to fetch user donations');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Fetches donations for a specific association with pagination
   * @param associationId Association identifier
   * @param page Page number
   * @param limit Items per page
   */
  const fetchAssociationDonations = useCallback(async (
    associationId: string,
    page = 1,
    limit = 10
  ) => {
    try {
      setLoading(true);
      setError(null);

      const result = await dispatch(getAssociationDonations({
        associationId,
        page,
        limit
      })).unwrap();

      return result;
    } catch (error: any) {
      setError(error.message || 'Failed to fetch association donations');
      throw error;
    } finally {
      setLoading(false);
    }
  }, [dispatch]);

  /**
   * Clears any donation-related errors
   */
  const clearError = useCallback(() => {
    setError(null);
    dispatch(clearDonationError());
  }, [dispatch]);

  // Effect for handling WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(process.env.REACT_APP_WS_URL || '');

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'CAMPAIGN_PROGRESS_UPDATE') {
        setProgress({
          current: data.current,
          total: data.total,
          percentage: (data.current / data.total) * 100
        });
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Effect for syncing Redux error state with local error state
  useEffect(() => {
    if (donationError) {
      setError(donationError);
    }
  }, [donationError]);

  return {
    // State
    donations,
    loading,
    error,
    progress,
    status: donationStatus,

    // Actions
    createDonation: handleCreateDonation,
    retryDonation: handleRetryDonation,
    fetchUserDonations,
    fetchAssociationDonations,
    clearError
  };
};