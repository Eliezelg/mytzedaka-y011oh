import React, { useState, useCallback, useEffect } from 'react';
import { Container, Box, useTheme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '@apollo/client';
import { useAuth } from '@auth/core';

// Internal components
import MainLayout from '../components/layout/MainLayout';
import DonationHistory from '../components/donations/DonationHistory';
import PageHeader from '../components/common/PageHeader';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Constants
const ITEMS_PER_PAGE = 10;
const SUBSCRIPTION_DEBOUNCE_MS = 500;
const REQUIRED_ROLES = ['USER', 'ADMIN'];

/**
 * DonationHistoryPage component displays user's donation history with real-time updates,
 * pagination, and comprehensive error handling
 */
const DonationHistoryPage: React.FC = () => {
  // Hooks
  const theme = useTheme();
  const { t, i18n } = useTranslation();
  const { user, validateRole } = useAuth();
  const isRTL = i18n.dir() === 'rtl';

  // State
  const [error, setError] = useState<Error | null>(null);

  // Validate user access
  useEffect(() => {
    if (!user || !REQUIRED_ROLES.some(role => validateRole(role))) {
      setError(new Error(t('errors.unauthorized')));
    }
  }, [user, validateRole, t]);

  // Handle real-time donation updates
  const handleStatusUpdate = useCallback((update: { donationId: string; status: string }) => {
    // Update will be handled by DonationHistory component through its own subscription
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.textContent = t('donations.status.updated', { status: update.status });
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 3000);
  }, [t]);

  // Subscribe to donation updates
  useSubscription(
    DONATION_STATUS_SUBSCRIPTION,
    {
      variables: { userId: user?.id },
      onData: ({ data }) => {
        if (data?.donationStatusUpdate) {
          handleStatusUpdate(data.donationStatusUpdate);
        }
      },
      onError: (error) => {
        setError(error);
      }
    }
  );

  // Handle donation history errors
  const handleError = useCallback((error: Error) => {
    setError(error);
  }, []);

  return (
    <ErrorBoundary>
      <MainLayout>
        <Container
          maxWidth="lg"
          sx={{
            marginTop: theme.spacing(4),
            marginBottom: theme.spacing(4),
            position: 'relative'
          }}
        >
          <PageHeader
            title={t('donations.history.title')}
            subtitle={t('donations.history.subtitle')}
          />

          <Box
            component="main"
            sx={{
              width: '100%',
              direction: isRTL ? 'rtl' : 'ltr',
              '& .MuiTableCell-root': {
                direction: isRTL ? 'rtl' : 'ltr'
              }
            }}
            role="main"
            aria-label={t('donations.history.aria-label')}
          >
            <DonationHistory
              itemsPerPage={ITEMS_PER_PAGE}
              onError={handleError}
              showReceipts={true}
            />
          </Box>
        </Container>
      </MainLayout>
    </ErrorBoundary>
  );
};

// GraphQL subscription for real-time donation updates
const DONATION_STATUS_SUBSCRIPTION = gql`
  subscription OnDonationStatusUpdate($userId: ID!) {
    donationStatusUpdate(userId: $userId) {
      donationId
      status
      timestamp
    }
  }
`;

export default DonationHistoryPage;