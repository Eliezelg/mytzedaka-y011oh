/**
 * @fileoverview Accessible language selector component with RTL support
 * @version 1.0.0
 */

import React, { useCallback, useMemo } from 'react';
import { FormControl, Select, MenuItem } from '@mui/material'; // v5.14.0
import useLanguage from '../../hooks/useLanguage';
import { SUPPORTED_LANGUAGES } from '../../config/constants';

/**
 * Props interface for the LanguageSelector component
 */
interface LanguageSelectorProps {
  variant?: 'standard' | 'outlined' | 'filled';
  className?: string;
  size?: 'small' | 'medium' | 'large';
}

/**
 * Language display names with proper RTL markers for Hebrew
 */
const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  he: '\u202Bעברית\u202C', // RTL markers for proper text direction
  fr: 'Français',
} as const;

/**
 * Transition duration for smooth language/direction changes
 */
const TRANSITION_DURATION = 300;

/**
 * Language selector component with accessibility and RTL support
 */
const LanguageSelector: React.FC<LanguageSelectorProps> = React.memo(({
  variant = 'outlined',
  className,
  size = 'medium'
}) => {
  const { currentLanguage, changeLanguage, isRTL } = useLanguage();

  /**
   * Memoized function to get localized language display name
   */
  const getLanguageLabel = useCallback((languageCode: string): string => {
    return LANGUAGE_LABELS[languageCode] || languageCode;
  }, []);

  /**
   * Memoized styles for RTL support
   */
  const selectStyles = useMemo(() => ({
    transition: `all ${TRANSITION_DURATION}ms ease-in-out`,
    '& .MuiSelect-icon': {
      transition: `transform ${TRANSITION_DURATION}ms ease-in-out`,
      transform: isRTL ? 'rotate(180deg)' : 'none',
    },
  }), [isRTL]);

  /**
   * Handle language change with type safety
   */
  const handleLanguageChange = useCallback((
    event: React.ChangeEvent<{ value: unknown }>
  ) => {
    const newLanguage = event.target.value as typeof SUPPORTED_LANGUAGES[number];
    if (SUPPORTED_LANGUAGES.includes(newLanguage)) {
      changeLanguage(newLanguage);
    }
  }, [changeLanguage]);

  return (
    <FormControl
      variant={variant}
      size={size}
      className={className}
      sx={{ minWidth: 120 }}
    >
      <Select
        value={currentLanguage}
        onChange={handleLanguageChange}
        sx={selectStyles}
        aria-label="Select language"
        MenuProps={{
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: isRTL ? 'right' : 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: isRTL ? 'right' : 'left',
          },
          sx: {
            '& .MuiPaper-root': {
              direction: isRTL ? 'rtl' : 'ltr',
            },
          },
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <MenuItem
            key={lang}
            value={lang}
            dir={lang === 'he' ? 'rtl' : 'ltr'}
            sx={{
              justifyContent: isRTL ? 'flex-end' : 'flex-start',
            }}
          >
            {getLanguageLabel(lang)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
});

// Display name for debugging
LanguageSelector.displayName = 'LanguageSelector';

export default LanguageSelector;