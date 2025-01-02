/**
 * Payment Action Creators
 * Implements Redux actions for payment processing with dual payment gateway support
 * @version 1.0.0
 */

import { createAsyncThunk } from '@reduxjs/toolkit'; // v1.9.5
import { retry } from 'axios-retry'; // v3.8.0
import {
    PaymentMethod,
    PaymentRequest,
    PaymentResponse,
    PaymentStatus
} from '../../interfaces/payment.interface';
import { PaymentService } from '../../services/payment.service';

// Initialize payment service
const paymentService = new PaymentService();

// Action type constants
const ACTION_PREFIX = 'payment';

/**
 * Validates currency code before payment processing
 */
export const validateCurrency = createAsyncThunk(
    `${ACTION_PREFIX}/validateCurrency`,
    async (currency: string, { rejectWithValue }) => {
        try {
            const isValid = await paymentService.validateCurrency(currency);
            if (!isValid) {
                return rejectWithValue('Currency not supported or invalid');
            }
            return true;
        } catch (error: any) {
            return rejectWithValue(`Currency validation failed: ${error.message}`);
        }
    }
);

/**
 * Adds a new payment method with validation
 */
export const addPaymentMethod = createAsyncThunk(
    `${ACTION_PREFIX}/addPaymentMethod`,
    async (paymentMethodData: Partial<PaymentMethod>, { rejectWithValue }) => {
        try {
            const paymentMethod = await paymentService.addPaymentMethod(paymentMethodData);
            return paymentMethod;
        } catch (error: any) {
            return rejectWithValue(`Failed to add payment method: ${error.message}`);
        }
    }
);

/**
 * Lists all payment methods for the current user
 */
export const listPaymentMethods = createAsyncThunk(
    `${ACTION_PREFIX}/listPaymentMethods`,
    async (_, { rejectWithValue }) => {
        try {
            const paymentMethods = await paymentService.listPaymentMethods();
            return paymentMethods;
        } catch (error: any) {
            return rejectWithValue(`Failed to retrieve payment methods: ${error.message}`);
        }
    }
);

/**
 * Removes a payment method
 */
export const removePaymentMethod = createAsyncThunk(
    `${ACTION_PREFIX}/removePaymentMethod`,
    async (paymentMethodId: string, { rejectWithValue }) => {
        try {
            await paymentService.removePaymentMethod(paymentMethodId);
            return paymentMethodId;
        } catch (error: any) {
            return rejectWithValue(`Failed to remove payment method: ${error.message}`);
        }
    }
);

/**
 * Initiates a payment transaction with retry mechanism
 */
export const initiatePayment = createAsyncThunk(
    `${ACTION_PREFIX}/initiatePayment`,
    async (paymentData: PaymentRequest, { rejectWithValue }) => {
        try {
            // Validate currency before proceeding
            const isValidCurrency = await paymentService.validateCurrency(paymentData.currency);
            if (!isValidCurrency) {
                return rejectWithValue('Invalid currency for payment');
            }

            const response = await retry(
                async () => await paymentService.initiatePayment(paymentData),
                {
                    retries: 3,
                    retryDelay: (retryCount) => retryCount * 1000,
                    retryCondition: (error) => {
                        const status = error.response?.status;
                        return status === 429 || status >= 500;
                    }
                }
            );

            if (response.status === PaymentStatus.FAILED) {
                return rejectWithValue({
                    message: 'Payment processing failed',
                    errorCode: response.errorCode
                });
            }

            return response;
        } catch (error: any) {
            return rejectWithValue(`Payment processing error: ${error.message}`);
        }
    }
);

/**
 * Initiates a recurring payment subscription
 */
export const initiateRecurringPayment = createAsyncThunk(
    `${ACTION_PREFIX}/initiateRecurringPayment`,
    async (recurringPaymentData: PaymentRequest, { rejectWithValue }) => {
        try {
            if (!recurringPaymentData.isRecurring) {
                return rejectWithValue('Payment request must be marked as recurring');
            }

            // Validate currency for recurring payments
            const isValidCurrency = await paymentService.validateCurrency(recurringPaymentData.currency);
            if (!isValidCurrency) {
                return rejectWithValue('Invalid currency for recurring payment');
            }

            const response = await paymentService.initiateRecurringPayment(recurringPaymentData);
            
            if (response.status === PaymentStatus.FAILED) {
                return rejectWithValue({
                    message: 'Recurring payment setup failed',
                    errorCode: response.errorCode
                });
            }

            return response;
        } catch (error: any) {
            return rejectWithValue(`Recurring payment setup error: ${error.message}`);
        }
    }
);