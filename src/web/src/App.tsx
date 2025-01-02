/**
 * Root application component that provides global context providers and routing setup
 * with enhanced security, accessibility, and performance features
 * @version 1.0.0
 */

import React, { useEffect } from 'react';
import { BrowserRouter } from 'react-router-dom'; // ^6.15.0
import { CssBaseline } from '@mui/material'; // ^5.14.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal providers and components
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import MainLayout from './components/layout/MainLayout';

// Error fallback component
const ErrorFallback: React.FC<{ error: Error }> = ({ error }) => (
  <div role="alert">
    <h2>Application Error</h2>
    <pre>{error.message}</pre>
  </div>
);

/**
 * Enhanced root application component with comprehensive provider setup
 * and performance optimizations
 */
const App: React.FC = React.memo(() => {
  // Initialize performance monitoring
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      // Report web vitals
      const reportWebVitals = async () => {
        const { getCLS, getFID, getFCP, getLCP, getTTFB } = await import('web-vitals');
        getCLS(console.log);
        getFID(console.log);
        getFCP(console.log);
        getLCP(console.log);
        getTTFB(console.log);
      };
      reportWebVitals();
    }
  }, []);

  // Error boundary handler
  const handleError = (error: Error, info: { componentStack: string }) => {
    // Log error to monitoring service
    console.error('Application error:', error);
    console.error('Component stack:', info.componentStack);
  };

  return (
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={handleError}
        onReset={() => window.location.reload()}
      >
        <BrowserRouter>
          <LanguageProvider>
            <ThemeProvider>
              <AuthProvider>
                <CssBaseline />
                <MainLayout />
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
});

// Display name for debugging
App.displayName = 'App';

export default App;