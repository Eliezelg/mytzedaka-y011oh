/**
 * @fileoverview Payment processing API module for dual payment gateway integration
 * Supporting Stripe Connect (international) and Tranzilla (Israeli market)
 * @version 1.0.0
 */

import apiClient from './apiClient';
import {
  PaymentGateway,
  PaymentMethod,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  PaymentMethodType
} from '../interfaces/payment.interface';
import { 
  PAYMENT_CONFIG, 
  SUPPORTED_CURRENCIES, 
  ERROR_MESSAGES,
  API_ENDPOINTS 
} from '../config/constants';

/**
 * Validates payment request data including currency, amount limits, and recurring payment rules
 * @param paymentData Payment request to validate
 * @returns boolean indicating if the payment request is valid
 */
export const validatePaymentRequest = (paymentData: PaymentRequest): boolean => {
  // Validate currency support
  if (!SUPPORTED_CURRENCIES.includes(paymentData.currency)) {
    throw new Error(`Unsupported currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`);
  }

  // Validate amount limits
  if (paymentData.amount < PAYMENT_CONFIG.MIN_DONATION_AMOUNT || 
      paymentData.amount > PAYMENT_CONFIG.MAX_DONATION_AMOUNT) {
    throw new Error(`Amount must be between ${PAYMENT_CONFIG.MIN_DONATION_AMOUNT} and ${PAYMENT_CONFIG.MAX_DONATION_AMOUNT}`);
  }

  // Validate required fields
  if (!paymentData.paymentMethodId || !paymentData.donorId || !paymentData.associationId) {
    throw new Error('Missing required payment information');
  }

  return true;
};

/**
 * Determines appropriate payment gateway based on currency and region
 * @param paymentData Payment request data
 * @returns Selected payment gateway
 */
export const determinePaymentGateway = (paymentData: PaymentRequest): PaymentGateway => {
  // Use Tranzilla for ILS currency transactions
  if (paymentData.currency === 'ILS') {
    return PaymentGateway.TRANZILLA;
  }
  // Use Stripe for all other currencies
  return PaymentGateway.STRIPE;
};

/**
 * Process payment through selected gateway with enhanced error handling
 * @param paymentData Payment request data
 * @returns Promise resolving to payment processing result
 */
export const processPayment = async (paymentData: PaymentRequest): Promise<PaymentResponse> => {
  try {
    // Validate payment request
    validatePaymentRequest(paymentData);

    // Determine appropriate gateway
    const gateway = determinePaymentGateway(paymentData);

    // Prepare payment endpoint based on gateway
    const endpoint = gateway === PaymentGateway.STRIPE
      ? `${API_ENDPOINTS.DONATIONS.CREATE}/stripe`
      : `${API_ENDPOINTS.DONATIONS.CREATE}/tranzilla`;

    // Process payment through selected gateway
    const response = await apiClient.post<PaymentResponse>(endpoint, {
      ...paymentData,
      gateway
    });

    // Handle successful payment
    if (response.data.status === PaymentStatus.COMPLETED) {
      // If recurring payment, set up subscription
      if (paymentData.isRecurring) {
        await setupRecurringPayment(response.data.transactionId, paymentData);
      }
      return response.data;
    }

    // Handle pending status
    if (response.data.status === PaymentStatus.PENDING) {
      // Initiate status polling
      return await getPaymentStatus(response.data.transactionId);
    }

    throw new Error(response.data.errorMessage || ERROR_MESSAGES.PAYMENT_ERROR);

  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Payment processing failed: ${error.message}`);
    }
    throw new Error(ERROR_MESSAGES.PAYMENT_ERROR);
  }
};

/**
 * Set up recurring payment subscription
 * @param transactionId Initial transaction ID
 * @param paymentData Original payment request data
 */
const setupRecurringPayment = async (
  transactionId: string,
  paymentData: PaymentRequest
): Promise<void> => {
  try {
    await apiClient.post(`${API_ENDPOINTS.DONATIONS.CREATE}/recurring`, {
      transactionId,
      ...paymentData
    });
  } catch (error) {
    console.error('Failed to setup recurring payment:', error);
    throw new Error('Failed to setup recurring payment');
  }
};

/**
 * Track payment status with polling mechanism
 * @param transactionId Transaction ID to track
 * @param timeout Optional timeout in milliseconds (default: 30000)
 * @returns Promise resolving to final payment status
 */
export const getPaymentStatus = async (
  transactionId: string,
  timeout: number = 30000
): Promise<PaymentResponse> => {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < timeout) {
    try {
      const response = await apiClient.get<PaymentResponse>(
        `${API_ENDPOINTS.DONATIONS.DETAIL.replace(':id', transactionId)}/status`
      );

      // Return if final status reached
      if ([PaymentStatus.COMPLETED, PaymentStatus.FAILED, PaymentStatus.REFUNDED]
          .includes(response.data.status)) {
        return response.data;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      throw new Error(`Failed to get payment status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  throw new Error('Payment status check timed out');
};