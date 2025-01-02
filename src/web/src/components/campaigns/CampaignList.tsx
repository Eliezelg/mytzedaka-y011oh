import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Grid, 
  Box, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel,
  useTheme 
} from '@mui/material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.0.0
import { useVirtualizer } from '@tanstack/react-virtual'; // v3.0.0

import CampaignCard from './CampaignCard';
import { useCampaigns } from '../../hooks/useCampaigns';
import LoadingSpinner from '../common/LoadingSpinner';
import EmptyState from '../common/EmptyState';
import Pagination from '../common/Pagination';
import { ICampaign } from '../../interfaces/campaign.interface';

interface CampaignListProps {
  showFilters?: boolean;
  showPagination?: boolean;
  itemsPerPage?: number;
  onCampaignSelect: (campaignId: string) => void;
  initialFilters?: CampaignFilters;
  virtualizeList?: boolean;
}

interface CampaignFilters {
  status?: string;
  currency?: string;
  isLottery?: boolean;
  sortBy?: 'endDate' | 'goalAmount' | 'currentAmount';
  sortOrder?: 'asc' | 'desc';
}

const CampaignList: React.FC<CampaignListProps> = ({
  showFilters = true,
  showPagination = true,
  itemsPerPage = 12,
  onCampaignSelect,
  initialFilters = {},
  virtualizeList = false
}) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const isRTL = theme.direction === 'rtl';

  // State management
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<CampaignFilters>(initialFilters);

  // Custom hook for campaign data
  const { 
    campaigns, 
    loading, 
    error, 
    fetchCampaigns, 
    retryFailedOperation 
  } = useCampaigns({
    autoLoad: true,
    filters,
    pagination: { page: currentPage, limit: itemsPerPage }
  });

  // Virtualization setup for large lists
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: campaigns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 350, // Estimated card height
    overscan: 5
  });

  // Memoized sorted and filtered campaigns
  const filteredCampaigns = useMemo(() => {
    let result = [...campaigns];
    
    if (filters.isLottery !== undefined) {
      result = result.filter(campaign => campaign.isLottery === filters.isLottery);
    }
    
    if (filters.currency) {
      result = result.filter(campaign => campaign.currency === filters.currency);
    }

    if (filters.sortBy) {
      result.sort((a, b) => {
        const aValue = a[filters.sortBy!];
        const bValue = b[filters.sortBy!];
        return filters.sortOrder === 'asc' ? 
          (aValue > bValue ? 1 : -1) : 
          (aValue < bValue ? 1 : -1);
      });
    }

    return result;
  }, [campaigns, filters]);

  // Debounced filter change handler
  const handleFilterChange = useCallback((event: React.ChangeEvent<{ value: unknown }>, filterType: keyof CampaignFilters) => {
    setFilters(prev => ({
      ...prev,
      [filterType]: event.target.value
    }));
    setCurrentPage(1);
  }, []);

  // Page change handler
  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
  }, []);

  // Donation click handler with analytics
  const handleDonateClick = useCallback((campaignId: string, isLottery: boolean) => {
    // Prevent event bubbling
    event?.preventDefault();
    event?.stopPropagation();

    // Track donation click
    if (window.gtag) {
      window.gtag('event', 'donate_click', {
        campaign_id: campaignId,
        campaign_type: isLottery ? 'lottery' : 'regular'
      });
    }

    onCampaignSelect(campaignId);
  }, [onCampaignSelect]);

  // Render filter controls
  const renderFilters = () => (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 3,
        flexWrap: 'wrap',
        direction: isRTL ? 'rtl' : 'ltr'
      }}
    >
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel id="campaign-type-label">
          {t('campaigns.filters.type')}
        </InputLabel>
        <Select
          labelId="campaign-type-label"
          value={filters.isLottery ?? ''}
          onChange={(e) => handleFilterChange(e, 'isLottery')}
          label={t('campaigns.filters.type')}
        >
          <MenuItem value="">{t('campaigns.filters.all')}</MenuItem>
          <MenuItem value="true">{t('campaigns.filters.lottery')}</MenuItem>
          <MenuItem value="false">{t('campaigns.filters.regular')}</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel id="currency-label">
          {t('campaigns.filters.currency')}
        </InputLabel>
        <Select
          labelId="currency-label"
          value={filters.currency ?? ''}
          onChange={(e) => handleFilterChange(e, 'currency')}
          label={t('campaigns.filters.currency')}
        >
          <MenuItem value="">{t('campaigns.filters.all')}</MenuItem>
          <MenuItem value="USD">USD</MenuItem>
          <MenuItem value="EUR">EUR</MenuItem>
          <MenuItem value="ILS">ILS</MenuItem>
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 120 }}>
        <InputLabel id="sort-label">
          {t('campaigns.filters.sortBy')}
        </InputLabel>
        <Select
          labelId="sort-label"
          value={filters.sortBy ?? ''}
          onChange={(e) => handleFilterChange(e, 'sortBy')}
          label={t('campaigns.filters.sortBy')}
        >
          <MenuItem value="endDate">{t('campaigns.filters.endDate')}</MenuItem>
          <MenuItem value="goalAmount">{t('campaigns.filters.goalAmount')}</MenuItem>
          <MenuItem value="currentAmount">{t('campaigns.filters.raised')}</MenuItem>
        </Select>
      </FormControl>
    </Box>
  );

  // Render campaign grid
  const renderCampaigns = () => {
    if (loading) {
      return <LoadingSpinner />;
    }

    if (error) {
      return (
        <EmptyState
          message={t('campaigns.errors.loading')}
          action={
            <button onClick={retryFailedOperation}>
              {t('common.retry')}
            </button>
          }
        />
      );
    }

    if (filteredCampaigns.length === 0) {
      return (
        <EmptyState
          message={t('campaigns.empty.message')}
          icon={<span role="img" aria-label="empty">📭</span>}
        />
      );
    }

    if (virtualizeList) {
      return (
        <Box
          ref={parentRef}
          sx={{
            height: '800px',
            overflow: 'auto'
          }}
        >
          <Grid
            container
            spacing={3}
            sx={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => (
              <Grid
                item
                xs={12}
                sm={6}
                md={4}
                key={filteredCampaigns[virtualRow.index].id}
                sx={{
                  position: 'absolute',
                  top: 0,
                  transform: `translateY(${virtualRow.start}px)`
                }}
              >
                <CampaignCard
                  campaign={filteredCampaigns[virtualRow.index]}
                  onDonate={handleDonateClick}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      );
    }

    return (
      <Grid container spacing={3}>
        {filteredCampaigns.map((campaign) => (
          <Grid item xs={12} sm={6} md={4} key={campaign.id}>
            <CampaignCard
              campaign={campaign}
              onDonate={handleDonateClick}
            />
          </Grid>
        ))}
      </Grid>
    );
  };

  return (
    <Box
      component="section"
      aria-label={t('campaigns.list.title')}
      sx={{ direction: isRTL ? 'rtl' : 'ltr' }}
    >
      {showFilters && renderFilters()}
      {renderCampaigns()}
      {showPagination && !virtualizeList && (
        <Pagination
          totalItems={filteredCampaigns.length}
          itemsPerPage={itemsPerPage}
          currentPage={currentPage}
          onPageChange={handlePageChange}
        />
      )}
    </Box>
  );
};

CampaignList.displayName = 'CampaignList';

export default React.memo(CampaignList);