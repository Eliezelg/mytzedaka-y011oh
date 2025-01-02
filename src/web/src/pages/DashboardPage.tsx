import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
  Grid,
  Box,
  Typography,
  Card,
  CardContent,
  Skeleton,
  useTheme
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ErrorBoundary } from 'react-error-boundary';

import PageHeader from '../components/common/PageHeader';
import DonationSummary from '../components/donations/DonationSummary';
import CampaignList from '../components/campaigns/CampaignList';
import { useAuth } from '../hooks/useAuth';
import useLanguage from '../hooks/useLanguage';
import { formatCurrency } from '../utils/currency.utils';
import { IDonation } from '../interfaces/donation.interface';

// Dashboard metrics interface
interface DashboardMetrics {
  totalRaised: number;
  activeCampaigns: number;
  monthlyDonors: number;
  recentDonations: IDonation[];
  loading: boolean;
  error: Error | null;
}

const DashboardPage: React.FC = () => {
  const theme = useTheme();
  const { t } = useTranslation();
  const { user, role } = useAuth();
  const { isRTL, currentLanguage } = useLanguage();

  // Dashboard state
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalRaised: 0,
    activeCampaigns: 0,
    monthlyDonors: 0,
    recentDonations: [],
    loading: true,
    error: null
  });

  // WebSocket connection for real-time updates
  useEffect(() => {
    const ws = new WebSocket(`${process.env.REACT_APP_WS_URL}/dashboard`);

    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'METRICS_UPDATE') {
        setMetrics(prev => ({
          ...prev,
          ...update.data
        }));
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  // Fetch initial dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setMetrics(prev => ({ ...prev, loading: true, error: null }));
      
      // Simulated API call - replace with actual API integration
      const response = await fetch(`/api/dashboard/${role}`);
      const data = await response.json();
      
      setMetrics(prev => ({
        ...prev,
        ...data,
        loading: false
      }));
    } catch (error) {
      setMetrics(prev => ({
        ...prev,
        loading: false,
        error: error as Error
      }));
    }
  }, [role]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Memoized metric cards
  const MetricCard = useMemo(() => ({ title, value, loading }: { 
    title: string;
    value: string | number;
    loading?: boolean;
  }) => (
    <Card
      sx={{
        height: '100%',
        minHeight: 120,
        transition: 'all 0.3s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: theme.shadows[4]
        }
      }}
    >
      <CardContent>
        <Typography variant="h6" color="textSecondary" gutterBottom>
          {title}
        </Typography>
        {loading ? (
          <Skeleton variant="text" width="60%" height={40} />
        ) : (
          <Typography
            variant="h4"
            component="div"
            sx={{ fontWeight: 'bold' }}
            aria-live="polite"
          >
            {value}
          </Typography>
        )}
      </CardContent>
    </Card>
  ), [theme]);

  // Role-specific dashboard content
  const renderDashboardContent = () => {
    if (metrics.loading) {
      return (
        <Grid container spacing={3}>
          {[1, 2, 3].map((item) => (
            <Grid item xs={12} md={4} key={item}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      );
    }

    if (metrics.error) {
      return (
        <Typography color="error" align="center">
          {t('dashboard.error.loading')}
        </Typography>
      );
    }

    return (
      <>
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('dashboard.metrics.totalRaised')}
              value={formatCurrency(metrics.totalRaised, currentLanguage === 'he' ? 'ILS' : 'USD')}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('dashboard.metrics.activeCampaigns')}
              value={metrics.activeCampaigns}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <MetricCard
              title={t('dashboard.metrics.monthlyDonors')}
              value={metrics.monthlyDonors}
            />
          </Grid>
        </Grid>

        <Box mb={4}>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.recentDonations')}
          </Typography>
          <Grid container spacing={2}>
            {metrics.recentDonations.map((donation) => (
              <Grid item xs={12} key={donation.id}>
                <DonationSummary
                  donation={donation}
                  direction={isRTL ? 'rtl' : 'ltr'}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Box>
          <Typography variant="h6" gutterBottom>
            {t('dashboard.activeCampaigns')}
          </Typography>
          <CampaignList
            showFilters={false}
            itemsPerPage={6}
            onCampaignSelect={() => {}}
            virtualizeList={false}
          />
        </Box>
      </>
    );
  };

  return (
    <ErrorBoundary
      fallback={
        <Typography color="error" align="center">
          {t('dashboard.error.general')}
        </Typography>
      }
    >
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          py: 3,
          px: { xs: 2, md: 3 },
          direction: isRTL ? 'rtl' : 'ltr'
        }}
      >
        <PageHeader
          title={t('dashboard.welcome', { name: user?.firstName })}
          subtitle={t('dashboard.subtitle')}
        />
        {renderDashboardContent()}
      </Box>
    </ErrorBoundary>
  );
};

export default React.memo(DashboardPage);