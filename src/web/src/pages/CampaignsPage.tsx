/**
 * @fileoverview Enhanced campaigns page component with RTL support, filtering,
 * and real-time updates for the International Jewish Association Donation Platform
 * @version 1.0.0
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Container,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.0.0
import { useNavigate } from 'react-router-dom'; // v6.0.0
import { Helmet } from 'react-helmet'; // v6.1.0

// Internal components
import MainLayout from '../components/layout/MainLayout';
import CampaignList from '../components/campaigns/CampaignList';
import PageHeader from '../components/common/PageHeader';
import { useAuth } from '../hooks/useAuth';

/**
 * Enhanced campaigns page component with comprehensive features
 * and accessibility support
 */
const CampaignsPage: React.FC = () => {
  // Hooks initialization
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const isRTL = i18n.dir() === 'rtl';

  // State management
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Handle campaign selection with analytics tracking
  const handleCampaignSelect = useCallback((campaignId: string) => {
    // Track campaign selection
    if (window.gtag) {
      window.gtag('event', 'campaign_select', {
        campaign_id: campaignId,
        user_id: user?.id,
        language: i18n.language
      });
    }
    navigate(`/campaigns/${campaignId}`);
  }, [navigate, user, i18n.language]);

  // Handle campaign creation navigation
  const handleCreateCampaign = useCallback(() => {
    if (!isAuthenticated) {
      navigate('/login', { state: { from: '/campaigns/create' } });
      return;
    }
    navigate('/campaigns/create');
  }, [isAuthenticated, navigate]);

  // Render action buttons based on user role
  const renderActions = useCallback(() => {
    if (user?.role === 'association' || user?.role === 'admin') {
      return (
        <Button
          variant="contained"
          color="primary"
          onClick={handleCreateCampaign}
          aria-label={t('campaigns.actions.create')}
        >
          {t('campaigns.actions.create')}
        </Button>
      );
    }
    return null;
  }, [user?.role, handleCreateCampaign, t]);

  return (
    <MainLayout>
      <Helmet>
        <title>{t('campaigns.page.title')} | IJAD Platform</title>
        <meta name="description" content={t('campaigns.page.description')} />
        <meta property="og:title" content={t('campaigns.page.title')} />
        <meta property="og:description" content={t('campaigns.page.description')} />
        <html lang={i18n.language} dir={isRTL ? 'rtl' : 'ltr'} />
      </Helmet>

      <Container
        maxWidth="lg"
        sx={{
          mt: 3,
          mb: 3,
          direction: isRTL ? 'rtl' : 'ltr'
        }}
      >
        <PageHeader
          title={t('campaigns.page.title')}
          subtitle={t('campaigns.page.subtitle')}
          actions={renderActions()}
        />

        {error && (
          <Alert 
            severity="error" 
            onClose={() => setError(null)}
            sx={{ mb: 2 }}
          >
            {error}
          </Alert>
        )}

        {isLoading ? (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '200px'
            }}
          >
            <CircularProgress />
          </Box>
        ) : (
          <CampaignList
            showFilters={true}
            showPagination={true}
            itemsPerPage={12}
            onCampaignSelect={handleCampaignSelect}
            initialFilters={{
              currency: isRTL ? 'ILS' : undefined,
              sortBy: 'endDate',
              sortOrder: 'asc'
            }}
            virtualizeList={true}
          />
        )}
      </Container>
    </MainLayout>
  );
};

// Display name for debugging
CampaignsPage.displayName = 'CampaignsPage';

export default React.memo(CampaignsPage);