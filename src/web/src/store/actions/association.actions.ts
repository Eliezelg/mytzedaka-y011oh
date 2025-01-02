import { createAction, createAsyncThunk } from '@reduxjs/toolkit';
import { ThunkAction } from 'redux-thunk';
import { IAssociation, IAssociationStatus, IPaymentGatewayError } from '../../interfaces/association.interface';
import { AssociationService } from '../../services/association.service';

// Initialize AssociationService instance
const associationService = new AssociationService();

// Action Types
export const FETCH_ASSOCIATIONS = 'association/fetchAssociations';
export const SET_ASSOCIATIONS = 'association/setAssociations';
export const SET_CURRENT_ASSOCIATION = 'association/setCurrentAssociation';
export const SET_ASSOCIATION_LOADING = 'association/setLoading';
export const SET_ASSOCIATION_ERROR = 'association/setError';
export const CLEANUP_ASSOCIATION_STATE = 'association/cleanup';

// Action Creators
export const setAssociations = createAction<{
  data: IAssociation[];
  total: number;
  cached: boolean;
}>(SET_ASSOCIATIONS);

export const setCurrentAssociation = createAction<{
  association: IAssociation;
  source: 'api' | 'cache' | 'offline';
}>(SET_CURRENT_ASSOCIATION);

export const setAssociationLoading = createAction<{
  loading: boolean;
  operation: string;
}>(SET_ASSOCIATION_LOADING);

export const setAssociationError = createAction<{
  error: string | null;
  context: string;
  paymentError?: IPaymentGatewayError;
}>(SET_ASSOCIATION_ERROR);

export const cleanupAssociationState = createAction(CLEANUP_ASSOCIATION_STATE);

// Async Thunk Actions
export const fetchAssociationsThunk = createAsyncThunk(
  FETCH_ASSOCIATIONS,
  async (params: {
    page?: number;
    limit?: number;
    status?: IAssociationStatus;
    category?: string;
    forceRefresh?: boolean;
  }, { dispatch }) => {
    try {
      dispatch(setAssociationLoading({ loading: true, operation: 'fetch_associations' }));
      dispatch(setAssociationError({ error: null, context: 'fetch' }));

      const response = await associationService.fetchAssociations(params).toPromise();
      
      dispatch(setAssociations({
        data: response.data,
        total: response.total,
        cached: !params.forceRefresh
      }));

      return response;
    } catch (error: any) {
      dispatch(setAssociationError({
        error: error.message,
        context: 'fetch',
        paymentError: error.paymentError
      }));
      throw error;
    } finally {
      dispatch(setAssociationLoading({ loading: false, operation: 'fetch_associations' }));
    }
  }
);

export const fetchAssociationDetailsThunk = createAsyncThunk(
  'association/fetchDetails',
  async (id: string, { dispatch }) => {
    try {
      dispatch(setAssociationLoading({ loading: true, operation: 'fetch_details' }));
      dispatch(setAssociationError({ error: null, context: 'details' }));

      const association = await associationService.getAssociationDetails(id).toPromise();
      
      dispatch(setCurrentAssociation({
        association,
        source: 'api'
      }));

      return association;
    } catch (error: any) {
      dispatch(setAssociationError({
        error: error.message,
        context: 'details'
      }));
      throw error;
    } finally {
      dispatch(setAssociationLoading({ loading: false, operation: 'fetch_details' }));
    }
  }
);

export const createAssociationThunk = createAsyncThunk(
  'association/create',
  async (data: Omit<IAssociation, 'id' | 'createdAt' | 'updatedAt'>, { dispatch }) => {
    try {
      dispatch(setAssociationLoading({ loading: true, operation: 'create' }));
      dispatch(setAssociationError({ error: null, context: 'create' }));

      const association = await associationService.createNewAssociation(data).toPromise();
      
      return association;
    } catch (error: any) {
      dispatch(setAssociationError({
        error: error.message,
        context: 'create'
      }));
      throw error;
    } finally {
      dispatch(setAssociationLoading({ loading: false, operation: 'create' }));
    }
  }
);

export const updateAssociationThunk = createAsyncThunk(
  'association/update',
  async ({ id, data }: { id: string; data: Partial<IAssociation> }, { dispatch }) => {
    try {
      dispatch(setAssociationLoading({ loading: true, operation: 'update' }));
      dispatch(setAssociationError({ error: null, context: 'update' }));

      const association = await associationService.updateAssociationDetails(id, data).toPromise();
      
      dispatch(setCurrentAssociation({
        association,
        source: 'api'
      }));

      return association;
    } catch (error: any) {
      dispatch(setAssociationError({
        error: error.message,
        context: 'update'
      }));
      throw error;
    } finally {
      dispatch(setAssociationLoading({ loading: false, operation: 'update' }));
    }
  }
);

export const updateAssociationStatusThunk = createAsyncThunk(
  'association/updateStatus',
  async (
    { id, status, reason }: { id: string; status: IAssociationStatus; reason: string },
    { dispatch }
  ) => {
    try {
      dispatch(setAssociationLoading({ loading: true, operation: 'update_status' }));
      dispatch(setAssociationError({ error: null, context: 'status' }));

      const association = await associationService.updateStatus(id, status, reason).toPromise();
      
      dispatch(setCurrentAssociation({
        association,
        source: 'api'
      }));

      return association;
    } catch (error: any) {
      dispatch(setAssociationError({
        error: error.message,
        context: 'status'
      }));
      throw error;
    } finally {
      dispatch(setAssociationLoading({ loading: false, operation: 'update_status' }));
    }
  }
);

// Cleanup function to be called on component unmount
export const cleanupAssociations = (): ThunkAction<void, any, unknown, any> => 
  (dispatch) => {
    dispatch(cleanupAssociationState());
    associationService.destroy();
  };