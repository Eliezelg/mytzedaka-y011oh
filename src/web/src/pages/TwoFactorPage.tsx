import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Box, 
  Container, 
  Typography, 
  CircularProgress, 
  Alert 
} from '@mui/material';

import TwoFactorForm from '../components/auth/TwoFactorForm';
import MainLayout from '../components/layout/MainLayout';
import { useAuth } from '../hooks/useAuth';
import useLanguage from '../hooks/useLanguage';

/**
 * Enhanced two-factor authentication page component with comprehensive security features,
 * RTL support, and accessibility compliance
 */
const TwoFactorPage: React.FC = () => {
  // Hooks
  const navigate = useNavigate();
  const location = useLocation();
  const { t, isRTL } = useLanguage();
  const { requires2FA, verifyTOTP, verifySMS } = useAuth();

  // Local state
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [verificationMethod, setVerificationMethod] = useState<'totp' | 'sms'>('totp');

  // Redirect if 2FA is not required
  useEffect(() => {
    if (!requires2FA) {
      navigate('/dashboard', { replace: true });
    }
  }, [requires2FA, navigate]);

  // Handle successful verification
  const handleVerificationSuccess = useCallback(() => {
    navigate('/dashboard', { replace: true });
  }, [navigate]);

  // Handle verification error with user feedback
  const handleVerificationError = useCallback((error: Error) => {
    setError(error.message);
    // Announce error to screen readers
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'alert');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = error.message;
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  }, []);

  // Handle SMS fallback
  const handleSMSFallback = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      await verifySMS();
      setVerificationMethod('sms');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to send SMS code');
    } finally {
      setIsLoading(false);
    }
  }, [verifySMS]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      setError(null);
      setIsLoading(false);
    };
  }, []);

  return (
    <MainLayout>
      <Container
        maxWidth="sm"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 200px)',
          padding: theme => theme.spacing(3),
          direction: 'inherit'
        }}
      >
        <Typography
          variant="h4"
          component="h1"
          sx={{
            marginBottom: theme => theme.spacing(2),
            textAlign: 'center',
            fontWeight: 'bold'
          }}
          aria-label={t('auth.twoFactor.title')}
        >
          {t('auth.twoFactor.title')}
        </Typography>

        <Typography
          variant="body1"
          sx={{
            marginBottom: theme => theme.spacing(4),
            textAlign: 'center',
            color: 'text.secondary',
            maxWidth: '600px'
          }}
        >
          {t(`auth.twoFactor.description.${verificationMethod}`)}
        </Typography>

        {error && (
          <Alert
            severity="error"
            onClose={() => setError(null)}
            sx={{
              marginBottom: theme => theme.spacing(3),
              width: '100%',
              maxWidth: '400px'
            }}
          >
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '200px'
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <TwoFactorForm
            onSuccess={handleVerificationSuccess}
            onError={handleVerificationError}
            onSMSFallback={handleSMSFallback}
          />
        )}
      </Container>
    </MainLayout>
  );
};

export default TwoFactorPage;