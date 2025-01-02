/**
 * Enhanced login page component with comprehensive security features,
 * internationalization support, and accessibility compliance
 * @version 1.0.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Paper, Alert } from '@mui/material';
import { styled } from '@mui/material/styles';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// Internal imports
import LoginForm from '../components/auth/LoginForm';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../hooks/useAuth';
import useLanguage from '../hooks/useLanguage';
import { User } from '../interfaces/user.interface';

// Styled components with RTL support
const LoginContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== 'isRTL',
})<{ isRTL: boolean }>(({ theme, isRTL }) => ({
  marginTop: theme.spacing(8),
  marginBottom: theme.spacing(8),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  direction: isRTL ? 'rtl' : 'ltr',
}));

const LoginPaper = styled(Paper)(({ theme }) => ({
  padding: theme.spacing(4),
  width: '100%',
  maxWidth: '450px',
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  position: 'relative',
}));

const SecurityAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(2),
  width: '100%',
}));

/**
 * Enhanced login page component with security features and accessibility
 */
const LoginPage: React.FC = () => {
  // Hooks initialization
  const navigate = useNavigate();
  const { t, isRTL, direction } = useLanguage();
  const { login, requires2FA, deviceTrusted, error: authError } = useAuth();

  // Local state management
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loginAttempts, setLoginAttempts] = useState<number>(0);
  const [isBlocked, setIsBlocked] = useState<boolean>(false);
  const [blockExpiry, setBlockExpiry] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize device fingerprint on component mount
   */
  useEffect(() => {
    const initializeDeviceFingerprint = async () => {
      try {
        const fp = await FingerprintJS.load();
        const result = await fp.get();
        setDeviceId(result.visitorId);
      } catch (err) {
        console.error('Device fingerprint error:', err);
      }
    };

    initializeDeviceFingerprint();
  }, []);

  /**
   * Handle login attempts and rate limiting
   */
  useEffect(() => {
    if (loginAttempts >= 5) {
      setIsBlocked(true);
      setBlockExpiry(Date.now() + 900000); // 15 minutes block
      
      const timer = setTimeout(() => {
        setIsBlocked(false);
        setLoginAttempts(0);
        setBlockExpiry(null);
      }, 900000);

      return () => clearTimeout(timer);
    }
  }, [loginAttempts]);

  /**
   * Enhanced success handler with security checks
   */
  const handleLoginSuccess = useCallback(async (user: User) => {
    try {
      if (!deviceId) {
        throw new Error(t('auth.errors.deviceFingerprint'));
      }

      if (requires2FA) {
        navigate('/auth/two-factor', { 
          state: { deviceId, deviceTrusted } 
        });
        return;
      }

      // Reset security state
      setLoginAttempts(0);
      setError(null);
      setIsBlocked(false);

      // Navigate to appropriate page
      navigate('/dashboard');

    } catch (err) {
      setError(err instanceof Error ? err.message : t('auth.errors.unknown'));
    }
  }, [deviceId, requires2FA, deviceTrusted, navigate, t]);

  /**
   * Handle form submission failure
   */
  const handleLoginFailure = useCallback((error: Error) => {
    setLoginAttempts(prev => prev + 1);
    setError(error.message);
  }, []);

  return (
    <LoginContainer 
      maxWidth="sm" 
      isRTL={isRTL}
      component="main"
      aria-labelledby="login-title"
    >
      <PageHeader
        title={t('auth.login.title')}
        subtitle={t('auth.login.subtitle')}
      />

      <LoginPaper elevation={3}>
        {error && (
          <SecurityAlert 
            severity="error"
            onClose={() => setError(null)}
            role="alert"
          >
            {error}
          </SecurityAlert>
        )}

        {authError && (
          <SecurityAlert 
            severity="error"
            role="alert"
          >
            {authError.message}
          </SecurityAlert>
        )}

        {isBlocked && blockExpiry && (
          <SecurityAlert 
            severity="warning"
            role="alert"
          >
            {t('auth.errors.tooManyAttempts', {
              minutes: Math.ceil((blockExpiry - Date.now()) / 60000)
            })}
          </SecurityAlert>
        )}

        <LoginForm
          onSuccess={handleLoginSuccess}
          onError={handleLoginFailure}
          onTwoFactorRequired={() => {
            navigate('/auth/two-factor', { 
              state: { deviceId, deviceTrusted } 
            });
          }}
          direction={direction}
          disabled={isBlocked}
        />
      </LoginPaper>
    </LoginContainer>
  );
};

export default LoginPage;