import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next'; // v13.0.0
import { 
  Stepper, 
  Step, 
  StepLabel, 
  TextField, 
  Button, 
  Alert, 
  LinearProgress,
  Box,
  Typography,
  FormControlLabel,
  Checkbox,
  Container,
  Paper
} from '@mui/material'; // v5.14.0
import useForm from '../../hooks/useForm';
import { registerSchema } from '../../validators/auth.validator';
import { AuthService } from '../../services/auth.service';

// Step labels for the registration process
const REGISTRATION_STEPS = ['auth.steps.credentials', 'auth.steps.personal', 'auth.steps.security'];

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  enable2FA: boolean;
  deviceInfo?: {
    fingerprint: string;
    userAgent: string;
    timestamp: number;
  };
}

interface RegisterFormProps {
  onSuccess?: () => void;
  enableDeviceFingerprint?: boolean;
  enable2FA?: boolean;
}

const RegisterForm: React.FC<RegisterFormProps> = ({
  onSuccess,
  enableDeviceFingerprint = true,
  enable2FA = true
}) => {
  const { t } = useTranslation();
  const [activeStep, setActiveStep] = useState(0);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [passwordStrength, setPasswordStrength] = useState(0);

  // Initialize form with useForm hook
  const {
    values,
    errors,
    handleChange,
    handleSubmit,
    setFieldValue,
    isSubmitting,
    isValid
  } = useForm<RegisterFormData>({
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
      enable2FA: enable2FA,
      deviceInfo: undefined
    },
    validationSchema: registerSchema,
    onSubmit: handleRegistration
  });

  // Calculate password strength
  useEffect(() => {
    if (values.password) {
      let strength = 0;
      if (values.password.length >= 8) strength += 20;
      if (/[A-Z]/.test(values.password)) strength += 20;
      if (/[a-z]/.test(values.password)) strength += 20;
      if (/[0-9]/.test(values.password)) strength += 20;
      if (/[^A-Za-z0-9]/.test(values.password)) strength += 20;
      setPasswordStrength(strength);
    } else {
      setPasswordStrength(0);
    }
  }, [values.password]);

  // Handle registration submission
  async function handleRegistration(formData: RegisterFormData) {
    try {
      setRegistrationError(null);

      // Get device fingerprint if enabled
      if (enableDeviceFingerprint) {
        const deviceInfo = await AuthService.getDeviceFingerprint();
        formData.deviceInfo = deviceInfo;
      }

      // Register user
      const response = await AuthService.registerUser(formData);

      // Initialize 2FA if enabled
      if (formData.enable2FA) {
        await AuthService.initializeTwoFactor(response.id);
      }

      // Call success callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      setRegistrationError(
        error.response?.data?.message || t('auth.errors.registration')
      );
    }
  }

  // Validate current step
  const validateStep = useCallback(() => {
    const stepFields = {
      0: ['email', 'password', 'confirmPassword'],
      1: ['firstName', 'lastName'],
      2: ['enable2FA']
    };

    const currentFields = stepFields[activeStep as keyof typeof stepFields];
    return currentFields.every(field => !errors[field]);
  }, [activeStep, errors]);

  // Handle step navigation
  const handleNext = useCallback(() => {
    if (validateStep()) {
      setActiveStep(prev => prev + 1);
    }
  }, [validateStep]);

  const handleBack = useCallback(() => {
    setActiveStep(prev => prev - 1);
  }, []);

  // Render step content
  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              name="email"
              label={t('auth.fields.email')}
              value={values.email}
              onChange={handleChange}
              error={!!errors.email}
              helperText={errors.email}
              margin="normal"
              autoComplete="email"
              dir="ltr"
            />
            <TextField
              fullWidth
              name="password"
              type="password"
              label={t('auth.fields.password')}
              value={values.password}
              onChange={handleChange}
              error={!!errors.password}
              helperText={errors.password}
              margin="normal"
              autoComplete="new-password"
            />
            <LinearProgress
              variant="determinate"
              value={passwordStrength}
              sx={{ mt: 1, mb: 1 }}
            />
            <Typography variant="caption" color="textSecondary">
              {t('auth.passwordStrength', { strength: passwordStrength })}
            </Typography>
            <TextField
              fullWidth
              name="confirmPassword"
              type="password"
              label={t('auth.fields.confirmPassword')}
              value={values.confirmPassword}
              onChange={handleChange}
              error={!!errors.confirmPassword}
              helperText={errors.confirmPassword}
              margin="normal"
              autoComplete="new-password"
            />
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <TextField
              fullWidth
              name="firstName"
              label={t('auth.fields.firstName')}
              value={values.firstName}
              onChange={handleChange}
              error={!!errors.firstName}
              helperText={errors.firstName}
              margin="normal"
              autoComplete="given-name"
            />
            <TextField
              fullWidth
              name="lastName"
              label={t('auth.fields.lastName')}
              value={values.lastName}
              onChange={handleChange}
              error={!!errors.lastName}
              helperText={errors.lastName}
              margin="normal"
              autoComplete="family-name"
            />
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={values.enable2FA}
                  onChange={(e) => setFieldValue('enable2FA', e.target.checked)}
                  name="enable2FA"
                />
              }
              label={t('auth.fields.enable2FA')}
            />
            <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
              {t('auth.2faDescription')}
            </Typography>
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
        <Stepper activeStep={activeStep} alternativeLabel>
          {REGISTRATION_STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{t(label)}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <form onSubmit={handleSubmit}>
          {registrationError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {registrationError}
            </Alert>
          )}

          {renderStepContent(activeStep)}

          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
            <Button
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              {t('common.back')}
            </Button>
            <Box>
              {activeStep === REGISTRATION_STEPS.length - 1 ? (
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={isSubmitting || !isValid}
                >
                  {t('auth.actions.register')}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  disabled={!validateStep()}
                >
                  {t('common.next')}
                </Button>
              )}
            </Box>
          </Box>
        </form>
      </Paper>
    </Container>
  );
};

export default RegisterForm;