/**
 * StripeElements Component
 * PCI-compliant credit card input interface with multi-currency support
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  CardElement,
  Elements,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'; // v2.1.1
import { loadStripe, StripeCardElementChangeEvent } from '@stripe/stripe-js'; // v1.54.1
import {
  Box,
  Button,
  CircularProgress,
  Alert,
  TextField,
  Typography
} from '@mui/material'; // v5.14.0
import { PaymentMethod, PaymentMethodType } from '../../interfaces/payment.interface';
import { PaymentService } from '../../services/payment.service';

// Initialize Stripe with public key
const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY!);

// Card element styling for consistent UI
const cardElementStyle = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      fontFamily: 'Roboto, sans-serif',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
      iconColor: '#9e2146',
    },
  },
};

interface StripeElementsProps {
  onSuccess?: (paymentMethod: PaymentMethod) => void;
  onError?: (error: string) => void;
  defaultCurrency?: string;
  className?: string;
}

/**
 * Secure credit card input component with PCI compliance
 */
export const StripeElements: React.FC<StripeElementsProps> = ({
  onSuccess,
  onError,
  defaultCurrency = 'USD',
  className
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const paymentService = new PaymentService();

  // Component state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isCardComplete, setIsCardComplete] = useState<boolean>(false);
  const [currency, setCurrency] = useState<string>(defaultCurrency);
  const [isRetrying, setIsRetrying] = useState<boolean>(false);

  // Supported currencies based on payment service
  const supportedCurrencies = ['USD', 'EUR', 'ILS', 'GBP'];

  /**
   * Validates currency on component mount and currency change
   */
  useEffect(() => {
    const validateCurrencySupport = async () => {
      try {
        const isValid = await paymentService.validateCurrency(currency);
        if (!isValid) {
          setError(`Currency ${currency} is not supported`);
        }
      } catch (err) {
        console.error('Currency validation error:', err);
        setError('Failed to validate currency');
      }
    };

    validateCurrencySupport();
  }, [currency]);

  /**
   * Handles changes in card element state
   */
  const handleCardChange = useCallback((event: StripeCardElementChangeEvent) => {
    setError('');
    setIsCardComplete(event.complete);

    if (event.error) {
      setError(event.error.message);
    }

    // Validate card brand support
    if (event.brand && !['visa', 'mastercard', 'amex'].includes(event.brand)) {
      setError('This card brand is not supported');
      setIsCardComplete(false);
    }
  }, []);

  /**
   * Handles secure form submission with retry mechanism
   */
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system is not initialized');
      return;
    }

    if (!isCardComplete) {
      setError('Please complete card details');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create payment method with Stripe
      const { error: stripeError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: elements.getElement(CardElement)!,
        billing_details: {
          currency: currency.toLowerCase(),
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (!paymentMethod) {
        throw new Error('Failed to create payment method');
      }

      // Save payment method using service
      const savedPaymentMethod: PaymentMethod = await paymentService.addPaymentMethod({
        id: paymentMethod.id,
        type: PaymentMethodType.CREDIT_CARD,
        currency: currency,
        lastFourDigits: paymentMethod.card?.last4 || '',
        cardBrand: paymentMethod.card?.brand || '',
        expiryMonth: paymentMethod.card?.exp_month || 0,
        expiryYear: paymentMethod.card?.exp_year || 0,
      });

      // Clear sensitive data
      elements.getElement(CardElement)?.clear();
      setIsCardComplete(false);

      // Trigger success callback
      onSuccess?.(savedPaymentMethod);

    } catch (error: any) {
      console.error('Payment method creation error:', error);

      // Implement retry logic for network errors
      if (!isRetrying && error.message?.includes('network')) {
        setIsRetrying(true);
        setTimeout(() => handleSubmit(event), 2000);
        return;
      }

      setError(error.message || 'Failed to process payment method');
      onError?.(error.message);
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  };

  return (
    <Box className={className} component="form" onSubmit={handleSubmit}>
      <Box mb={2}>
        <TextField
          select
          fullWidth
          label="Currency"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
          SelectProps={{
            native: true,
          }}
        >
          {supportedCurrencies.map((curr) => (
            <option key={curr} value={curr}>
              {curr}
            </option>
          ))}
        </TextField>
      </Box>

      <Box
        sx={{
          border: '1px solid #e0e0e0',
          borderRadius: 1,
          padding: 2,
          backgroundColor: '#fff',
        }}
      >
        <CardElement
          options={cardElementStyle}
          onChange={handleCardChange}
          aria-label="Credit card input"
        />
      </Box>

      {error && (
        <Box mt={2}>
          <Alert severity="error" aria-live="polite">
            {error}
          </Alert>
        </Box>
      )}

      <Box mt={2}>
        <Button
          type="submit"
          variant="contained"
          color="primary"
          fullWidth
          disabled={!isCardComplete || isLoading}
          aria-label="Add payment method"
        >
          {isLoading ? (
            <CircularProgress size={24} color="inherit" />
          ) : (
            'Add Payment Method'
          )}
        </Button>
      </Box>

      {isRetrying && (
        <Typography variant="caption" color="text.secondary" mt={1}>
          Retrying payment method creation...
        </Typography>
      )}
    </Box>
  );
};

/**
 * Wrapper component to provide Stripe context
 */
export const StripeElementsProvider: React.FC<StripeElementsProps> = (props) => {
  return (
    <Elements stripe={stripePromise}>
      <StripeElements {...props} />
    </Elements>
  );
};

export default StripeElementsProvider;