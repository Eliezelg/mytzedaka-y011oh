import { createReducer, PayloadAction } from '@reduxjs/toolkit';
import { 
  IAssociation, 
  IAssociationStatus, 
} from '../../interfaces/association.interface';

/**
 * Interface defining the shape of association state slice with comprehensive error and loading states
 */
export interface AssociationState {
  associations: IAssociation[];
  currentAssociation: IAssociation | null;
  total: number;
  loading: {
    list: boolean;
    current: boolean;
    update: boolean;
  };
  error: {
    list: string | null;
    current: string | null;
    update: string | null;
  };
  filters: {
    status: IAssociationStatus[];
    language: string;
    search: string;
  };
  pagination: {
    page: number;
    limit: number;
  };
}

/**
 * Initial state for association management with proper typing and default values
 */
const initialState: AssociationState = {
  associations: [],
  currentAssociation: null,
  total: 0,
  loading: {
    list: false,
    current: false,
    update: false,
  },
  error: {
    list: null,
    current: null,
    update: null,
  },
  filters: {
    status: [],
    language: 'en',
    search: '',
  },
  pagination: {
    page: 1,
    limit: 10,
  },
};

/**
 * Type-safe reducer for managing association state with comprehensive error handling
 * and loading states
 */
const associationReducer = createReducer(initialState, (builder) => {
  builder
    // Set associations list with pagination
    .addCase(
      'association/setAssociations',
      (state, action: PayloadAction<{ data: IAssociation[]; total: number; page: number }>) => {
        state.associations = action.payload.data;
        state.total = action.payload.total;
        state.pagination.page = action.payload.page;
        state.error.list = null;
      }
    )

    // Set current association with validation
    .addCase(
      'association/setCurrentAssociation',
      (state, action: PayloadAction<IAssociation | null>) => {
        state.currentAssociation = action.payload;
        state.error.current = null;
      }
    )

    // Update granular loading states
    .addCase(
      'association/setLoading',
      (state, action: PayloadAction<{ type: 'list' | 'current' | 'update'; status: boolean }>) => {
        state.loading[action.payload.type] = action.payload.status;
      }
    )

    // Update granular error states
    .addCase(
      'association/setError',
      (state, action: PayloadAction<{ type: 'list' | 'current' | 'update'; error: string | null }>) => {
        state.error[action.payload.type] = action.payload.error;
      }
    )

    // Update filters with pagination reset
    .addCase(
      'association/setFilters',
      (state, action: PayloadAction<{
        status?: IAssociationStatus[];
        language?: string;
        search?: string;
      }>) => {
        state.filters = {
          ...state.filters,
          ...action.payload,
        };
        // Reset to first page when filters change
        state.pagination.page = 1;
      }
    )

    // Update pagination settings
    .addCase(
      'association/setPagination',
      (state, action: PayloadAction<{ page?: number; limit?: number }>) => {
        state.pagination = {
          ...state.pagination,
          ...action.payload,
        };
      }
    )

    // Clear all association state
    .addCase('association/clearState', (state) => {
      Object.assign(state, initialState);
    })

    // Handle association verification status update
    .addCase(
      'association/updateStatus',
      (state, action: PayloadAction<{ id: string; status: IAssociationStatus }>) => {
        const association = state.associations.find(a => a.id === action.payload.id);
        if (association) {
          association.status = action.payload.status;
        }
        if (state.currentAssociation?.id === action.payload.id) {
          state.currentAssociation.status = action.payload.status;
        }
      }
    )

    // Handle bulk status updates
    .addCase(
      'association/bulkUpdateStatus',
      (state, action: PayloadAction<{ ids: string[]; status: IAssociationStatus }>) => {
        state.associations = state.associations.map(association => {
          if (action.payload.ids.includes(association.id)) {
            return { ...association, status: action.payload.status };
          }
          return association;
        });
        
        if (state.currentAssociation && action.payload.ids.includes(state.currentAssociation.id)) {
          state.currentAssociation.status = action.payload.status;
        }
      }
    );
});

export default associationReducer;