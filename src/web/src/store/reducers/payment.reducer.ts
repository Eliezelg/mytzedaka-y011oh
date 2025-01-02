/**
 * Payment Reducer
 * Manages payment state with dual payment gateway support (Stripe Connect and Tranzilla)
 * @version 1.0.0
 */

import { createSlice } from '@reduxjs/toolkit'; // v1.9.5
import { 
    PaymentMethod, 
    PaymentStatus,
    PaymentGateway
} from '../../interfaces/payment.interface';
import {
    addPaymentMethod,
    listPaymentMethods,
    removePaymentMethod,
    initiatePayment,
    initiateRecurringPayment,
    validateCurrency
} from '../actions/payment.actions';

// Types for enhanced state management
interface GatewayStatus {
    isAvailable: boolean;
    lastChecked: Date | null;
    error: string | null;
}

interface Transaction {
    id: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    gateway: PaymentGateway;
    createdAt: Date;
    isRecurring: boolean;
    errorCode?: string;
    errorMessage?: string;
}

interface PaymentState {
    paymentMethods: PaymentMethod[];
    loading: {
        addingMethod: boolean;
        fetchingMethods: boolean;
        processingPayment: boolean;
        removingMethod: boolean;
        validatingCurrency: boolean;
    };
    error: {
        message: string | null;
        code: string | null;
        validationErrors: Record<string, string>;
        retryAttempts: number;
    };
    currentTransaction: {
        id: string | null;
        status: PaymentStatus | null;
        gateway: PaymentGateway | null;
        amount: number | null;
        currency: string | null;
        isRecurring: boolean;
    };
    transactionHistory: Transaction[];
    gatewayStatus: {
        [PaymentGateway.STRIPE]: GatewayStatus;
        [PaymentGateway.TRANZILLA]: GatewayStatus;
    };
}

// Initial state with comprehensive tracking
const initialState: PaymentState = {
    paymentMethods: [],
    loading: {
        addingMethod: false,
        fetchingMethods: false,
        processingPayment: false,
        removingMethod: false,
        validatingCurrency: false
    },
    error: {
        message: null,
        code: null,
        validationErrors: {},
        retryAttempts: 0
    },
    currentTransaction: {
        id: null,
        status: null,
        gateway: null,
        amount: null,
        currency: null,
        isRecurring: false
    },
    transactionHistory: [],
    gatewayStatus: {
        [PaymentGateway.STRIPE]: {
            isAvailable: true,
            lastChecked: null,
            error: null
        },
        [PaymentGateway.TRANZILLA]: {
            isAvailable: true,
            lastChecked: null,
            error: null
        }
    }
};

// Create the payment slice with enhanced state management
const paymentSlice = createSlice({
    name: 'payment',
    initialState,
    reducers: {
        resetPaymentState: (state) => {
            return initialState;
        },
        setDefaultPaymentMethod: (state, action) => {
            const { paymentMethodId } = action.payload;
            state.paymentMethods = state.paymentMethods.map(method => ({
                ...method,
                isDefault: method.id === paymentMethodId
            }));
        },
        updateGatewayStatus: (state, action) => {
            const { gateway, isAvailable, error } = action.payload;
            state.gatewayStatus[gateway] = {
                isAvailable,
                lastChecked: new Date(),
                error
            };
        },
        clearTransactionHistory: (state) => {
            state.transactionHistory = [];
        }
    },
    extraReducers: (builder) => {
        // Add Payment Method
        builder.addCase(addPaymentMethod.pending, (state) => {
            state.loading.addingMethod = true;
            state.error.message = null;
            state.error.code = null;
        });
        builder.addCase(addPaymentMethod.fulfilled, (state, action) => {
            state.loading.addingMethod = false;
            state.paymentMethods.push(action.payload);
        });
        builder.addCase(addPaymentMethod.rejected, (state, action) => {
            state.loading.addingMethod = false;
            state.error.message = action.payload as string;
            state.error.retryAttempts += 1;
        });

        // List Payment Methods
        builder.addCase(listPaymentMethods.pending, (state) => {
            state.loading.fetchingMethods = true;
            state.error.message = null;
        });
        builder.addCase(listPaymentMethods.fulfilled, (state, action) => {
            state.loading.fetchingMethods = false;
            state.paymentMethods = action.payload;
        });
        builder.addCase(listPaymentMethods.rejected, (state, action) => {
            state.loading.fetchingMethods = false;
            state.error.message = action.payload as string;
        });

        // Remove Payment Method
        builder.addCase(removePaymentMethod.pending, (state) => {
            state.loading.removingMethod = true;
            state.error.message = null;
        });
        builder.addCase(removePaymentMethod.fulfilled, (state, action) => {
            state.loading.removingMethod = false;
            state.paymentMethods = state.paymentMethods.filter(
                method => method.id !== action.payload
            );
        });
        builder.addCase(removePaymentMethod.rejected, (state, action) => {
            state.loading.removingMethod = false;
            state.error.message = action.payload as string;
        });

        // Process Payment
        builder.addCase(initiatePayment.pending, (state) => {
            state.loading.processingPayment = true;
            state.error.message = null;
            state.error.code = null;
            state.currentTransaction = {
                ...state.currentTransaction,
                status: PaymentStatus.PROCESSING
            };
        });
        builder.addCase(initiatePayment.fulfilled, (state, action) => {
            state.loading.processingPayment = false;
            state.currentTransaction = {
                id: action.payload.transactionId,
                status: action.payload.status,
                gateway: action.payload.gateway,
                amount: action.payload.amount,
                currency: action.payload.currency,
                isRecurring: false
            };
            state.transactionHistory.unshift({
                ...action.payload,
                createdAt: new Date(),
                isRecurring: false
            });
        });
        builder.addCase(initiatePayment.rejected, (state, action: any) => {
            state.loading.processingPayment = false;
            state.error.message = action.payload.message;
            state.error.code = action.payload.errorCode;
            state.currentTransaction.status = PaymentStatus.FAILED;
        });

        // Recurring Payment
        builder.addCase(initiateRecurringPayment.pending, (state) => {
            state.loading.processingPayment = true;
            state.error.message = null;
            state.currentTransaction.isRecurring = true;
        });
        builder.addCase(initiateRecurringPayment.fulfilled, (state, action) => {
            state.loading.processingPayment = false;
            state.currentTransaction = {
                id: action.payload.transactionId,
                status: action.payload.status,
                gateway: action.payload.gateway,
                amount: action.payload.amount,
                currency: action.payload.currency,
                isRecurring: true
            };
            state.transactionHistory.unshift({
                ...action.payload,
                createdAt: new Date(),
                isRecurring: true
            });
        });
        builder.addCase(initiateRecurringPayment.rejected, (state, action: any) => {
            state.loading.processingPayment = false;
            state.error.message = action.payload.message;
            state.error.code = action.payload.errorCode;
            state.currentTransaction.status = PaymentStatus.FAILED;
        });

        // Currency Validation
        builder.addCase(validateCurrency.pending, (state) => {
            state.loading.validatingCurrency = true;
            state.error.validationErrors = {};
        });
        builder.addCase(validateCurrency.fulfilled, (state) => {
            state.loading.validatingCurrency = false;
        });
        builder.addCase(validateCurrency.rejected, (state, action) => {
            state.loading.validatingCurrency = false;
            state.error.validationErrors = {
                currency: action.payload as string
            };
        });
    }
});

// Export actions and reducer
export const {
    resetPaymentState,
    setDefaultPaymentMethod,
    updateGatewayStatus,
    clearTransactionHistory
} = paymentSlice.actions;

export default paymentSlice.reducer;