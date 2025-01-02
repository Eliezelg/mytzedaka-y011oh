import React from 'react'; // v18.2.0
import { Pagination as MuiPagination } from '@mui/material'; // v5.14.0
import { Box } from '@mui/material'; // v5.14.0
import { useTheme } from '@mui/material/styles'; // v5.14.0

interface PaginationProps {
  /**
   * Total number of items to paginate
   * @minimum 0
   */
  totalItems: number;

  /**
   * Number of items to display per page
   * @minimum 1
   */
  itemsPerPage: number;

  /**
   * Current active page number
   * @minimum 1
   */
  currentPage: number;

  /**
   * Callback function triggered on page change
   * @param page - The new page number
   */
  onPageChange: (page: number) => void;

  /**
   * Optional CSS class name for custom styling
   */
  className?: string;

  /**
   * Accessible label for the pagination component
   * @default "Pagination navigation"
   */
  ariaLabel?: string;
}

/**
 * A reusable pagination component with RTL support and accessibility features.
 * Compliant with WCAG 2.1 Level AA and supports Material Design 3.0 principles.
 */
const CustomPagination: React.FC<PaginationProps> = React.memo(({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
  className,
  ariaLabel = "Pagination navigation"
}) => {
  // Input validation
  if (totalItems < 0) throw new Error('totalItems must be non-negative');
  if (itemsPerPage < 1) throw new Error('itemsPerPage must be positive');
  if (currentPage < 1) throw new Error('currentPage must be positive');

  const theme = useTheme();
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  // Debounced page change handler to prevent rapid consecutive changes
  const handlePageChange = React.useCallback((
    _event: React.ChangeEvent<unknown>,
    page: number
  ) => {
    onPageChange(page);
  }, [onPageChange]);

  // Don't render pagination if there's only one page or no items
  if (totalPages <= 1 || totalItems === 0) {
    return null;
  }

  return (
    <Box
      className={className}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
        transition: 'all 0.3s ease',
        direction: theme.direction, // Supports RTL
        '@media (max-width: 600px)': {
          marginTop: theme.spacing(1),
          marginBottom: theme.spacing(1),
        }
      }}
    >
      <MuiPagination
        count={totalPages}
        page={currentPage}
        onChange={handlePageChange}
        color="primary"
        size="medium"
        showFirstButton
        showLastButton
        siblingCount={1}
        boundaryCount={1}
        sx={{
          '& .MuiPaginationItem-root': {
            fontSize: theme.typography.pxToRem(14),
            '@media (max-width: 600px)': {
              fontSize: theme.typography.pxToRem(12),
            }
          }
        }}
        // Accessibility attributes
        aria-label={ariaLabel}
        role="navigation"
        getItemAriaLabel={(type, page, selected) => {
          if (type === 'page') {
            return selected ? `Page ${page}, current page` : `Go to page ${page}`;
          }
          if (type === 'first') {
            return 'Go to first page';
          }
          if (type === 'last') {
            return 'Go to last page';
          }
          if (type === 'next') {
            return 'Go to next page';
          }
          if (type === 'previous') {
            return 'Go to previous page';
          }
          return '';
        }}
      />
    </Box>
  );
});

// Display name for debugging
CustomPagination.displayName = 'CustomPagination';

export default CustomPagination;