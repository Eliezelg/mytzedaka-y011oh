import React from 'react';
import { IconButton, Tooltip, styled } from '@mui/material'; // @mui/material v5.14.0
import { LightMode, DarkMode } from '@mui/icons-material'; // @mui/icons-material v5.14.0
import { useTheme } from '../../hooks/useTheme';

// Interface for component props
interface ThemeToggleProps {
  className?: string;
  size?: 'small' | 'medium' | 'large';
  disableTransition?: boolean;
}

// Styled IconButton with enhanced touch target and transitions
const StyledIconButton = styled(IconButton, {
  shouldForwardProp: (prop) => prop !== 'disableTransition',
})<{ disableTransition?: boolean }>(({ theme, disableTransition }) => ({
  minWidth: '48px', // WCAG touch target size
  minHeight: '48px', // WCAG touch target size
  borderRadius: theme.shape.borderRadius * 2,
  color: theme.palette.text.primary,
  backgroundColor: theme.palette.mode === 'dark' 
    ? 'rgba(255, 255, 255, 0.05)' 
    : 'rgba(0, 0, 0, 0.05)',
  '&:hover': {
    backgroundColor: theme.palette.mode === 'dark'
      ? 'rgba(255, 255, 255, 0.1)'
      : 'rgba(0, 0, 0, 0.1)',
  },
  transition: disableTransition ? 'none' : `all ${theme.transitions.themeSwitch.duration}ms ${theme.transitions.themeSwitch.easing}`,
  '& svg': {
    transition: disableTransition ? 'none' : `transform ${theme.transitions.themeSwitch.duration}ms ${theme.transitions.themeSwitch.easing}`,
    transform: 'rotate(0deg)',
  },
  '&:hover svg': {
    transform: 'rotate(30deg)',
  },
}));

/**
 * Enhanced theme toggle component with accessibility features and smooth transitions.
 * Supports keyboard navigation, screen readers, and follows Material Design 3.0 principles.
 */
const ThemeToggle = React.memo<ThemeToggleProps>(({
  className,
  size = 'medium',
  disableTransition = false,
}) => {
  const { isDarkMode, toggleTheme } = useTheme();

  // Tooltip text based on current theme
  const tooltipText = isDarkMode 
    ? 'Switch to light theme' 
    : 'Switch to dark theme';

  // ARIA label for screen readers
  const ariaLabel = isDarkMode
    ? 'Activate light theme'
    : 'Activate dark theme';

  // Handle keyboard events for accessibility
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTheme();
    }
  };

  return (
    <Tooltip 
      title={tooltipText}
      enterDelay={700}
      leaveDelay={200}
      placement="bottom"
      arrow
    >
      <StyledIconButton
        className={className}
        onClick={toggleTheme}
        onKeyDown={handleKeyDown}
        size={size}
        disableTransition={disableTransition}
        aria-label={ariaLabel}
        aria-pressed={isDarkMode}
        role="switch"
        color="inherit"
        data-testid="theme-toggle"
      >
        {isDarkMode ? (
          <DarkMode fontSize={size} />
        ) : (
          <LightMode fontSize={size} />
        )}
      </StyledIconButton>
    </Tooltip>
  );
});

// Display name for debugging
ThemeToggle.displayName = 'ThemeToggle';

export default ThemeToggle;