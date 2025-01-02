import { useState, useEffect, useCallback, useMemo } from 'react'; // v18.2.0
import { useErrorBoundary } from 'react-error-boundary'; // v4.0.11
import { useDispatch, useSelector } from 'react-redux'; // v8.0.5
import { 
  IAssociation, 
  IAssociationStatus, 
  IAssociationFilters 
} from '../interfaces/association.interface';

interface UseAssociationsParams {
  page?: number;
  limit?: number;
  status?: IAssociationStatus;
  category?: string;
  language?: string;
  secure?: boolean;
}

interface PaginationState {
  page: number;
  limit: number;
  totalPages: number;
}

interface AssociationState {
  associations: IAssociation[];
  currentAssociation: IAssociation | null;
  totalAssociations: number;
  isLoading: boolean;
  error: Error | null;
  pagination: PaginationState;
  filters: IAssociationFilters;
}

const DEFAULT_PAGE_SIZE = 10;
const SUPPORTED_LANGUAGES = ['he', 'en', 'fr'];

export const useAssociations = (params?: UseAssociationsParams) => {
  // State initialization
  const [state, setState] = useState<AssociationState>({
    associations: [],
    currentAssociation: null,
    totalAssociations: 0,
    isLoading: false,
    error: null,
    pagination: {
      page: params?.page || 1,
      limit: params?.limit || DEFAULT_PAGE_SIZE,
      totalPages: 0
    },
    filters: {
      status: params?.status,
      category: params?.category,
      language: params?.language || 'en'
    }
  });

  const dispatch = useDispatch();
  const { showBoundary } = useErrorBoundary();

  // Memoized selectors
  const associationsSelector = useSelector((state: any) => state.associations);
  const userLanguageSelector = useSelector((state: any) => state.user.language);

  // Secure data handling utility
  const secureDataTransform = useCallback((data: IAssociation) => {
    if (!params?.secure) return data;
    
    const { paymentGateways, legalInfo, ...safeData } = data;
    return safeData;
  }, [params?.secure]);

  // Multi-language content handler
  const getLocalizedContent = useCallback((content: { [key: string]: string }) => {
    const language = params?.language || userLanguageSelector;
    return content[language] || content['en'] || Object.values(content)[0];
  }, [params?.language, userLanguageSelector]);

  // Fetch associations with pagination and filters
  const fetchAssociations = useCallback(async (fetchParams?: Partial<UseAssociationsParams>) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await dispatch({
        type: 'associations/fetch',
        payload: {
          ...state.filters,
          ...fetchParams,
          page: fetchParams?.page || state.pagination.page,
          limit: fetchParams?.limit || state.pagination.limit
        }
      });

      const securedAssociations = response.data.map(secureDataTransform);
      
      setState(prev => ({
        ...prev,
        associations: securedAssociations,
        totalAssociations: response.total,
        pagination: {
          ...prev.pagination,
          totalPages: Math.ceil(response.total / state.pagination.limit)
        },
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      showBoundary(error);
    }
  }, [dispatch, state.filters, state.pagination, secureDataTransform, showBoundary]);

  // Get single association details
  const getAssociationDetails = useCallback(async (id: string) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      const response = await dispatch({
        type: 'associations/getById',
        payload: { id }
      });

      setState(prev => ({
        ...prev,
        currentAssociation: secureDataTransform(response.data),
        isLoading: false
      }));
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      showBoundary(error);
    }
  }, [dispatch, secureDataTransform, showBoundary]);

  // Create new association
  const createAssociation = useCallback(async (data: Partial<IAssociation>) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await dispatch({
        type: 'associations/create',
        payload: data
      });

      await fetchAssociations();
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      showBoundary(error);
    }
  }, [dispatch, fetchAssociations, showBoundary]);

  // Update association
  const updateAssociation = useCallback(async (id: string, data: Partial<IAssociation>) => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      await dispatch({
        type: 'associations/update',
        payload: { id, data }
      });

      await fetchAssociations();
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, isLoading: false }));
      showBoundary(error);
    }
  }, [dispatch, fetchAssociations, showBoundary]);

  // Filter management
  const setFilters = useCallback((newFilters: Partial<IAssociationFilters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...newFilters },
      pagination: { ...prev.pagination, page: 1 }
    }));
  }, []);

  // Reset state
  const resetState = useCallback(() => {
    setState(prev => ({
      ...prev,
      associations: [],
      currentAssociation: null,
      error: null,
      pagination: {
        page: 1,
        limit: DEFAULT_PAGE_SIZE,
        totalPages: 0
      },
      filters: {}
    }));
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchAssociations();
    
    return () => {
      resetState();
    };
  }, [fetchAssociations, resetState]);

  // Memoized return value
  return useMemo(() => ({
    ...state,
    fetchAssociations,
    getAssociationDetails,
    createAssociation,
    updateAssociation,
    setFilters,
    resetState,
    getLocalizedContent
  }), [
    state,
    fetchAssociations,
    getAssociationDetails,
    createAssociation,
    updateAssociation,
    setFilters,
    resetState,
    getLocalizedContent
  ]);
};