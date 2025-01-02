/**
 * @fileoverview A reusable page header component that provides consistent header styling
 * and structure across different pages with Material Design 3.0 principles and RTL support
 * @version 1.0.0
 */

import React from 'react';
import {
  Box,
  Typography,
  Breadcrumbs,
  Stack,
  Skeleton,
  Link,
} from '@mui/material'; // v5.14.0
import { styled } from '@mui/material/styles'; // v5.14.0
import SearchBar from './SearchBar';
import useLanguage from '../../hooks/useLanguage';

/**
 * Props interface for PageHeader component
 */
interface PageHeaderProps {
  /** Main title of the page */
  title: string;
  /** Optional subtitle or description text */
  subtitle?: string;
  /** Whether to show search bar */
  showSearch?: boolean;
  /** Loading state for search functionality */
  searchLoading?: boolean;
  /** Async search callback function */
  onSearch?: (searchTerm: string) => Promise<void>;
  /** Breadcrumb navigation items with accessibility support */
  breadcrumbs?: Array<{
    label: string;
    path: string;
    ariaLabel?: string;
  }>;
  /** Action buttons or additional elements */
  actions?: React.ReactNode;
  /** Additional CSS class name */
  className?: string;
}

// RTL-aware styled components
const HeaderContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isRTL',
})<{ isRTL: boolean }>(({ theme, isRTL }) => ({
  marginBottom: theme.spacing(3),
  padding: theme.spacing(2, 3),
  direction: isRTL ? 'rtl' : 'ltr',
  borderBottom: '1px solid',
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
}));

const TitleSection = styled(Stack)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(0.5),
  marginBottom: theme.spacing(2),
}));

const ActionSection = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isRTL',
})<{ isRTL: boolean }>(({ theme, isRTL }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  justifyContent: isRTL ? 'flex-start' : 'flex-end',
  alignItems: 'center',
  marginTop: theme.spacing(2),
}));

/**
 * Memoized page header component with error boundary and loading state support
 */
const PageHeader: React.FC<PageHeaderProps> = React.memo(({
  title,
  subtitle,
  showSearch = false,
  searchLoading = false,
  onSearch,
  breadcrumbs,
  actions,
  className,
}) => {
  const { isRTL, currentLanguage } = useLanguage();

  // Render breadcrumbs if provided
  const renderBreadcrumbs = () => {
    if (!breadcrumbs?.length) return null;

    return (
      <Breadcrumbs aria-label="page navigation" sx={{ mb: 2 }}>
        {breadcrumbs.map(({ label, path, ariaLabel }, index) => (
          <Link
            key={path}
            href={path}
            color={index === breadcrumbs.length - 1 ? 'text.primary' : 'inherit'}
            aria-label={ariaLabel || label}
            underline="hover"
            sx={{
              cursor: 'pointer',
              fontWeight: index === breadcrumbs.length - 1 ? 'bold' : 'normal',
            }}
          >
            {label}
          </Link>
        ))}
      </Breadcrumbs>
    );
  };

  // Render loading skeleton when content is loading
  const renderSkeleton = () => (
    <HeaderContainer isRTL={isRTL}>
      <Skeleton variant="text" width="60%" height={40} />
      <Skeleton variant="text" width="40%" height={24} />
      <Skeleton variant="rectangular" width="100%" height={48} />
    </HeaderContainer>
  );

  if (!title) return renderSkeleton();

  return (
    <HeaderContainer isRTL={isRTL} className={className}>
      {renderBreadcrumbs()}
      
      <TitleSection>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontWeight: 'bold',
            textAlign: isRTL ? 'right' : 'left',
          }}
        >
          {title}
        </Typography>
        
        {subtitle && (
          <Typography
            variant="subtitle1"
            color="text.secondary"
            sx={{ textAlign: isRTL ? 'right' : 'left' }}
          >
            {subtitle}
          </Typography>
        )}
      </TitleSection>

      {showSearch && (
        <SearchBar
          onSearch={onSearch || (() => Promise.resolve())}
          isLoading={searchLoading}
          ariaLabel={`Search ${title}`}
        />
      )}

      {actions && (
        <ActionSection isRTL={isRTL}>
          {actions}
        </ActionSection>
      )}
    </HeaderContainer>
  );
});

// Display name for debugging
PageHeader.displayName = 'PageHeader';

export default PageHeader;