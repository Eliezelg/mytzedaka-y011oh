import React, { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { 
  TextField, 
  Button, 
  Box, 
  Typography, 
  CircularProgress,
  FormHelperText,
  InputAdornment,
  FormControl
} from '@mui/material';
import { PaymentMethod, PaymentMethodType, PaymentGateway } from '../../interfaces/payment.interface';
import { paymentMethodSchema } from '../../validators/payment.validator';
import { PaymentService } from '../../services/payment.service';
import { CreditCard as CreditCardIcon, Lock as LockIcon } from '@mui/icons-material';

// Version comments for external dependencies
// @mui/material: ^5.14.0
// react-hook-form: ^7.45.0
// yup: ^1.3.2

interface TranzillaFormProps {
  onSuccess: (paymentMethod: PaymentMethod) => void;
  onError: (error: string) => void;
  isLoading?: boolean;
}

interface TranzillaFormData {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardholderName: string;
  israeliId: string; // Teudat Zehut
}

const ISRAELI_CARD_PREFIXES = {
  ISRACARD: ['4580', '4581', '4582'],
  VISA_CAL: ['4157'],
  MASTERCARD: ['5326', '5296'],
  AMEX: ['3763', '3795']
};

const TranzillaForm: React.FC<TranzillaFormProps> = ({ onSuccess, onError, isLoading = false }) => {
  const [processing, setProcessing] = useState<boolean>(false);
  const paymentService = new PaymentService();

  const {
    control,
    handleSubmit,
    formState: { errors },
    watch,
    setError,
    clearErrors
  } = useForm<TranzillaFormData>({
    mode: 'onChange',
    defaultValues: {
      cardNumber: '',
      expiryMonth: '',
      expiryYear: '',
      cvv: '',
      cardholderName: '',
      israeliId: ''
    }
  });

  // Secure card number masking
  const maskCardNumber = (value: string): string => {
    const cleaned = value.replace(/\D/g, '');
    const groups = cleaned.match(/(\d{4})|(\d+)/g) || [];
    return groups.join(' ');
  };

  // Israeli ID (Teudat Zehut) validation
  const validateIsraeliId = (id: string): boolean => {
    if (!/^\d{9}$/.test(id)) return false;
    
    const digits = Array.from(id).map(Number);
    const checksum = digits.reduce((sum, digit, index) => {
      let weight = (index % 2) + 1;
      let product = digit * weight;
      return sum + (product > 9 ? product - 9 : product);
    }, 0);
    
    return checksum % 10 === 0;
  };

  // Validate Israeli credit card
  const validateIsraeliCard = (cardNumber: string): boolean => {
    const cleaned = cardNumber.replace(/\D/g, '');
    return Object.values(ISRAELI_CARD_PREFIXES).some(prefixes =>
      prefixes.some(prefix => cleaned.startsWith(prefix))
    );
  };

  const onSubmit = async (data: TranzillaFormData) => {
    try {
      setProcessing(true);

      // Validate Israeli ID
      if (!validateIsraeliId(data.israeliId)) {
        setError('israeliId', { message: 'מספר תעודת זהות לא תקין' });
        return;
      }

      // Validate Israeli credit card
      if (!validateIsraeliCard(data.cardNumber)) {
        setError('cardNumber', { message: 'כרטיס אשראי לא נתמך' });
        return;
      }

      const paymentMethod: Partial<PaymentMethod> = {
        type: PaymentMethodType.CREDIT_CARD,
        gateway: PaymentGateway.TRANZILLA,
        cardholderName: data.cardholderName,
        expiryMonth: parseInt(data.expiryMonth),
        expiryYear: parseInt(data.expiryYear),
        lastFourDigits: data.cardNumber.slice(-4),
        isDefault: true
      };

      // Validate payment method using schema
      await paymentMethodSchema.validate(paymentMethod);

      // Add payment method using service
      const result = await paymentService.addPaymentMethod(paymentMethod);
      onSuccess(result);
    } catch (error) {
      onError(error instanceof Error ? error.message : 'שגיאה בעיבוד התשלום');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit(onSubmit)}
      sx={{
        width: '100%',
        maxWidth: 400,
        direction: 'rtl', // RTL support for Hebrew
        '& .MuiTextField-root': { mb: 2 }
      }}
    >
      <Typography variant="h6" gutterBottom align="right">
        <LockIcon sx={{ mr: 1 }} />
        פרטי תשלום מאובטחים
      </Typography>

      <Controller
        name="cardholderName"
        control={control}
        rules={{ required: 'שם בעל הכרטיס נדרש' }}
        render={({ field }) => (
          <TextField
            {...field}
            label="שם בעל הכרטיס"
            fullWidth
            error={!!errors.cardholderName}
            helperText={errors.cardholderName?.message}
            inputProps={{ maxLength: 50 }}
          />
        )}
      />

      <Controller
        name="cardNumber"
        control={control}
        rules={{
          required: 'מספר כרטיס נדרש',
          validate: value => validateIsraeliCard(value) || 'כרטיס אשראי לא נתמך'
        }}
        render={({ field }) => (
          <TextField
            {...field}
            label="מספר כרטיס אשראי"
            fullWidth
            onChange={e => field.onChange(maskCardNumber(e.target.value))}
            error={!!errors.cardNumber}
            helperText={errors.cardNumber?.message}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <CreditCardIcon />
                </InputAdornment>
              )
            }}
          />
        )}
      />

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Controller
          name="expiryMonth"
          control={control}
          rules={{ required: 'חודש נדרש' }}
          render={({ field }) => (
            <TextField
              {...field}
              label="חודש"
              type="text"
              inputProps={{ maxLength: 2, pattern: '\\d*' }}
              error={!!errors.expiryMonth}
              helperText={errors.expiryMonth?.message}
            />
          )}
        />

        <Controller
          name="expiryYear"
          control={control}
          rules={{ required: 'שנה נדרשת' }}
          render={({ field }) => (
            <TextField
              {...field}
              label="שנה"
              type="text"
              inputProps={{ maxLength: 2, pattern: '\\d*' }}
              error={!!errors.expiryYear}
              helperText={errors.expiryYear?.message}
            />
          )}
        />

        <Controller
          name="cvv"
          control={control}
          rules={{ required: 'CVV נדרש' }}
          render={({ field }) => (
            <TextField
              {...field}
              label="CVV"
              type="password"
              inputProps={{ maxLength: 4, pattern: '\\d*' }}
              error={!!errors.cvv}
              helperText={errors.cvv?.message}
            />
          )}
        />
      </Box>

      <Controller
        name="israeliId"
        control={control}
        rules={{
          required: 'תעודת זהות נדרשת',
          validate: value => validateIsraeliId(value) || 'מספר תעודת זהות לא תקין'
        }}
        render={({ field }) => (
          <TextField
            {...field}
            label="תעודת זהות"
            fullWidth
            inputProps={{ maxLength: 9, pattern: '\\d*' }}
            error={!!errors.israeliId}
            helperText={errors.israeliId?.message}
          />
        )}
      />

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={processing || isLoading}
        sx={{ mt: 2 }}
      >
        {processing || isLoading ? (
          <CircularProgress size={24} />
        ) : (
          'אישור תשלום'
        )}
      </Button>

      <FormHelperText sx={{ mt: 2, textAlign: 'center' }}>
        העסקה מאובטחת ומוצפנת בתקן PCI DSS
      </FormHelperText>
    </Box>
  );
};

export default TranzillaForm;