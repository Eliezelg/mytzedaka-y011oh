// react v18.2.0
import React from 'react';
import AlertDialog from './AlertDialog';

// Interface for error reporting service
interface ErrorReportingService {
  captureError: (error: Error, errorInfo: React.ErrorInfo) => void;
  notifyResolution: (error: Error) => void;
}

// Interface for cultural configuration
interface CulturalConfig {
  direction: 'ltr' | 'rtl';
  translations: {
    errorTitle: string;
    errorMessage: string;
    dismissButton: string;
  };
  observanceCheck?: () => boolean;
}

// Props interface with cultural support
interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  errorReportingService?: ErrorReportingService;
  culturalConfig?: CulturalConfig;
}

// Enhanced state interface
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  isRTL: boolean;
}

// Default cultural configuration
const defaultCulturalConfig: CulturalConfig = {
  direction: 'ltr',
  translations: {
    errorTitle: 'An Error Occurred',
    errorMessage: 'We apologize, but something went wrong. Please try again.',
    dismissButton: 'Dismiss',
  },
};

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private culturalConfig: CulturalConfig;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRTL: props.culturalConfig?.direction === 'rtl',
    };

    this.culturalConfig = {
      ...defaultCulturalConfig,
      ...props.culturalConfig,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
      errorInfo: null,
      isRTL: false, // Will be updated in componentDidCatch
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Update state with error details
    this.setState({
      errorInfo,
      isRTL: this.culturalConfig.direction === 'rtl',
    });

    // Report error if service is provided
    if (this.props.errorReportingService) {
      this.props.errorReportingService.captureError(error, errorInfo);
    }

    // Log error with cultural context
    console.error('Error caught by ErrorBoundary:', {
      error,
      errorInfo,
      culturalContext: {
        direction: this.culturalConfig.direction,
        isObservanceTime: this.culturalConfig.observanceCheck?.(),
      },
    });
  }

  handleErrorDismiss = (): void => {
    const { error } = this.state;
    const { errorReportingService } = this.props;

    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Notify error reporting service of resolution
    if (error && errorReportingService) {
      errorReportingService.notifyResolution(error);
    }
  };

  render(): React.ReactNode {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // Return custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Return culturally appropriate error dialog
      return (
        <AlertDialog
          open={hasError}
          title={this.culturalConfig.translations.errorTitle}
          message={
            <div>
              <p>{this.culturalConfig.translations.errorMessage}</p>
              {process.env.NODE_ENV === 'development' && (
                <details style={{ whiteSpace: 'pre-wrap' }}>
                  {error?.toString()}
                  <br />
                  {errorInfo?.componentStack}
                </details>
              )}
            </div>
          }
          severity="error"
          onClose={this.handleErrorDismiss}
          ariaLabel="Error notification"
          dir={this.culturalConfig.direction}
        />
      );
    }

    // Render children if no error
    return children;
  }
}

export default ErrorBoundary;