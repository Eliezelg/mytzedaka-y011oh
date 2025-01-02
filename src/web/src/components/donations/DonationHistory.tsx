import React, { useEffect, useState, useCallback } from 'react'; // v18.2.0
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow, 
  Paper, 
  Typography, 
  Chip, 
  IconButton, 
  Box,
  Skeleton,
  useTheme
} from '@mui/material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.3.1
import { DownloadRounded, RefreshRounded } from '@mui/icons-material'; // v5.14.0

import { IDonation } from '../../interfaces/donation.interface';
import { useDonations } from '../../hooks/useDonations';
import CustomPagination from '../common/Pagination';

interface DonationHistoryProps {
  associationId?: string;
  itemsPerPage?: number;
  onError: (error: Error) => void;
  showReceipts?: boolean;
}

const DonationHistory: React.FC<DonationHistoryProps> = React.memo(({
  associationId,
  itemsPerPage = 10,
  onError,
  showReceipts = true
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof IDonation>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const {
    donations,
    loading,
    error,
    fetchUserDonations,
    fetchAssociationDonations,
    clearError
  } = useDonations();

  // Fetch donations based on context (user or association)
  const fetchDonations = useCallback(async () => {
    try {
      if (associationId) {
        await fetchAssociationDonations(associationId, currentPage, itemsPerPage);
      } else {
        await fetchUserDonations('current', currentPage, itemsPerPage);
      }
    } catch (err) {
      onError(err as Error);
    }
  }, [associationId, currentPage, itemsPerPage, fetchAssociationDonations, fetchUserDonations, onError]);

  // Initial load and WebSocket subscription
  useEffect(() => {
    fetchDonations();

    // WebSocket connection for real-time updates
    const ws = new WebSocket(process.env.REACT_APP_WS_URL || '');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'DONATION_STATUS_UPDATE') {
        fetchDonations();
      }
    };

    return () => {
      ws.close();
    };
  }, [fetchDonations]);

  // Error handling effect
  useEffect(() => {
    if (error) {
      onError(new Error(error));
      clearError();
    }
  }, [error, onError, clearError]);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((field: keyof IDonation) => {
    setSortDirection(current => field === sortField ? (current === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortField(field);
  }, [sortField]);

  // Status chip color mapping
  const getStatusColor = (status: string) => {
    const statusColors = {
      COMPLETED: 'success',
      PENDING: 'warning',
      FAILED: 'error',
      PROCESSING: 'info',
      REFUNDED: 'default'
    };
    return statusColors[status as keyof typeof statusColors] || 'default';
  };

  // Render loading skeleton
  if (loading) {
    return (
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        {[...Array(itemsPerPage)].map((_, index) => (
          <Skeleton
            key={index}
            variant="rectangular"
            height={53}
            sx={{ my: 0.5 }}
          />
        ))}
      </TableContainer>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        direction: theme.direction,
        '& .MuiTableCell-root': {
          direction: theme.direction
        }
      }}
    >
      <TableContainer 
        component={Paper} 
        sx={{ 
          mb: 2,
          boxShadow: theme.shadows[2],
          borderRadius: theme.shape.borderRadius
        }}
      >
        <Table aria-label={t('donations.history.table.aria-label')}>
          <TableHead>
            <TableRow>
              <TableCell 
                onClick={() => handleSortChange('createdAt')}
                sx={{ cursor: 'pointer' }}
                aria-sort={sortField === 'createdAt' ? sortDirection : undefined}
              >
                {t('donations.history.date')}
              </TableCell>
              <TableCell 
                onClick={() => handleSortChange('amount')}
                sx={{ cursor: 'pointer' }}
                aria-sort={sortField === 'amount' ? sortDirection : undefined}
              >
                {t('donations.history.amount')}
              </TableCell>
              <TableCell>{t('donations.history.status')}</TableCell>
              {showReceipts && (
                <TableCell align="right">{t('donations.history.receipt')}</TableCell>
              )}
            </TableRow>
          </TableHead>
          <TableBody>
            {donations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showReceipts ? 4 : 3}>
                  <Typography align="center" color="textSecondary">
                    {t('donations.history.no-donations')}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              donations.map((donation: IDonation) => (
                <TableRow 
                  key={donation.id}
                  sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                >
                  <TableCell>
                    {new Date(donation.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat(undefined, {
                      style: 'currency',
                      currency: donation.currency
                    }).format(donation.amount)}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t(`donations.status.${donation.paymentStatus.toLowerCase()}`)}
                      color={getStatusColor(donation.paymentStatus)}
                      size="small"
                    />
                  </TableCell>
                  {showReceipts && (
                    <TableCell align="right">
                      {donation.receiptUrl && (
                        <IconButton
                          aria-label={t('donations.history.download-receipt')}
                          onClick={() => window.open(donation.receiptUrl, '_blank')}
                          size="small"
                        >
                          <DownloadRounded />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CustomPagination
        totalItems={donations.length}
        itemsPerPage={itemsPerPage}
        currentPage={currentPage}
        onPageChange={handlePageChange}
        ariaLabel={t('donations.history.pagination.aria-label')}
      />
    </Box>
  );
});

DonationHistory.displayName = 'DonationHistory';

export default DonationHistory;