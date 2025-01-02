import React from 'react'; // v18.2.0
import { CircularProgress, Box } from '@mui/material'; // v5.14.0
import { useTheme } from '@mui/material/styles'; // v5.14.0

/**
 * Props interface for the LoadingSpinner component
 */
interface LoadingSpinnerProps {
  /** Size in pixels for the spinner. Defaults to theme spacing unit * 4 */
  size?: number;
  /** Custom color for the spinner. Defaults to theme primary color */
  color?: string;
  /** Whether to display the spinner as a full-screen overlay */
  overlay?: boolean;
  /** Additional CSS class name for custom styling */
  className?: string;
  /** Accessibility label for screen readers */
  ariaLabel?: string;
}

/**
 * A reusable loading spinner component that provides visual feedback during
 * asynchronous operations. Follows Material Design principles and supports
 * theme customization with accessibility features.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = React.memo(({
  size,
  color,
  overlay = false,
  className = '',
  ariaLabel = 'Loading content'
}) => {
  const theme = useTheme();
  
  // Calculate final size based on theme spacing or provided size
  const spinnerSize = size || theme.spacing(4);
  
  // Base container styles
  const containerStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100px',
    position: 'relative' as const,
  };
  
  // Overlay styles when overlay prop is true
  const overlayStyles = overlay ? {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    zIndex: theme.zIndex.modal,
    backdropFilter: 'blur(2px)',
  } : {};
  
  // Combine styles based on props
  const combinedStyles = {
    ...containerStyles,
    ...overlayStyles,
  };
  
  // Spinner styles with theme integration
  const spinnerStyles = {
    color: color || theme.palette.primary.main,
    transition: 'all 0.3s ease',
  };

  return (
    <Box
      className={className}
      sx={combinedStyles}
      role="progressbar"
      aria-label={ariaLabel}
      aria-busy="true"
    >
      <CircularProgress
        size={spinnerSize}
        sx={spinnerStyles}
        aria-hidden="true"
      />
    </Box>
  );
});

// Display name for debugging purposes
LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;