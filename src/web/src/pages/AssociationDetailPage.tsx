import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom'; // ^6.0.0
import { useTranslation } from 'react-i18next'; // ^12.0.0
import { Helmet } from 'react-helmet-async'; // ^1.3.0
import {
  Box,
  Grid,
  Typography,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Divider,
  useTheme,
  useMediaQuery
} from '@mui/material'; // ^5.14.0
import {
  Share as ShareIcon,
  LocationOn as LocationIcon,
  Phone as PhoneIcon,
  Email as EmailIcon,
  Language as WebsiteIcon
} from '@mui/icons-material'; // ^5.14.0

import { useAssociations } from '../../hooks/useAssociations';
import CampaignList from '../../components/campaigns/CampaignList';
import ErrorBoundary from '../../components/common/ErrorBoundary';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';

import { IAssociation, IAssociationStatus } from '../../interfaces/association.interface';

interface AssociationStats {
  totalDonations: number;
  totalDonors: number;
  activeCampaigns: number;
  successfulCampaigns: number;
}

const AssociationDetailPage: React.FC = () => {
  // Hooks
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isRTL = theme.direction === 'rtl';

  // State
  const [association, setAssociation] = useState<IAssociation | null>(null);
  const [stats, setStats] = useState<AssociationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Custom hooks
  const { getAssociationDetails, getAssociationStats } = useAssociations();

  // Fetch association data
  useEffect(() => {
    const fetchAssociationData = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const [associationData, statsData] = await Promise.all([
          getAssociationDetails(id),
          getAssociationStats(id)
        ]);
        setAssociation(associationData);
        setStats(statsData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load association details');
      } finally {
        setLoading(false);
      }
    };

    fetchAssociationData();
  }, [id, getAssociationDetails, getAssociationStats]);

  // Handlers
  const handleCampaignSelect = useCallback((campaignId: string) => {
    navigate(`/campaigns/${campaignId}`);
  }, [navigate]);

  const handleDonateClick = useCallback(() => {
    if (!association) return;
    navigate(`/donate/${association.id}`);
  }, [association, navigate]);

  const handleShare = useCallback(async () => {
    if (!association) return;

    const shareData = {
      title: association.name[theme.direction === 'rtl' ? 'he' : 'en'],
      text: association.description[theme.direction === 'rtl' ? 'he' : 'en'],
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        // Show success toast (implementation depends on your toast system)
      }
    } catch (err) {
      console.error('Share failed:', err);
    }
  }, [association, theme.direction]);

  // Render loading state
  if (loading) {
    return <LoadingSpinner overlay />;
  }

  // Render error state
  if (error || !association) {
    return (
      <EmptyState
        message={t('associations.errors.loading')}
        icon="🏛️"
        action={
          <Button
            variant="contained"
            onClick={() => navigate('/associations')}
          >
            {t('common.backToList')}
          </Button>
        }
      />
    );
  }

  // Get localized content
  const name = association.name[isRTL ? 'he' : 'en'];
  const description = association.description[isRTL ? 'he' : 'en'];

  return (
    <ErrorBoundary>
      <Helmet>
        <title>{`${name} - ${t('associations.detail.title')}`}</title>
        <meta name="description" content={description} />
      </Helmet>

      <Box sx={{ padding: theme.spacing(3) }}>
        {/* Header Section */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={8}>
            <Typography variant="h1" gutterBottom>
              {name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
              <Chip
                label={t(`associations.status.${association.status.toLowerCase()}`)}
                color={association.status === IAssociationStatus.ACTIVE ? 'success' : 'default'}
              />
              {association.isVerified && (
                <Chip
                  label={t('associations.verified')}
                  color="primary"
                />
              )}
            </Box>
          </Grid>
          <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
            <Button
              variant="contained"
              color="primary"
              size="large"
              onClick={handleDonateClick}
              sx={{ minWidth: 120 }}
            >
              {t('common.donate')}
            </Button>
            <IconButton
              aria-label={t('common.share')}
              onClick={handleShare}
              sx={{ alignSelf: 'center' }}
            >
              <ShareIcon />
            </IconButton>
          </Grid>
        </Grid>

        {/* Stats Cards */}
        <Grid container spacing={2} sx={{ mb: 4 }}>
          {stats && (
            <>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4">{stats.totalDonations}</Typography>
                    <Typography variant="body2">{t('associations.stats.donations')}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4">{stats.totalDonors}</Typography>
                    <Typography variant="body2">{t('associations.stats.donors')}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4">{stats.activeCampaigns}</Typography>
                    <Typography variant="body2">{t('associations.stats.activeCampaigns')}</Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Card>
                  <CardContent>
                    <Typography variant="h4">{stats.successfulCampaigns}</Typography>
                    <Typography variant="body2">{t('associations.stats.successfulCampaigns')}</Typography>
                  </CardContent>
                </Card>
              </Grid>
            </>
          )}
        </Grid>

        {/* Description and Contact Info */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} md={8}>
            <Typography variant="body1" paragraph>
              {description}
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  {t('associations.contact.title')}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationIcon />
                    <Typography>
                      {association.address.street}, {association.address.city}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PhoneIcon />
                    <Typography>{association.phone}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <EmailIcon />
                    <Typography>{association.email}</Typography>
                  </Box>
                  {association.website && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <WebsiteIcon />
                      <Typography>{association.website}</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 4 }} />

        {/* Active Campaigns */}
        <Typography variant="h2" gutterBottom>
          {t('associations.campaigns.title')}
        </Typography>
        <CampaignList
          showFilters={!isMobile}
          showPagination
          virtualScroll={false}
          onCampaignSelect={handleCampaignSelect}
        />
      </Box>
    </ErrorBoundary>
  );
};

export default AssociationDetailPage;