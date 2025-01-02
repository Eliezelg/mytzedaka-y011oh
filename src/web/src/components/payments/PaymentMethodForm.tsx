import React, { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import {
  TextField,
  Button,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  CircularProgress,
  Alert
} from '@mui/material';

import {
  PaymentMethod,
  PaymentMethodType,
  PaymentGateway
} from '../../interfaces/payment.interface';
import { paymentMethodSchema } from '../../validators/payment.validator';
import { PaymentService } from '../../services/payment.service';

// PCI DSS compliance level enum
enum PCI_DSS_LEVEL {
  LEVEL_1 = 'LEVEL_1',
  LEVEL_2 = 'LEVEL_2',
  LEVEL_3 = 'LEVEL_3',
  LEVEL_4 = 'LEVEL_4'
}

interface PaymentMethodFormProps {
  onPaymentMethodAdded: (paymentMethod: PaymentMethod) => void;
  onError: (error: Error) => void;
  currency: string;
  defaultGateway?: PaymentGateway;
  isRecurring?: boolean;
  securityLevel?: PCI_DSS_LEVEL;
}

const PaymentMethodForm: React.FC<PaymentMethodFormProps> = ({
  onPaymentMethodAdded,
  onError,
  currency,
  defaultGateway,
  isRecurring = false,
  securityLevel = PCI_DSS_LEVEL.LEVEL_1
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>(
    defaultGateway || PaymentGateway.STRIPE
  );
  const [error, setError] = useState<string | null>(null);

  const paymentService = new PaymentService();

  const { register, handleSubmit: formSubmit, formState: { errors }, reset } = useForm({
    mode: 'onChange',
    resolver: yup.object().shape(paymentMethodSchema)
  });

  // Validate gateway availability based on currency
  useEffect(() => {
    const validateGateway = async () => {
      try {
        if (selectedGateway === PaymentGateway.TRANZILLA && currency !== 'ILS') {
          setSelectedGateway(PaymentGateway.STRIPE);
          setError('Tranzilla only supports ILS currency');
        }
      } catch (err) {
        setError('Failed to validate payment gateway');
        onError(err as Error);
      }
    };

    validateGateway();
  }, [currency, selectedGateway, onError]);

  // Handle gateway change with security validation
  const handleGatewayChange = useCallback(async (gateway: PaymentGateway) => {
    try {
      setLoading(true);
      setError(null);

      // Validate gateway availability
      const isAvailable = await paymentService.validateGatewayAvailability(gateway);
      if (!isAvailable) {
        throw new Error(`${gateway} gateway is currently unavailable`);
      }

      // Validate currency support
      if (gateway === PaymentGateway.TRANZILLA && currency !== 'ILS') {
        throw new Error('Tranzilla only supports ILS currency');
      }

      setSelectedGateway(gateway);
      reset(); // Reset form fields securely
    } catch (err) {
      setError((err as Error).message);
      onError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [currency, paymentService, reset, onError]);

  // Handle form submission with enhanced security
  const handleSubmit = async (formData: any) => {
    try {
      setLoading(true);
      setError(null);

      // Validate form data
      await paymentMethodSchema.validate(formData, { abortEarly: false });

      // Prepare payment method data with security context
      const paymentMethodData: Partial<PaymentMethod> = {
        type: formData.type as PaymentMethodType,
        gateway: selectedGateway,
        cardholderName: formData.cardholderName,
        expiryMonth: parseInt(formData.expiryMonth),
        expiryYear: parseInt(formData.expiryYear),
        isDefault: formData.isDefault || false,
        billingAddress: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          postalCode: formData.postalCode,
          country: formData.country
        }
      };

      // Add payment method with retry mechanism
      const result = await paymentService.addPaymentMethod(paymentMethodData);
      onPaymentMethodAdded(result);
      reset();
    } catch (err) {
      setError((err as Error).message);
      onError(err as Error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={formSubmit(handleSubmit)} className="payment-method-form">
      {error && <Alert severity="error" className="mb-4">{error}</Alert>}

      <FormControl component="fieldset" className="mb-4">
        <RadioGroup
          value={selectedGateway}
          onChange={(e) => handleGatewayChange(e.target.value as PaymentGateway)}
        >
          <FormControlLabel
            value={PaymentGateway.STRIPE}
            control={<Radio />}
            label="International Payments (Stripe)"
            disabled={loading}
          />
          <FormControlLabel
            value={PaymentGateway.TRANZILLA}
            control={<Radio />}
            label="Israeli Market (Tranzilla)"
            disabled={loading || currency !== 'ILS'}
          />
        </RadioGroup>
      </FormControl>

      <TextField
        {...register('cardholderName')}
        label="Cardholder Name"
        fullWidth
        className="mb-4"
        error={!!errors.cardholderName}
        helperText={errors.cardholderName?.message as string}
        disabled={loading}
      />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <TextField
          {...register('expiryMonth')}
          label="Expiry Month (MM)"
          type="number"
          inputProps={{ min: 1, max: 12 }}
          error={!!errors.expiryMonth}
          helperText={errors.expiryMonth?.message as string}
          disabled={loading}
        />
        <TextField
          {...register('expiryYear')}
          label="Expiry Year (YYYY)"
          type="number"
          inputProps={{ min: new Date().getFullYear(), max: new Date().getFullYear() + 20 }}
          error={!!errors.expiryYear}
          helperText={errors.expiryYear?.message as string}
          disabled={loading}
        />
      </div>

      <TextField
        {...register('street')}
        label="Street Address"
        fullWidth
        className="mb-4"
        error={!!errors.street}
        helperText={errors.street?.message as string}
        disabled={loading}
      />

      <div className="grid grid-cols-2 gap-4 mb-4">
        <TextField
          {...register('city')}
          label="City"
          error={!!errors.city}
          helperText={errors.city?.message as string}
          disabled={loading}
        />
        <TextField
          {...register('state')}
          label="State/Province"
          error={!!errors.state}
          helperText={errors.state?.message as string}
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <TextField
          {...register('postalCode')}
          label="Postal Code"
          error={!!errors.postalCode}
          helperText={errors.postalCode?.message as string}
          disabled={loading}
        />
        <TextField
          {...register('country')}
          label="Country Code"
          inputProps={{ maxLength: 2 }}
          error={!!errors.country}
          helperText={errors.country?.message as string}
          disabled={loading}
        />
      </div>

      <FormControlLabel
        control={
          <Radio
            {...register('isDefault')}
            disabled={loading}
          />
        }
        label="Set as default payment method"
      />

      <Button
        type="submit"
        variant="contained"
        color="primary"
        fullWidth
        disabled={loading}
        className="mt-4"
      >
        {loading ? <CircularProgress size={24} /> : 'Add Payment Method'}
      </Button>
    </form>
  );
};

export default PaymentMethodForm;