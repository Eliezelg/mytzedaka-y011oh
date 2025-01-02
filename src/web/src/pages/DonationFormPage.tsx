import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Container,
  Paper,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { ErrorBoundary } from 'react-error-boundary';

// Internal components
import MainLayout from '../components/layout/MainLayout';
import DonationForm from '../components/donations/DonationForm';
import { useDonations } from '../hooks/useDonations';

// Types
interface DonationFormPageProps {
  associationId: string;
  campaignId?: string;
  initialCurrency?: string;
}

const DonationFormPage: React.FC<DonationFormPageProps> = ({
  associationId,
  campaignId,
  initialCurrency = 'USD'
}) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { createDonation, trackDonationProgress } = useDonations();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // Handle successful donation submission
  const handleDonationSubmit = useCallback(async (formData: any) => {
    try {
      setLoading(true);
      setError(null);

      const donation = await createDonation({
        ...formData,
        associationId,
        campaignId,
      });

      // Track donation progress if part of a campaign
      if (campaignId) {
        const progress = await trackDonationProgress(campaignId);
        setProgress(progress);
      }

      // Navigate to success page
      navigate('/donation/success', {
        state: {
          donationId: donation.id,
          amount: donation.amount,
          currency: donation.currency
        }
      });
    } catch (err: any) {
      setError(err.message || t('donations.errors.submission'));
      // Log error for monitoring
      console.error('Donation submission error:', err);
    } finally {
      setLoading(false);
    }
  }, [associationId, campaignId, createDonation, navigate, t, trackDonationProgress]);

  // Handle donation errors
  const handleDonationError = useCallback((error: Error) => {
    setError(error.message);
    setLoading(false);
  }, []);

  // Initialize WebSocket connection for real-time updates
  useEffect(() => {
    if (!campaignId) return;

    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/campaigns/${campaignId}`);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'CAMPAIGN_PROGRESS') {
        setProgress(data.progress);
      }
    };

    return () => {
      ws.close();
    };
  }, [campaignId]);

  return (
    <MainLayout>
      <Container
        maxWidth="md"
        sx={{
          paddingTop: 4,
          paddingBottom: 4,
          direction: 'inherit'
        }}
      >
        <Paper
          elevation={2}
          sx={{
            padding: 3,
            marginBottom: 3,
            boxShadow: (theme) => theme.shadows[2]
          }}
        >
          <Typography
            variant="h4"
            component="h1"
            gutterBottom
            sx={{
              marginBottom: 3,
              textAlign: 'center',
              fontWeight: 'bold'
            }}
          >
            {t('donations.form.title')}
          </Typography>

          {error && (
            <Alert
              severity="error"
              onClose={() => setError(null)}
              sx={{ marginBottom: 3 }}
            >
              {error}
            </Alert>
          )}

          {loading && (
            <Alert
              severity="info"
              icon={<CircularProgress size={20} />}
              sx={{ marginBottom: 3 }}
            >
              {t('donations.processing')}
            </Alert>
          )}

          <ErrorBoundary
            fallback={
              <Alert severity="error">
                {t('donations.errors.unexpected')}
              </Alert>
            }
          >
            <DonationForm
              associationId={associationId}
              campaignId={campaignId}
              onSuccess={handleDonationSubmit}
              onError={handleDonationError}
              initialCurrency={initialCurrency}
            />
          </ErrorBoundary>

          {campaignId && progress > 0 && (
            <Alert
              severity="info"
              sx={{ marginTop: 2 }}
            >
              {t('donations.campaign.progress', { progress: Math.round(progress) })}
            </Alert>
          )}
        </Paper>
      </Container>
    </MainLayout>
  );
};

export default DonationFormPage;