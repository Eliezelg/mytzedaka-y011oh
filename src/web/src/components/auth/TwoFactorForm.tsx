import React, { useEffect, useRef } from 'react';
import { TextField, Button, Alert, Checkbox, FormControlLabel, Box, Typography } from '@mui/material'; // ^5.14.0
import { useTranslation } from 'react-i18next'; // ^13.0.0
import { useAuth } from '../../hooks/useAuth';
import { useForm } from '../../hooks/useForm';
import { twoFactorSchema } from '../../validators/auth.validator';

// Constants for rate limiting and validation
const MAX_ATTEMPTS = 5;
const ATTEMPT_TIMEOUT = 30000; // 30 seconds
const INITIAL_VALUES = {
  code: '',
  trustDevice: false
};

interface TwoFactorFormProps {
  onSuccess: () => void;
  onRequestSMS: () => Promise<void>;
  onUseRecoveryCode: () => void;
}

interface TwoFactorFormValues {
  code: string;
  trustDevice: boolean;
}

/**
 * Enhanced Two-Factor Authentication form component with comprehensive security features
 * Supports TOTP, SMS fallback, device trust, and multi-language accessibility
 */
const TwoFactorForm: React.FC<TwoFactorFormProps> = ({
  onSuccess,
  onRequestSMS,
  onUseRecoveryCode
}) => {
  // Hooks
  const { t } = useTranslation();
  const { verify2FA, error, isLoading } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const attemptsRef = useRef<number>(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Initialize form with validation
  const {
    values,
    errors,
    touched,
    handleChange,
    handleSubmit,
    handleBlur,
    isValid,
    isSubmitting
  } = useForm<TwoFactorFormValues>({
    initialValues: INITIAL_VALUES,
    validationSchema: twoFactorSchema,
    onSubmit: async (formValues) => {
      if (attemptsRef.current >= MAX_ATTEMPTS) {
        return;
      }

      try {
        attemptsRef.current += 1;
        const result = await verify2FA(formValues.code, formValues.trustDevice);
        
        if (result.success) {
          attemptsRef.current = 0;
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
          onSuccess();
        }
      } catch (error) {
        if (attemptsRef.current >= MAX_ATTEMPTS) {
          timeoutRef.current = setTimeout(() => {
            attemptsRef.current = 0;
          }, ATTEMPT_TIMEOUT);
        }
      }
    }
  });

  // Auto-focus code input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{ width: '100%', maxWidth: 400 }}
    >
      <Typography variant="h6" gutterBottom>
        {t('auth.twoFactor.title')}
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t(`auth.twoFactor.errors.${error}`)}
        </Alert>
      )}

      <TextField
        inputRef={inputRef}
        fullWidth
        id="code"
        name="code"
        label={t('auth.twoFactor.codeLabel')}
        type="text"
        value={values.code}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.code && Boolean(errors.code)}
        helperText={touched.code && errors.code ? t(errors.code) : ''}
        inputProps={{
          maxLength: 6,
          autoComplete: 'one-time-code',
          inputMode: 'numeric',
          pattern: '[0-9]*',
          'aria-label': t('auth.twoFactor.codeAriaLabel')
        }}
        sx={{ mb: 2 }}
        disabled={isSubmitting || attemptsRef.current >= MAX_ATTEMPTS}
      />

      <FormControlLabel
        control={
          <Checkbox
            name="trustDevice"
            checked={values.trustDevice}
            onChange={handleChange}
            color="primary"
            disabled={isSubmitting}
          />
        }
        label={t('auth.twoFactor.trustDevice')}
        sx={{ mb: 2 }}
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          color="primary"
          disabled={!isValid || isSubmitting || attemptsRef.current >= MAX_ATTEMPTS}
          aria-label={t('auth.twoFactor.verifyAriaLabel')}
        >
          {isLoading ? t('common.loading') : t('auth.twoFactor.verify')}
        </Button>

        <Button
          type="button"
          fullWidth
          variant="outlined"
          onClick={onRequestSMS}
          disabled={isSubmitting || attemptsRef.current >= MAX_ATTEMPTS}
          aria-label={t('auth.twoFactor.requestSMSAriaLabel')}
        >
          {t('auth.twoFactor.requestSMS')}
        </Button>

        <Button
          type="button"
          fullWidth
          variant="text"
          onClick={onUseRecoveryCode}
          disabled={isSubmitting}
          aria-label={t('auth.twoFactor.useRecoveryAriaLabel')}
        >
          {t('auth.twoFactor.useRecovery')}
        </Button>
      </Box>

      {attemptsRef.current >= MAX_ATTEMPTS && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          {t('auth.twoFactor.tooManyAttempts', { timeout: ATTEMPT_TIMEOUT / 1000 })}
        </Alert>
      )}
    </Box>
  );
};

export default TwoFactorForm;