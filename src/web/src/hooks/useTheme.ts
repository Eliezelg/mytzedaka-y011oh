import { useEffect, useCallback } from 'react'; // react v18.2.0
import { useMediaQuery } from '@mui/material'; // @mui/material v5.14.0
import { useThemeContext } from '../contexts/ThemeContext';

// Constants for theme management
const THEME_STORAGE_KEY = 'ijap-theme-mode';
const TRANSITION_DURATION = 300;

/**
 * Custom hook for managing theme preferences with support for:
 * - Material Design 3.0 with Jewish cultural elements
 * - Light/Dark mode with system preference detection
 * - RTL support for Hebrew content
 * - Theme persistence
 * - Smooth theme transitions
 */
export const useTheme = () => {
  // Get theme context with error boundary check
  const { theme, toggleTheme: contextToggleTheme, isDarkMode, direction } = useThemeContext();

  // Detect system color scheme preference
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)', {
    noSsr: true, // Prevent hydration mismatch
  });

  // Sync with system preference changes when no stored preference exists
  useEffect(() => {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (!storedTheme && prefersDarkMode !== isDarkMode) {
      contextToggleTheme();
    }
  }, [prefersDarkMode, isDarkMode, contextToggleTheme]);

  // Memoized theme toggle with smooth transition
  const toggleTheme = useCallback(() => {
    // Add transition class for smooth color changes
    document.body.style.transition = `background-color ${TRANSITION_DURATION}ms cubic-bezier(0.4, 0, 0.2, 1)`;
    
    // Toggle theme
    contextToggleTheme();
    
    // Store preference
    localStorage.setItem(THEME_STORAGE_KEY, !isDarkMode ? 'dark' : 'light');
    
    // Remove transition after animation completes
    setTimeout(() => {
      document.body.style.transition = '';
    }, TRANSITION_DURATION);
  }, [contextToggleTheme, isDarkMode]);

  return {
    theme, // Theme object with Material Design 3.0 tokens and Jewish cultural elements
    toggleTheme, // Memoized theme toggle function
    isDarkMode, // Current theme mode
    direction, // Text direction for RTL support
  };
};