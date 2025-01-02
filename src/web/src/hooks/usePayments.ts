import { useDispatch, useSelector } from 'react-redux';
import { useCallback } from 'react';
import { debounce } from 'lodash'; // v4.17.21
import {
  PaymentMethod,
  PaymentRequest,
  PaymentStatus,
  PaymentGateway,
  PaymentError
} from '../interfaces/payment.interface';

/**
 * Custom hook for managing payment operations with dual payment gateway integration
 * Supports Stripe Connect (international) and Tranzilla (Israeli market)
 */
export const usePayments = () => {
  const dispatch = useDispatch();

  // Redux state selectors
  const paymentMethods = useSelector((state: any) => state.payments.paymentMethods);
  const loading = useSelector((state: any) => state.payments.loading);
  const error = useSelector((state: any) => state.payments.error);
  const processingPayment = useSelector((state: any) => state.payments.processingPayment);
  const currentTransaction = useSelector((state: any) => state.payments.currentTransaction);

  /**
   * Validates currency support for specific payment gateway
   * Debounced to prevent excessive API calls
   */
  const validateCurrency = useCallback(
    debounce(async (currency: string, gateway: PaymentGateway): Promise<boolean> => {
      try {
        // Currency validation rules
        const stripeSupported = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
        const tranzillaSupported = ['ILS', 'USD'];

        if (gateway === PaymentGateway.STRIPE) {
          return stripeSupported.includes(currency.toUpperCase());
        } else if (gateway === PaymentGateway.TRANZILLA) {
          return tranzillaSupported.includes(currency.toUpperCase());
        }
        return false;
      } catch (error) {
        dispatch({ type: 'SET_PAYMENT_ERROR', payload: error });
        return false;
      }
    }, 300),
    [dispatch]
  );

  /**
   * Fetches saved payment methods for the current user
   */
  const fetchPaymentMethods = useCallback(async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await fetch('/api/payment-methods');
      const methods = await response.json();
      dispatch({ type: 'SET_PAYMENT_METHODS', payload: methods });
    } catch (error) {
      dispatch({
        type: 'SET_PAYMENT_ERROR',
        payload: {
          code: 'FETCH_ERROR',
          message: 'Failed to fetch payment methods'
        }
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  /**
   * Adds a new payment method
   */
  const addPaymentMethod = useCallback(async (data: PaymentMethod): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const response = await fetch('/api/payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await response.json();
      dispatch({ type: 'ADD_PAYMENT_METHOD', payload: result });
    } catch (error) {
      dispatch({
        type: 'SET_PAYMENT_ERROR',
        payload: {
          code: 'ADD_ERROR',
          message: 'Failed to add payment method'
        }
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  /**
   * Removes an existing payment method
   */
  const removePaymentMethod = useCallback(async (id: string): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await fetch(`/api/payment-methods/${id}`, { method: 'DELETE' });
      dispatch({ type: 'REMOVE_PAYMENT_METHOD', payload: id });
    } catch (error) {
      dispatch({
        type: 'SET_PAYMENT_ERROR',
        payload: {
          code: 'REMOVE_ERROR',
          message: 'Failed to remove payment method'
        }
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [dispatch]);

  /**
   * Processes a payment through the appropriate gateway
   * Includes currency validation and transaction tracking
   */
  const processPayment = useCallback(async (data: PaymentRequest): Promise<void> => {
    try {
      // Validate currency support
      const isCurrencyValid = await validateCurrency(data.currency, data.gateway);
      if (!isCurrencyValid) {
        throw {
          code: 'CURRENCY_ERROR',
          message: `Currency ${data.currency} not supported for selected gateway`
        };
      }

      dispatch({ type: 'SET_PROCESSING_PAYMENT', payload: true });
      dispatch({
        type: 'SET_CURRENT_TRANSACTION',
        payload: {
          id: `${Date.now()}`,
          status: PaymentStatus.PROCESSING,
          gateway: data.gateway
        }
      });

      const response = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      const result = await response.json();

      if (!response.ok) {
        throw result;
      }

      dispatch({
        type: 'SET_CURRENT_TRANSACTION',
        payload: {
          ...result,
          status: PaymentStatus.COMPLETED
        }
      });
    } catch (error) {
      dispatch({
        type: 'SET_PAYMENT_ERROR',
        payload: {
          code: error.code || 'PAYMENT_ERROR',
          message: error.message || 'Payment processing failed'
        }
      });
      dispatch({
        type: 'SET_CURRENT_TRANSACTION',
        payload: {
          ...currentTransaction,
          status: PaymentStatus.FAILED
        }
      });
    } finally {
      dispatch({ type: 'SET_PROCESSING_PAYMENT', payload: false });
    }
  }, [dispatch, validateCurrency, currentTransaction]);

  return {
    paymentMethods,
    loading,
    error,
    processingPayment,
    currentTransaction,
    addPaymentMethod,
    fetchPaymentMethods,
    removePaymentMethod,
    processPayment,
    validateCurrency
  };
};