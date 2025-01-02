/**
 * Enhanced login form component with comprehensive security features,
 * multi-language support, and device trust validation
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { TextField, Button, CircularProgress, Alert, Box, FormControlLabel, Checkbox } from '@mui/material';
import { loginSchema } from '../../validators/auth.validator';
import { AuthService } from '../../services/auth.service';
import useForm from '../../hooks/useForm';

// Interface definitions
interface LoginFormProps {
  onSuccess: (user: User) => void;
  onTwoFactorRequired: (token: string) => void;
  onDeviceTrustRequired: (deviceId: string) => void;
  direction: 'ltr' | 'rtl';
}

interface LoginFormValues {
  email: string;
  password: string;
  deviceTrust: boolean;
  rememberMe: boolean;
}

const LoginForm: React.FC<LoginFormProps> = ({
  onSuccess,
  onTwoFactorRequired,
  onDeviceTrustRequired,
  direction
}) => {
  // Hooks initialization
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [rateLimitExceeded, setRateLimitExceeded] = useState(false);
  const [rateLimitReset, setRateLimitReset] = useState<number | null>(null);

  // Initialize form with enhanced validation and security features
  const {
    values,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    isValid,
    isSubmitting
  } = useForm<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
      deviceTrust: false,
      rememberMe: false
    },
    validationSchema: loginSchema,
    onSubmit: async (formValues) => {
      try {
        setIsLoading(true);
        setError(null);

        // Check rate limiting before proceeding
        const rateLimit = await AuthService.checkRateLimit(formValues.email);
        if (!rateLimit.allowed) {
          setRateLimitExceeded(true);
          setRateLimitReset(rateLimit.resetTime);
          return;
        }

        // Attempt login with enhanced security
        const response = await AuthService.loginUser({
          email: formValues.email,
          password: formValues.password,
          deviceTrust: formValues.deviceTrust,
          rememberMe: formValues.rememberMe
        });

        // Handle different authentication scenarios
        if (response.requiresTwoFactor) {
          onTwoFactorRequired(response.temporaryToken);
        } else if (!response.deviceTrusted) {
          onDeviceTrustRequired(response.deviceId);
        } else {
          onSuccess(response.user);
          navigate('/dashboard');
        }
      } catch (err) {
        setError(t('auth.errors.loginFailed'));
        console.error('Login error:', err);
      } finally {
        setIsLoading(false);
      }
    }
  });

  // Reset rate limit status when timer expires
  useEffect(() => {
    if (rateLimitReset) {
      const timer = setTimeout(() => {
        setRateLimitExceeded(false);
        setRateLimitReset(null);
      }, rateLimitReset - Date.now());
      return () => clearTimeout(timer);
    }
  }, [rateLimitReset]);

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      noValidate
      sx={{
        width: '100%',
        maxWidth: 400,
        direction
      }}
    >
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {rateLimitExceeded && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('auth.errors.rateLimitExceeded', {
            minutes: Math.ceil((rateLimitReset! - Date.now()) / 60000)
          })}
        </Alert>
      )}

      <TextField
        margin="normal"
        required
        fullWidth
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        autoFocus
        value={values.email}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.email && Boolean(errors.email)}
        helperText={touched.email && errors.email}
        label={t('auth.fields.email')}
        disabled={isLoading || rateLimitExceeded}
        inputProps={{
          'aria-label': t('auth.fields.email'),
          dir: 'ltr'
        }}
      />

      <TextField
        margin="normal"
        required
        fullWidth
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={values.password}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.password && Boolean(errors.password)}
        helperText={touched.password && errors.password}
        label={t('auth.fields.password')}
        disabled={isLoading || rateLimitExceeded}
        inputProps={{
          'aria-label': t('auth.fields.password'),
          dir: 'ltr'
        }}
      />

      <FormControlLabel
        control={
          <Checkbox
            name="deviceTrust"
            checked={values.deviceTrust}
            onChange={(e) => setFieldValue('deviceTrust', e.target.checked)}
            color="primary"
            disabled={isLoading || rateLimitExceeded}
          />
        }
        label={t('auth.fields.trustDevice')}
      />

      <FormControlLabel
        control={
          <Checkbox
            name="rememberMe"
            checked={values.rememberMe}
            onChange={(e) => setFieldValue('rememberMe', e.target.checked)}
            color="primary"
            disabled={isLoading || rateLimitExceeded}
          />
        }
        label={t('auth.fields.rememberMe')}
      />

      <Button
        type="submit"
        fullWidth
        variant="contained"
        color="primary"
        disabled={!isValid || isSubmitting || isLoading || rateLimitExceeded}
        sx={{ mt: 3, mb: 2 }}
      >
        {isLoading ? (
          <CircularProgress size={24} color="inherit" />
        ) : (
          t('auth.actions.login')
        )}
      </Button>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Button
          color="primary"
          onClick={() => navigate('/auth/forgot-password')}
          disabled={isLoading || rateLimitExceeded}
        >
          {t('auth.actions.forgotPassword')}
        </Button>
      </Box>
    </Box>
  );
};

export default LoginForm;