import React, { useMemo } from 'react';
import { 
  Card, 
  CardContent, 
  CardMedia, 
  Typography, 
  Button, 
  Box, 
  Chip, 
  Tooltip,
  Skeleton 
} from '@mui/material'; // v5.14.0
import { useTheme, styled } from '@mui/material/styles'; // v5.14.0
import { ICampaign } from '../../interfaces/campaign.interface';
import { CampaignProgress } from './CampaignProgress';
import { formatCurrency } from '../../utils/currency.utils';

interface CampaignCardProps {
  campaign: ICampaign;
  onDonate: (campaignId: string) => void;
  className?: string;
  loading?: boolean;
  showAnimation?: boolean;
}

// Styled components for enhanced visual presentation
const StyledCard = styled(Card)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  transition: 'transform 0.2s ease-in-out',
  '&:hover': {
    transform: 'translateY(-4px)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    '&:hover': {
      transform: 'none',
    },
  },
}));

const StyledCardMedia = styled(CardMedia)({
  paddingTop: '56.25%', // 16:9 aspect ratio
  position: 'relative',
});

const LotteryBadge = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  top: theme.spacing(1),
  right: theme.spacing(1),
  zIndex: 1,
}));

/**
 * Truncates description text with RTL support
 */
const truncateDescription = (text: string, maxLength: number, isRTL: boolean): string => {
  if (text.length <= maxLength) return text;
  const ellipsis = isRTL ? '...' : '...';
  return text.substring(0, maxLength - 3) + ellipsis;
};

/**
 * Determines lottery campaign status and display properties
 */
const getLotteryStatus = (campaign: ICampaign) => {
  if (!campaign.isLottery || !campaign.lotteryDetails) return null;

  const now = new Date();
  const drawDate = new Date(campaign.lotteryDetails.drawDate);
  const timeRemaining = drawDate.getTime() - now.getTime();
  const daysRemaining = Math.ceil(timeRemaining / (1000 * 60 * 60 * 24));

  if (timeRemaining <= 0) {
    return { color: 'default', label: 'Draw Completed' };
  }
  if (daysRemaining <= 3) {
    return { color: 'error', label: `${daysRemaining} Days Left` };
  }
  return { color: 'primary', label: `Draw in ${daysRemaining} Days` };
};

const CampaignCard: React.FC<CampaignCardProps> = React.memo(({
  campaign,
  onDonate,
  className,
  loading = false,
  showAnimation = true,
}) => {
  const theme = useTheme();
  const isRTL = campaign.currency === 'ILS';
  
  const lotteryStatus = useMemo(() => 
    getLotteryStatus(campaign),
    [campaign.isLottery, campaign.lotteryDetails]
  );

  if (loading) {
    return (
      <StyledCard className={className}>
        <Skeleton variant="rectangular" height={200} />
        <CardContent>
          <Skeleton variant="text" height={32} width="80%" />
          <Skeleton variant="text" height={20} width="100%" />
          <Skeleton variant="text" height={20} width="90%" />
          <Box sx={{ my: 2 }}>
            <Skeleton variant="rectangular" height={8} width="100%" />
          </Box>
          <Skeleton variant="rectangular" height={36} width="100%" />
        </CardContent>
      </StyledCard>
    );
  }

  const truncatedDescription = truncateDescription(
    campaign.description,
    120,
    isRTL
  );

  return (
    <StyledCard 
      className={className}
      component="article"
      dir={isRTL ? 'rtl' : 'ltr'}
      aria-labelledby={`campaign-title-${campaign.id}`}
    >
      <StyledCardMedia
        image={campaign.images?.[0]?.url || '/assets/campaign-placeholder.jpg'}
        title={campaign.images?.[0]?.altText || campaign.title}
        aria-label={campaign.images?.[0]?.ariaLabel || `Image for ${campaign.title}`}
      >
        {campaign.isLottery && lotteryStatus && (
          <Tooltip 
            title={campaign.lotteryDetails?.termsAndConditions || ''}
            placement={isRTL ? 'left' : 'right'}
          >
            <LotteryBadge
              label={lotteryStatus.label}
              color={lotteryStatus.color as any}
              size="small"
            />
          </Tooltip>
        )}
      </StyledCardMedia>

      <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography
          id={`campaign-title-${campaign.id}`}
          variant="h6"
          component="h2"
          gutterBottom
          sx={{ direction: isRTL ? 'rtl' : 'ltr' }}
        >
          {campaign.title}
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          paragraph
          sx={{ 
            mb: 2,
            direction: isRTL ? 'rtl' : 'ltr',
            minHeight: '3em'
          }}
        >
          {truncatedDescription}
        </Typography>

        <CampaignProgress
          campaign={campaign}
          showPercentage
          showAnimation={showAnimation}
          className="campaign-progress"
        />

        {campaign.isLottery && campaign.lotteryDetails && (
          <Box sx={{ mt: 2, mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Ticket Price: {formatCurrency(
                campaign.lotteryDetails.ticketPrice,
                campaign.lotteryDetails.currency
              )}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Tickets Remaining: {campaign.lotteryDetails.remainingTickets}
            </Typography>
          </Box>
        )}

        <Button
          variant="contained"
          fullWidth
          onClick={() => onDonate(campaign.id)}
          sx={{ mt: 'auto', pt: 1, pb: 1 }}
          aria-label={`Donate to ${campaign.title}`}
        >
          Donate Now
        </Button>
      </CardContent>
    </StyledCard>
  );
});

CampaignCard.displayName = 'CampaignCard';

export default CampaignCard;