import React, { memo, useMemo } from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Skeleton,
  Box,
  useMediaQuery,
  useTheme
} from '@mui/material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.0.0
import VerifiedIcon from '@mui/icons-material/Verified'; // v5.14.0
import { IAssociation } from '../../interfaces/association.interface';
import CampaignProgress from '../campaigns/CampaignProgress';
import ErrorBoundary from '../common/ErrorBoundary';

/**
 * Props interface for AssociationCard component
 */
interface AssociationCardProps {
  /** Association data with campaign information */
  association: IAssociation;
  /** Click handler for card selection */
  onClick: (id: string) => void;
  /** Loading state indicator */
  isLoading?: boolean;
  /** Optional CSS class for custom styling */
  className?: string;
}

/**
 * Enhanced association card component with error handling and performance optimization
 */
const AssociationCard: React.FC<AssociationCardProps> = memo(({
  association,
  onClick,
  isLoading = false,
  className = ''
}) => {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isRTL = i18n.dir() === 'rtl';

  // Calculate total campaign progress
  const campaignStats = useMemo(() => {
    if (!association.campaigns?.length) {
      return { totalRaised: 0, totalGoal: 0 };
    }

    return association.campaigns.reduce((acc, campaign) => ({
      totalRaised: acc.totalRaised + campaign.currentAmount,
      totalGoal: acc.totalGoal + campaign.goalAmount
    }), { totalRaised: 0, totalGoal: 0 });
  }, [association.campaigns]);

  // Handle card click with accessibility
  const handleClick = () => {
    onClick(association.id);
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick(association.id);
    }
  };

  if (isLoading) {
    return (
      <Card 
        className={className}
        sx={styles.card}
        role="article"
        aria-busy="true"
      >
        <CardContent sx={styles.content}>
          <Skeleton variant="rectangular" width={80} height={80} sx={styles.logo} />
          <Skeleton variant="text" width="80%" height={32} />
          <Skeleton variant="text" width="100%" height={60} />
          <Skeleton variant="rectangular" width="100%" height={40} />
        </CardContent>
        <CardActions sx={styles.actions}>
          <Skeleton variant="rectangular" width={100} height={36} />
        </CardActions>
      </Card>
    );
  }

  return (
    <ErrorBoundary
      culturalConfig={{
        direction: isRTL ? 'rtl' : 'ltr',
        translations: {
          errorTitle: t('common.error'),
          errorMessage: t('errors.associationCard'),
          dismissButton: t('common.dismiss')
        }
      }}
    >
      <Card
        className={className}
        sx={styles.card}
        onClick={handleClick}
        onKeyPress={handleKeyPress}
        tabIndex={0}
        role="article"
        aria-label={t('accessibility.associationCard', { name: association.name })}
      >
        <CardContent sx={styles.content}>
          {association.logo && (
            <Box
              component="img"
              src={association.logo}
              alt={t('accessibility.associationLogo', { name: association.name })}
              sx={styles.logo}
              loading="lazy"
            />
          )}

          <Box sx={styles.title}>
            <Typography
              variant="h6"
              component="h2"
              sx={{ direction: isRTL ? 'rtl' : 'ltr' }}
            >
              {association.name}
            </Typography>
            {association.isVerified && (
              <VerifiedIcon
                sx={styles.verifiedBadge}
                aria-label={t('accessibility.verified')}
              />
            )}
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={styles.description}
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {association.description}
          </Typography>

          <Box sx={styles.status}>
            <Chip
              label={t(`association.status.${association.status.toLowerCase()}`)}
              color={association.status === 'ACTIVE' ? 'success' : 'default'}
              size={isMobile ? 'small' : 'medium'}
            />
          </Box>

          {campaignStats.totalGoal > 0 && (
            <CampaignProgress
              campaign={{
                currentAmount: campaignStats.totalRaised,
                goalAmount: campaignStats.totalGoal,
                currency: 'USD' // Default display currency
              }}
              showPercentage
              showTooltip
              ariaLabel={t('accessibility.campaignProgress')}
            />
          )}
        </CardContent>

        <CardActions sx={styles.actions}>
          <Button
            size={isMobile ? 'small' : 'medium'}
            variant="outlined"
            onClick={handleClick}
            aria-label={t('accessibility.learnMore', { name: association.name })}
          >
            {t('common.learnMore')}
          </Button>
          <Button
            size={isMobile ? 'small' : 'medium'}
            variant="contained"
            color="primary"
            onClick={handleClick}
            aria-label={t('accessibility.donate', { name: association.name })}
          >
            {t('common.donate')}
          </Button>
        </CardActions>
      </Card>
    </ErrorBoundary>
  );
});

const styles = {
  card: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    transition: 'all 0.3s ease',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
    }
  },
  logo: {
    width: {
      xs: 60,
      sm: 80,
      md: 100
    },
    height: 'auto',
    objectFit: 'contain',
    marginBottom: 2,
    transition: 'transform 0.3s ease'
  },
  content: {
    flexGrow: 1,
    padding: {
      xs: 1.5,
      sm: 2,
      md: 3
    },
    direction: 'inherit'
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    marginBottom: 1,
    fontWeight: 'bold'
  },
  description: {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: 2,
    minHeight: '4.5em'
  },
  status: {
    marginBottom: 2,
    direction: 'ltr'
  },
  actions: {
    padding: 2,
    justifyContent: 'space-between',
    borderTop: '1px solid rgba(0,0,0,0.1)'
  },
  verifiedBadge: {
    color: 'primary.main',
    marginLeft: 0.5
  }
} as const;

// Display name for debugging
AssociationCard.displayName = 'AssociationCard';

export default AssociationCard;