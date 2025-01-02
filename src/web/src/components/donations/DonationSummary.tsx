import React, { memo, useCallback } from 'react';
import { Box, Typography, Chip, Stack, Divider, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import { AutoRenew as AutoRenewIcon } from '@mui/icons-material';

import { IDonation } from '../../interfaces/donation.interface';
import { PaymentStatus } from '../../interfaces/payment.interface';
import { formatCurrency } from '../../utils/currency.utils';
import useLanguage from '../../hooks/useLanguage';

// Props interface with enhanced accessibility support
interface DonationSummaryProps {
  donation: IDonation;
  showStatus?: boolean;
  className?: string;
  ariaLabel?: string;
}

// Styled components with RTL support
const SummaryContainer = styled(Box)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  border: `1px solid ${theme.palette.divider}`,
  direction: 'inherit',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    boxShadow: theme.shadows[1],
  },
}));

const AmountText = styled(Typography)(({ theme }) => ({
  fontWeight: 'bold',
  fontSize: '1.2rem',
  color: theme.palette.text.primary,
  textAlign: 'inherit',
}));

const StatusChip = styled(Chip)(({ theme }) => ({
  height: '24px',
  fontSize: '0.75rem',
  fontWeight: 'medium',
  margin: theme.spacing(0, 1),
}));

const RecurringIndicator = styled(Box)(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  color: theme.palette.primary.main,
  marginInlineStart: theme.spacing(1),
}));

// WCAG compliant status colors
const getStatusColor = (status: PaymentStatus): string => {
  switch (status) {
    case PaymentStatus.COMPLETED:
      return '#2e7d32'; // success.dark for better contrast
    case PaymentStatus.FAILED:
      return '#d32f2f'; // error.dark for better contrast
    case PaymentStatus.PENDING:
      return '#ed6c02'; // warning.dark for better contrast
    default:
      return '#757575'; // grey.600 for better contrast
  }
};

const DonationSummary: React.FC<DonationSummaryProps> = memo(({
  donation,
  showStatus = true,
  className,
  ariaLabel,
}) => {
  const { isRTL, currentLanguage } = useLanguage();

  const getStatusText = useCallback((status: PaymentStatus): string => {
    switch (status) {
      case PaymentStatus.COMPLETED:
        return 'Completed';
      case PaymentStatus.FAILED:
        return 'Failed';
      case PaymentStatus.PENDING:
        return 'Pending';
      case PaymentStatus.PROCESSING:
        return 'Processing';
      case PaymentStatus.REFUNDED:
        return 'Refunded';
      default:
        return 'Unknown';
    }
  }, []);

  const formattedAmount = formatCurrency(donation.amount, donation.currency);

  return (
    <SummaryContainer
      className={className}
      aria-label={ariaLabel || `Donation summary for ${formattedAmount}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <AmountText component="span">
            {formattedAmount}
          </AmountText>
          {donation.isRecurring && (
            <Tooltip title="Recurring donation" placement={isRTL ? 'left' : 'right'}>
              <RecurringIndicator
                role="img"
                aria-label="Recurring donation"
              >
                <AutoRenewIcon fontSize="small" />
              </RecurringIndicator>
            </Tooltip>
          )}
        </Stack>

        {showStatus && (
          <StatusChip
            label={getStatusText(donation.paymentStatus)}
            size="small"
            sx={{
              backgroundColor: getStatusColor(donation.paymentStatus),
              color: '#ffffff', // Ensuring WCAG contrast
            }}
            role="status"
            aria-label={`Payment status: ${getStatusText(donation.paymentStatus)}`}
          />
        )}
      </Stack>

      {donation.isRecurring && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography
            variant="caption"
            color="textSecondary"
            component="div"
            sx={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {`${donation.recurringFrequency?.charAt(0).toUpperCase()}${donation.recurringFrequency?.slice(1).toLowerCase()} recurring donation`}
          </Typography>
        </>
      )}
    </SummaryContainer>
  );
});

DonationSummary.displayName = 'DonationSummary';

export default DonationSummary;