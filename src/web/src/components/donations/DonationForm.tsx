import React, { useState, useEffect, useCallback } from 'react';
import { useForm, Controller } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import {
  Box,
  Button,
  TextField,
  FormControl,
  FormControlLabel,
  RadioGroup,
  Radio,
  Checkbox,
  Select,
  MenuItem,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment
} from '@mui/material';
import { IDonation } from '../../interfaces/donation.interface';
import { PaymentMethodType, PaymentGateway } from '../../interfaces/payment.interface';
import { useDonations } from '../../hooks/useDonations';

// Validation schema with currency-specific rules
const validationSchema = yup.object().shape({
  amount: yup
    .number()
    .required('Amount is required')
    .test('min-amount', 'Amount must meet minimum requirement', function (value) {
      const currency = this.parent.currency;
      const minimums = { USD: 5, EUR: 5, ILS: 18, GBP: 5 };
      return value >= minimums[currency];
    }),
  currency: yup.string().oneOf(['USD', 'EUR', 'ILS', 'GBP']).required(),
  paymentMethodType: yup.string().oneOf(Object.values(PaymentMethodType)).required(),
  isAnonymous: yup.boolean(),
  isRecurring: yup.boolean(),
  recurringFrequency: yup.string().when('isRecurring', {
    is: true,
    then: yup.string().oneOf(['monthly', 'annual']).required('Frequency required for recurring donations')
  }),
  taxReceiptRequired: yup.boolean()
});

interface DonationFormProps {
  associationId: string;
  campaignId?: string | null;
  onSuccess: (donation: IDonation) => void;
  onError: (error: Error) => void;
  initialCurrency?: string;
}

const DonationForm: React.FC<DonationFormProps> = ({
  associationId,
  campaignId,
  onSuccess,
  onError,
  initialCurrency = 'USD'
}) => {
  const { createDonation, loading, error, progress } = useDonations();
  const [selectedGateway, setSelectedGateway] = useState<PaymentGateway>(PaymentGateway.STRIPE);

  const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: validationSchema,
    defaultValues: {
      amount: null,
      currency: initialCurrency,
      paymentMethodType: PaymentMethodType.CREDIT_CARD,
      isAnonymous: false,
      isRecurring: false,
      recurringFrequency: null,
      taxReceiptRequired: false
    }
  });

  // Watch form values for dynamic updates
  const currency = watch('currency');
  const isRecurring = watch('isRecurring');

  // Update payment gateway based on currency
  useEffect(() => {
    const newGateway = currency === 'ILS' ? PaymentGateway.TRANZILLA : PaymentGateway.STRIPE;
    setSelectedGateway(newGateway);
  }, [currency]);

  // Handle form submission
  const onSubmit = useCallback(async (formData) => {
    try {
      const donationData = {
        ...formData,
        associationId,
        campaignId,
        paymentGateway: selectedGateway
      };

      const result = await createDonation(donationData);
      onSuccess(result);
    } catch (err) {
      onError(err);
    }
  }, [associationId, campaignId, selectedGateway, createDonation, onSuccess, onError]);

  // Predefined donation amounts
  const suggestedAmounts = {
    USD: [18, 36, 100, 180],
    EUR: [18, 36, 100, 180],
    ILS: [50, 100, 360, 500],
    GBP: [15, 30, 90, 150]
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ maxWidth: 600, mx: 'auto', p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Currency Selection */}
      <Controller
        name="currency"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth margin="normal">
            <Select {...field} error={!!errors.currency}>
              <MenuItem value="USD">USD ($)</MenuItem>
              <MenuItem value="EUR">EUR (€)</MenuItem>
              <MenuItem value="ILS">ILS (₪)</MenuItem>
              <MenuItem value="GBP">GBP (£)</MenuItem>
            </Select>
          </FormControl>
        )}
      />

      {/* Donation Amount */}
      <Controller
        name="amount"
        control={control}
        render={({ field }) => (
          <Box sx={{ my: 2 }}>
            <RadioGroup row sx={{ mb: 2 }}>
              {suggestedAmounts[currency].map((amount) => (
                <FormControlLabel
                  key={amount}
                  value={amount}
                  control={<Radio />}
                  label={`${amount} ${currency}`}
                  onChange={() => setValue('amount', amount)}
                />
              ))}
            </RadioGroup>
            <TextField
              {...field}
              fullWidth
              type="number"
              label="Custom Amount"
              error={!!errors.amount}
              helperText={errors.amount?.message}
              InputProps={{
                startAdornment: <InputAdornment position="start">{currency}</InputAdornment>
              }}
            />
          </Box>
        )}
      />

      {/* Payment Method */}
      <Controller
        name="paymentMethodType"
        control={control}
        render={({ field }) => (
          <FormControl fullWidth margin="normal">
            <Select {...field} error={!!errors.paymentMethodType}>
              <MenuItem value={PaymentMethodType.CREDIT_CARD}>Credit Card</MenuItem>
              <MenuItem value={PaymentMethodType.BANK_TRANSFER}>Bank Transfer</MenuItem>
              <MenuItem value={PaymentMethodType.DIRECT_DEBIT}>Direct Debit</MenuItem>
            </Select>
          </FormControl>
        )}
      />

      {/* Recurring Donation */}
      <Controller
        name="isRecurring"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={<Checkbox {...field} />}
            label="Make this a recurring donation"
          />
        )}
      />

      {isRecurring && (
        <Controller
          name="recurringFrequency"
          control={control}
          render={({ field }) => (
            <FormControl fullWidth margin="normal">
              <Select {...field} error={!!errors.recurringFrequency}>
                <MenuItem value="monthly">Monthly</MenuItem>
                <MenuItem value="annual">Annual</MenuItem>
              </Select>
            </FormControl>
          )}
        />
      )}

      {/* Additional Options */}
      <Box sx={{ my: 2 }}>
        <Controller
          name="isAnonymous"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Checkbox {...field} />}
              label="Make donation anonymous"
            />
          )}
        />

        <Controller
          name="taxReceiptRequired"
          control={control}
          render={({ field }) => (
            <FormControlLabel
              control={<Checkbox {...field} />}
              label="Generate tax receipt"
            />
          )}
        />
      </Box>

      {/* Campaign Progress */}
      {campaignId && progress.total > 0 && (
        <Box sx={{ my: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Campaign Progress: {Math.round(progress.percentage)}%
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress.percentage}
            sx={{ mt: 1 }}
          />
        </Box>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={loading}
        sx={{ mt: 3 }}
      >
        {loading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          `Donate ${currency} ${watch('amount') || ''}`
        )}
      </Button>
    </Box>
  );
};

export default DonationForm;