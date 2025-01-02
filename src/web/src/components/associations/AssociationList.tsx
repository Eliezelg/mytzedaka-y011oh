import React, { useCallback, useEffect, useRef } from 'react';
import { Grid, Box, CircularProgress } from '@mui/material'; // v5.14.0
import { useTranslation } from 'react-i18next'; // v12.0.0
import { VariableSizeList as VirtualList } from 'react-window'; // v1.8.9

import AssociationCard from './AssociationCard';
import EmptyState from '../common/EmptyState';
import { useAssociations } from '../../hooks/useAssociations';
import ErrorBoundary from '../common/ErrorBoundary';

interface AssociationListProps {
  onAssociationClick: (id: string) => void;
  filters?: {
    status?: string;
    category?: string;
    search?: string;
  };
  pageSize?: number;
  virtualize?: boolean;
}

const AssociationList: React.FC<AssociationListProps> = React.memo(({
  onAssociationClick,
  filters = {},
  pageSize = 12,
  virtualize = false
}) => {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.dir() === 'rtl';
  const listRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);

  const {
    associations,
    isLoading,
    error,
    totalCount,
    fetchAssociations,
    getLocalizedContent
  } = useAssociations({
    limit: pageSize,
    ...filters
  });

  // Handle infinite scroll
  const handleObserver = useCallback((entries: IntersectionObserverEntry[]) => {
    const target = entries[0];
    if (target.isIntersecting && !isLoading && associations.length < totalCount) {
      fetchAssociations({ page: Math.ceil(associations.length / pageSize) + 1 });
    }
  }, [isLoading, associations.length, totalCount, pageSize, fetchAssociations]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (loadingRef.current) {
      observerRef.current = new IntersectionObserver(handleObserver, {
        root: null,
        rootMargin: '20px',
        threshold: 0.1
      });
      observerRef.current.observe(loadingRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleObserver]);

  // Virtualization row renderer
  const rowRenderer = useCallback(({ index, style }) => {
    const association = associations[index];
    return (
      <div style={style}>
        <Grid item xs={12} sm={6} md={4} lg={3} sx={{ p: 1 }}>
          <AssociationCard
            association={{
              ...association,
              name: getLocalizedContent(association.name),
              description: getLocalizedContent(association.description)
            }}
            onClick={onAssociationClick}
            isLoading={isLoading}
          />
        </Grid>
      </div>
    );
  }, [associations, isLoading, onAssociationClick, getLocalizedContent]);

  // Error state
  if (error) {
    return (
      <ErrorBoundary
        culturalConfig={{
          direction: isRTL ? 'rtl' : 'ltr',
          translations: {
            errorTitle: t('errors.associationList.title'),
            errorMessage: t('errors.associationList.message'),
            dismissButton: t('common.retry')
          }
        }}
      >
        <EmptyState
          message={t('errors.associationList.message')}
          action={
            <button onClick={() => fetchAssociations()}>
              {t('common.retry')}
            </button>
          }
        />
      </ErrorBoundary>
    );
  }

  // Empty state
  if (!isLoading && associations.length === 0) {
    return (
      <EmptyState
        message={t('associations.emptyState')}
        icon={<span role="img" aria-label="empty">📭</span>}
      />
    );
  }

  return (
    <Box
      ref={listRef}
      sx={{
        width: '100%',
        direction: isRTL ? 'rtl' : 'ltr',
        minHeight: '200px'
      }}
      role="region"
      aria-label={t('accessibility.associationList')}
    >
      {virtualize ? (
        <VirtualList
          height={window.innerHeight}
          width="100%"
          itemCount={associations.length}
          itemSize={() => 350} // Approximate card height
          overscanCount={2}
        >
          {rowRenderer}
        </VirtualList>
      ) : (
        <Grid container spacing={2}>
          {associations.map((association) => (
            <Grid 
              item 
              xs={12} 
              sm={6} 
              md={4} 
              lg={3} 
              key={association.id}
            >
              <AssociationCard
                association={{
                  ...association,
                  name: getLocalizedContent(association.name),
                  description: getLocalizedContent(association.description)
                }}
                onClick={onAssociationClick}
                isLoading={isLoading}
              />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Loading indicator */}
      <Box
        ref={loadingRef}
        sx={{
          display: 'flex',
          justifyContent: 'center',
          p: 3,
          visibility: isLoading ? 'visible' : 'hidden'
        }}
        role="status"
        aria-label={t('accessibility.loading')}
      >
        <CircularProgress size={40} />
      </Box>
    </Box>
  );
});

AssociationList.displayName = 'AssociationList';

export default AssociationList;