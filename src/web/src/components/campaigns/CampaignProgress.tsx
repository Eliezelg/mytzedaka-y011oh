import React, { useMemo } from 'react';
import { LinearProgress, Box, Typography, Tooltip } from '@mui/material'; // v5.14.0
import { ICampaign } from '../../interfaces/campaign.interface';
import { formatCurrency } from '../../utils/currency.utils';

/**
 * Props interface for the CampaignProgress component
 */
interface CampaignProgressProps {
  /** Campaign object containing progress data */
  campaign: ICampaign;
  /** Optional flag to show/hide percentage display */
  showPercentage?: boolean;
  /** Optional CSS class name for styling */
  className?: string;
  /** Optional flag to show detailed progress tooltip */
  showTooltip?: boolean;
  /** Custom accessibility label */
  ariaLabel?: string;
}

/**
 * Calculates the campaign progress percentage
 * @param currentAmount - Current amount raised
 * @param goalAmount - Campaign goal amount
 * @returns Progress percentage between 0 and 100
 */
const calculateProgress = (currentAmount: number, goalAmount: number): number => {
  if (!goalAmount || goalAmount <= 0 || !currentAmount || currentAmount < 0) {
    return 0;
  }
  const percentage = (currentAmount / goalAmount) * 100;
  return Math.min(Math.round(percentage * 10) / 10, 100);
};

/**
 * CampaignProgress component displays fundraising progress with RTL support
 * and accessibility features
 */
const CampaignProgress: React.FC<CampaignProgressProps> = React.memo(({
  campaign,
  showPercentage = true,
  className = '',
  showTooltip = true,
  ariaLabel,
}) => {
  // Calculate progress percentage with memoization
  const progress = useMemo(() => 
    calculateProgress(campaign.currentAmount, campaign.goalAmount),
    [campaign.currentAmount, campaign.goalAmount]
  );

  // Determine if RTL based on currency
  const isRTL = campaign.currency === 'ILS';

  // Format currency amounts
  const formattedCurrent = formatCurrency(campaign.currentAmount, campaign.currency);
  const formattedGoal = formatCurrency(campaign.goalAmount, campaign.currency);

  // Prepare accessibility label
  const progressLabel = ariaLabel || 
    `Campaign progress: ${formattedCurrent} raised of ${formattedGoal} goal`;

  // Prepare tooltip content
  const tooltipContent = `${formattedCurrent} raised of ${formattedGoal} goal (${progress}%)`;

  return (
    <Box
      className={className}
      sx={{
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        direction: isRTL ? 'rtl' : 'ltr'
      }}
      role="region"
      aria-label={progressLabel}
    >
      <Tooltip
        title={showTooltip ? tooltipContent : ''}
        placement={isRTL ? 'right' : 'left'}
        arrow
      >
        <LinearProgress
          variant="determinate"
          value={progress}
          sx={{
            height: 8,
            borderRadius: 1,
            backgroundColor: 'action.disabledBackground',
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
            }
          }}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={tooltipContent}
        />
      </Tooltip>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          direction: isRTL ? 'rtl' : 'ltr'
        }}
      >
        <Typography
          variant="body2"
          component="span"
          sx={{ 
            fontWeight: 'medium',
            direction: isRTL ? 'rtl' : 'ltr'
          }}
        >
          {formattedCurrent}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          {showPercentage && (
            <Typography
              variant="body2"
              component="span"
              sx={{ opacity: 0.8 }}
              aria-label={`${progress}% complete`}
            >
              {progress}%
            </Typography>
          )}
          <Typography
            variant="body2"
            component="span"
            sx={{ 
              opacity: 0.8,
              direction: isRTL ? 'rtl' : 'ltr'
            }}
          >
            {formattedGoal}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
});

// Display name for debugging
CampaignProgress.displayName = 'CampaignProgress';

export default CampaignProgress;