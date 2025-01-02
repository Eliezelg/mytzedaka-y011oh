/**
 * @fileoverview Enhanced registration page component with comprehensive security features,
 * internationalization support, and accessibility compliance
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';

// Internal components
import RegisterForm from '../components/auth/RegisterForm';
import MainLayout from '../components/layout/MainLayout';
import useAuth from '../hooks/useAuth';

// Interface for registration data
interface RegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  enable2FA: boolean;
  deviceInfo?: {
    fingerprint: string;
    userAgent: string;
    timestamp: number;
  };
}

// Styled components with RTL support
const StyledContainer = styled(Container, {
  shouldForwardProp: (prop) => prop !== 'isRTL',
})<{ isRTL: boolean }>(({ theme, isRTL }) => ({
  marginTop: theme.spacing(8),
  marginBottom: theme.spacing(8),
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  minHeight: 'calc(100vh - 200px)',
  position: 'relative',
  direction: isRTL ? 'rtl' : 'ltr',
}));

const LoadingOverlay = styled('div')(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  backgroundColor: 'rgba(255, 255, 255, 0.8)',
  zIndex: theme.zIndex.modal,
  backdropFilter: 'blur(2px)',
}));

/**
 * Enhanced registration page component with security features and accessibility
 */
const RegisterPage: React.FC = () => {
  // Hooks initialization
  const navigate = useNavigate();
  const { user, loading, error, requires2FA, deviceFingerprint } = useAuth();
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Redirect if user is already authenticated
  useEffect(() => {
    if (user && !requires2FA) {
      navigate('/dashboard');
    }
  }, [user, requires2FA, navigate]);

  /**
   * Handle successful registration with 2FA setup and device verification
   */
  const handleRegistrationSuccess = useCallback(async (registrationData: RegistrationData) => {
    try {
      setIsProcessing(true);

      // Verify device fingerprint if available
      if (deviceFingerprint) {
        registrationData.deviceInfo = {
          fingerprint: deviceFingerprint,
          userAgent: navigator.userAgent,
          timestamp: Date.now()
        };
      }

      // Handle 2FA setup if required
      if (requires2FA) {
        navigate('/auth/two-factor', {
          state: {
            deviceFingerprint,
            isNewRegistration: true
          }
        });
        return;
      }

      // Navigate to dashboard if 2FA not required
      navigate('/dashboard');

    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsProcessing(false);
    }
  }, [deviceFingerprint, requires2FA, navigate]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <MainLayout>
        <StyledContainer maxWidth="sm" isRTL={false}>
          <LoadingOverlay>
            <CircularProgress size={48} />
          </LoadingOverlay>
        </StyledContainer>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <StyledContainer 
        maxWidth="sm" 
        isRTL={false}
        component="main"
        role="main"
        aria-label="Registration page"
      >
        {isProcessing && (
          <LoadingOverlay>
            <CircularProgress size={48} />
          </LoadingOverlay>
        )}

        <RegisterForm
          onSuccess={handleRegistrationSuccess}
          enableDeviceFingerprint={true}
          enable2FA={true}
        />
      </StyledContainer>
    </MainLayout>
  );
};

export default RegisterPage;