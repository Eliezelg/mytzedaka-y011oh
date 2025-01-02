import React from 'react'; // @version 18.2.0
import { Box, Typography, SvgIcon } from '@mui/material'; // @version 5.14.0
import { lightTheme } from '../../config/theme';

interface EmptyStateProps {
  /** Required message to display in empty state, supports multilingual content */
  message: string;
  /** Optional icon component to display above message, culturally appropriate */
  icon?: React.ReactNode;
  /** Optional action component like a button for user interaction */
  action?: React.ReactNode;
  /** Optional CSS class name for custom styling integration */
  className?: string;
}

/**
 * A reusable empty state component that displays a message and optional icon
 * when no data is available or when a search returns no results.
 * Supports RTL layouts, theme switching, and meets accessibility standards.
 */
const EmptyState: React.FC<EmptyStateProps> = React.memo(({
  message,
  icon,
  action,
  className
}) => {
  return (
    <Box
      role="status"
      aria-label="Empty state"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: (theme) => theme.spacing(3),
        minHeight: '200px',
        textAlign: 'center',
        transition: (theme) => 
          `all ${theme.transitions.themeSwitch.duration}ms ${theme.transitions.themeSwitch.easing}`,
        direction: 'inherit',
        backgroundColor: (theme) => theme.palette.background.paper,
        borderRadius: (theme) => theme.shape.culturalBorderRadius,
      }}
      className={className}
    >
      {icon && (
        <Box
          sx={{
            fontSize: '64px',
            color: (theme) => theme.palette.text.secondary,
            marginBottom: (theme) => theme.spacing(2),
            transition: (theme) => 
              `color ${theme.transitions.themeSwitch.duration}ms ${theme.transitions.themeSwitch.easing}`,
            '& > svg': {
              width: '64px',
              height: '64px',
            }
          }}
        >
          {icon}
        </Box>
      )}

      <Typography
        variant="body1"
        sx={{
          color: (theme) => theme.palette.text.secondary,
          marginBottom: (theme) => theme.spacing(2),
          maxWidth: '80%',
          wordBreak: 'break-word',
          fontFamily: (theme) => theme.typography.hebrewFontFamily,
        }}
      >
        {message}
      </Typography>

      {action && (
        <Box
          sx={{
            marginTop: (theme) => theme.spacing(2),
            direction: 'inherit',
          }}
        >
          {action}
        </Box>
      )}
    </Box>
  );
});

EmptyState.displayName = 'EmptyState';

export default EmptyState;