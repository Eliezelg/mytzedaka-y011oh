import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Container, 
  Grid, 
  Typography, 
  Button, 
  Box, 
  CircularProgress, 
  Skeleton,
  Paper,
  Divider,
  Alert,
  IconButton,
  useTheme,
  useMediaQuery
} from '@mui/material'; // v5.14.0
import ShareIcon from '@mui/icons-material/Share'; // v5.14.0
import CalendarTodayIcon from '@mui/icons-material/CalendarToday'; // v5.14.0
import PeopleIcon from '@mui/icons-material/People'; // v5.14.0

import { ICampaign, CampaignStatus } from '../../interfaces/campaign.interface';
import CampaignProgress from '../../components/campaigns/CampaignProgress';
import { formatCurrency, isSupportedCurrency } from '../../utils/currency.utils';

// WebSocket connection for real-time updates
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:8080';

interface CampaignDetailPageProps {
  className?: string;
}

// Custom hook for campaign data management
const useCampaignData = (campaignId: string) => {
  const [campaign, setCampaign] = useState<ICampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    const fetchCampaign = async () => {
      try {
        const response = await fetch(`/api/v1/campaigns/${campaignId}`);
        if (!response.ok) throw new Error('Campaign not found');
        const data = await response.json();
        setCampaign(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch campaign'));
      } finally {
        setLoading(false);
      }
    };

    // Initialize WebSocket connection
    const socket = new WebSocket(`${WS_URL}/campaigns/${campaignId}`);
    
    socket.onmessage = (event) => {
      const update = JSON.parse(event.data);
      setCampaign(prev => prev ? { ...prev, ...update } : null);
    };

    socket.onerror = () => {
      setError(new Error('WebSocket connection failed'));
    };

    setWs(socket);
    fetchCampaign();

    return () => {
      socket.close();
    };
  }, [campaignId]);

  return { campaign, loading, error, ws };
};

const CampaignDetailPage: React.FC<CampaignDetailPageProps> = ({ className = '' }) => {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { campaign, loading, error, ws } = useCampaignData(campaignId || '');

  // Memoized currency formatting
  const formattedGoal = useMemo(() => {
    if (!campaign) return '';
    return formatCurrency(campaign.goalAmount, campaign.currency);
  }, [campaign]);

  // Handle social sharing
  const handleShare = useCallback(async () => {
    if (!campaign) return;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: campaign.title,
          text: campaign.socialShareText,
          url: campaign.shareableUrl
        });
      } catch (err) {
        console.error('Share failed:', err);
      }
    } else {
      // Fallback to clipboard copy
      navigator.clipboard.writeText(campaign.shareableUrl);
    }
  }, [campaign]);

  // Handle donation button click
  const handleDonate = useCallback(() => {
    if (!campaign) return;
    navigate(`/donate/${campaignId}`);
  }, [campaignId, navigate]);

  // Handle lottery ticket purchase
  const handleBuyTickets = useCallback(() => {
    if (!campaign?.isLottery) return;
    navigate(`/lottery/${campaignId}/tickets`);
  }, [campaignId, navigate]);

  if (error) {
    return (
      <Container maxWidth="lg" className={className}>
        <Alert severity="error" sx={{ mt: 4 }}>
          {error.message}
        </Alert>
      </Container>
    );
  }

  if (loading) {
    return (
      <Container maxWidth="lg" className={className}>
        <Box sx={{ mt: 4 }}>
          <Skeleton variant="rectangular" height={300} />
          <Skeleton variant="text" sx={{ mt: 2 }} />
          <Skeleton variant="text" />
          <Skeleton variant="rectangular" height={100} sx={{ mt: 2 }} />
        </Box>
      </Container>
    );
  }

  if (!campaign) {
    return (
      <Container maxWidth="lg" className={className}>
        <Alert severity="error" sx={{ mt: 4 }}>
          {t('campaign.notFound')}
        </Alert>
      </Container>
    );
  }

  const isRTL = campaign.currency === 'ILS';
  const direction = isRTL ? 'rtl' : 'ltr';

  return (
    <Container 
      maxWidth="lg" 
      className={className}
      sx={{ direction }}
    >
      <Grid container spacing={4} sx={{ mt: 2 }}>
        {/* Campaign Header */}
        <Grid item xs={12}>
          <Box sx={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            alignItems: 'center',
            flexDirection: isMobile ? 'column' : 'row',
            gap: 2
          }}>
            <Typography variant="h4" component="h1">
              {campaign.title}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <IconButton onClick={handleShare} aria-label={t('campaign.share')}>
                <ShareIcon />
              </IconButton>
            </Box>
          </Box>
        </Grid>

        {/* Campaign Media */}
        <Grid item xs={12} md={8}>
          {campaign.images.length > 0 && (
            <Box
              component="img"
              src={campaign.images[0].url}
              alt={campaign.images[0].altText}
              sx={{
                width: '100%',
                borderRadius: 2,
                maxHeight: 400,
                objectFit: 'cover'
              }}
            />
          )}
        </Grid>

        {/* Campaign Progress and Actions */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <CampaignProgress 
              campaign={campaign}
              showPercentage
              showTooltip
            />
            
            <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {campaign.status === CampaignStatus.ACTIVE && (
                <>
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    fullWidth
                    onClick={handleDonate}
                  >
                    {t('campaign.donate')}
                  </Button>

                  {campaign.isLottery && (
                    <Button
                      variant="outlined"
                      color="primary"
                      size="large"
                      fullWidth
                      onClick={handleBuyTickets}
                    >
                      {t('campaign.buyTickets')}
                    </Button>
                  )}
                </>
              )}
            </Box>

            {campaign.isLottery && campaign.lotteryDetails && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  {t('campaign.lotteryDetails')}
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Typography variant="body2">
                    {t('campaign.ticketPrice', {
                      price: formatCurrency(
                        campaign.lotteryDetails.ticketPrice,
                        campaign.lotteryDetails.currency
                      )
                    })}
                  </Typography>
                  <Typography variant="body2">
                    {t('campaign.ticketsRemaining', {
                      count: campaign.lotteryDetails.remainingTickets
                    })}
                  </Typography>
                  <Typography variant="body2">
                    {t('campaign.drawDate', {
                      date: new Date(campaign.lotteryDetails.drawDate)
                        .toLocaleDateString(undefined, { 
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })
                    })}
                  </Typography>
                </Box>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Campaign Description */}
        <Grid item xs={12}>
          <Typography 
            variant="body1"
            component="div"
            dangerouslySetInnerHTML={{ __html: campaign.description }}
            sx={{ direction }}
          />
        </Grid>

        {/* Campaign Categories */}
        <Grid item xs={12}>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {campaign.categories.map((category) => (
              <Chip
                key={category}
                label={t(`categories.${category}`)}
                size="small"
                sx={{ direction }}
              />
            ))}
          </Box>
        </Grid>
      </Grid>
    </Container>
  );
};

export default CampaignDetailPage;