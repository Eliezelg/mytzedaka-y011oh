/**
 * @fileoverview A reusable search bar component with real-time search functionality,
 * debouncing, internationalization support, Material Design styling, and accessibility features.
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react'; // v18.2.0
import { TextField, InputAdornment, IconButton } from '@mui/material'; // v5.14.0
import { SearchIcon, ClearIcon } from '@mui/icons-material'; // v5.14.0
import debounce from 'lodash/debounce'; // v4.17.21
import useLanguage from '../../hooks/useLanguage';
import LoadingSpinner from './LoadingSpinner';

/**
 * Props interface for SearchBar component with enhanced accessibility and loading state
 */
interface SearchBarProps {
  /** Callback function when search query changes */
  onSearch: (query: string) => void;
  /** Optional placeholder text override */
  placeholder?: string;
  /** Optional initial search value */
  initialValue?: string;
  /** Optional debounce delay in milliseconds */
  debounceMs?: number;
  /** Optional loading state flag */
  isLoading?: boolean;
  /** Optional CSS class name */
  className?: string;
  /** Optional ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * Enhanced search bar component with debouncing, RTL support, and accessibility features
 */
const SearchBar: React.FC<SearchBarProps> = React.memo(({
  onSearch,
  placeholder,
  initialValue = '',
  debounceMs = 300,
  isLoading = false,
  className = '',
  ariaLabel = 'Search input field'
}) => {
  // State and refs
  const [searchInput, setSearchInput] = useState<string>(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const { t, isRTL, direction } = useLanguage();

  // Create debounced search handler
  const debouncedSearch = useCallback(
    debounce((query: string) => {
      onSearch(query);
      // Update ARIA live region for screen readers
      const liveRegion = document.getElementById('search-live-region');
      if (liveRegion) {
        liveRegion.textContent = query 
          ? t('search.resultsUpdating') 
          : t('search.cleared');
      }
    }, debounceMs),
    [onSearch, t]
  );

  // Initialize ARIA live region
  useEffect(() => {
    if (!document.getElementById('search-live-region')) {
      const liveRegion = document.createElement('div');
      liveRegion.id = 'search-live-region';
      liveRegion.setAttribute('aria-live', 'polite');
      liveRegion.setAttribute('aria-atomic', 'true');
      liveRegion.className = 'visually-hidden';
      document.body.appendChild(liveRegion);
    }

    return () => {
      const liveRegion = document.getElementById('search-live-region');
      if (liveRegion) {
        document.body.removeChild(liveRegion);
      }
    };
  }, []);

  // Handle input changes
  const handleInputChange = useCallback((
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newValue = event.target.value;
    setSearchInput(newValue);
    debouncedSearch(newValue);
  }, [debouncedSearch]);

  // Handle clear button click
  const handleClear = useCallback(() => {
    setSearchInput('');
    debouncedSearch('');
    inputRef.current?.focus();
  }, [debouncedSearch]);

  // Handle keyboard interactions
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleClear();
    }
  }, [handleClear]);

  // Styles with RTL support
  const styles = {
    searchBar: {
      width: '100%',
      maxWidth: '600px',
      margin: '8px 0',
      position: 'relative' as const,
    },
    input: {
      '& .MuiOutlinedInput-root': {
        borderRadius: '24px',
        transition: 'all 0.2s ease',
        direction: direction,
      },
      '& .MuiOutlinedInput-input': {
        padding: '12px 14px',
        paddingInlineEnd: '88px',
      },
    },
    iconButton: {
      padding: '8px',
      position: 'absolute' as const,
      [isRTL ? 'left' : 'right']: '8px',
      top: '50%',
      transform: 'translateY(-50%)',
    },
    loadingSpinner: {
      position: 'absolute' as const,
      [isRTL ? 'left' : 'right']: '48px',
      top: '50%',
      transform: 'translateY(-50%)',
    },
  };

  return (
    <div className={className} style={styles.searchBar}>
      <TextField
        fullWidth
        inputRef={inputRef}
        value={searchInput}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || t('search.placeholder')}
        aria-label={ariaLabel}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: (
            <InputAdornment position="end">
              {isLoading && (
                <div style={styles.loadingSpinner}>
                  <LoadingSpinner size={24} />
                </div>
              )}
              {searchInput && (
                <IconButton
                  onClick={handleClear}
                  aria-label={t('search.clear')}
                  style={styles.iconButton}
                  size="small"
                >
                  <ClearIcon />
                </IconButton>
              )}
            </InputAdornment>
          ),
        }}
        sx={styles.input}
      />
    </div>
  );
});

// Display name for debugging
SearchBar.displayName = 'SearchBar';

export default SearchBar;