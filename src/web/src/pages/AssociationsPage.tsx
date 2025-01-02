import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { 
  Container, 
  Box, 
  Typography, 
  MenuItem, 
  Select,
  Skeleton 
} from '@mui/material';

// Internal components
import AssociationList from '../components/associations/AssociationList';
import SearchBar from '../components/common/SearchBar';
import PageHeader from '../components/common/PageHeader';
import Pagination from '../components/common/Pagination';
import ErrorBoundary from '../components/common/ErrorBoundary';

// Hooks and data management
import { useAssociations } from '../hooks/useAssociations';

// Constants
const ITEMS_PER_PAGE = 12;
const FILTER_OPTIONS = {
  STATUS: ['ACTIVE', 'PENDING', 'UNDER_REVIEW'],
  CATEGORIES: ['EDUCATION', 'HEALTH', 'POVERTY', 'RELIGIOUS'],
};

/**
 * Main associations page component with enhanced filtering, search, and RTL support
 * Implements WCAG 2.1 Level AA accessibility standards
 */
const AssociationsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';

  // URL search params management
  const searchParams = new URLSearchParams(location.search);
  const initialPage = parseInt(searchParams.get('page') || '1', 10);
  const initialSearch = searchParams.get('search') || '';
  const initialStatus = searchParams.get('status') || '';
  const initialCategory = searchParams.get('category') || '';

  // Local state
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);

  // Fetch associations data
  const {
    associations,
    totalAssociations,
    isLoading,
    error,
    fetchAssociations,
    getLocalizedContent
  } = useAssociations({
    page: currentPage,
    limit: ITEMS_PER_PAGE,
    status: selectedStatus || undefined,
    category: selectedCategory || undefined,
  });

  // Update URL with current filters
  const updateUrlParams = useCallback(() => {
    const params = new URLSearchParams();
    if (currentPage > 1) params.set('page', currentPage.toString());
    if (searchTerm) params.set('search', searchTerm);
    if (selectedStatus) params.set('status', selectedStatus);
    if (selectedCategory) params.set('category', selectedCategory);
    
    navigate({ search: params.toString() }, { replace: true });
  }, [currentPage, searchTerm, selectedStatus, selectedCategory, navigate]);

  useEffect(() => {
    updateUrlParams();
  }, [updateUrlParams]);

  // Debounced search handler
  const handleSearch = useCallback(async (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
    await fetchAssociations({
      page: 1,
      search: term,
      status: selectedStatus,
      category: selectedCategory,
    });
  }, [fetchAssociations, selectedStatus, selectedCategory]);

  // Filter handlers
  const handleStatusChange = useCallback(async (event: React.ChangeEvent<{ value: unknown }>) => {
    const status = event.target.value as string;
    setSelectedStatus(status);
    setCurrentPage(1);
    await fetchAssociations({
      page: 1,
      search: searchTerm,
      status,
      category: selectedCategory,
    });
  }, [fetchAssociations, searchTerm, selectedCategory]);

  const handleCategoryChange = useCallback(async (event: React.ChangeEvent<{ value: unknown }>) => {
    const category = event.target.value as string;
    setSelectedCategory(category);
    setCurrentPage(1);
    await fetchAssociations({
      page: 1,
      search: searchTerm,
      status: selectedStatus,
      category,
    });
  }, [fetchAssociations, searchTerm, selectedStatus]);

  // Page change handler
  const handlePageChange = useCallback(async (page: number) => {
    setCurrentPage(page);
    await fetchAssociations({
      page,
      search: searchTerm,
      status: selectedStatus,
      category: selectedCategory,
    });
  }, [fetchAssociations, searchTerm, selectedStatus, selectedCategory]);

  // Association click handler
  const handleAssociationClick = useCallback((id: string) => {
    navigate(`/associations/${id}`);
  }, [navigate]);

  // Memoized filter components
  const filterControls = useMemo(() => (
    <Box
      sx={{
        display: 'flex',
        gap: 2,
        mb: 3,
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'stretch', sm: 'center' },
      }}
    >
      <Select
        value={selectedStatus}
        onChange={handleStatusChange}
        displayEmpty
        sx={{ minWidth: 200 }}
        aria-label={t('associations.statusFilter')}
      >
        <MenuItem value="">{t('associations.allStatuses')}</MenuItem>
        {FILTER_OPTIONS.STATUS.map(status => (
          <MenuItem key={status} value={status}>
            {t(`associations.status.${status.toLowerCase()}`)}
          </MenuItem>
        ))}
      </Select>

      <Select
        value={selectedCategory}
        onChange={handleCategoryChange}
        displayEmpty
        sx={{ minWidth: 200 }}
        aria-label={t('associations.categoryFilter')}
      >
        <MenuItem value="">{t('associations.allCategories')}</MenuItem>
        {FILTER_OPTIONS.CATEGORIES.map(category => (
          <MenuItem key={category} value={category}>
            {t(`associations.categories.${category.toLowerCase()}`)}
          </MenuItem>
        ))}
      </Select>
    </Box>
  ), [selectedStatus, selectedCategory, handleStatusChange, handleCategoryChange, t]);

  return (
    <ErrorBoundary
      culturalConfig={{
        direction: isRTL ? 'rtl' : 'ltr',
        translations: {
          errorTitle: t('errors.associations.title'),
          errorMessage: t('errors.associations.message'),
          dismissButton: t('common.retry'),
        },
      }}
    >
      <Container maxWidth="lg" sx={{ py: 3 }}>
        <PageHeader
          title={t('associations.pageTitle')}
          subtitle={t('associations.pageDescription')}
          showSearch
          searchLoading={isLoading}
          onSearch={handleSearch}
          breadcrumbs={[
            { label: t('common.home'), path: '/' },
            { label: t('associations.title'), path: '/associations' },
          ]}
        />

        {filterControls}

        <AssociationList
          onAssociationClick={handleAssociationClick}
          filters={{
            status: selectedStatus,
            category: selectedCategory,
            search: searchTerm,
          }}
          pageSize={ITEMS_PER_PAGE}
          virtualize={totalAssociations > 100}
        />

        <Pagination
          totalItems={totalAssociations}
          itemsPerPage={ITEMS_PER_PAGE}
          currentPage={currentPage}
          onPageChange={handlePageChange}
          ariaLabel={t('accessibility.associationsPagination')}
        />
      </Container>
    </ErrorBoundary>
  );
};

AssociationsPage.displayName = 'AssociationsPage';

export default AssociationsPage;