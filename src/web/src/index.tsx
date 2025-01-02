/**
 * Entry point for the International Jewish Association Donation Platform web application
 * Sets up root component with providers, error boundaries, and performance monitoring
 * @version 1.0.0
 */

import React from 'react'; // ^18.2.0
import ReactDOM from 'react-dom/client'; // ^18.2.0
import { Provider } from 'react-redux'; // ^8.1.0
import { ErrorBoundary } from 'react-error-boundary'; // ^4.0.0

// Internal imports
import App from './App';
import { store } from './store/store';
import { lightTheme } from './config/theme';

// Constants
const ROOT_ELEMENT_ID = 'root';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * Renders the root application component with all required providers
 */
const renderApp = (): void => {
  // Get root element with error handling
  const rootElement = document.getElementById(ROOT_ELEMENT_ID);
  if (!rootElement) {
    throw new Error(`Unable to find root element with id "${ROOT_ELEMENT_ID}"`);
  }

  // Create React root instance
  const root = ReactDOM.createRoot(rootElement);

  // Configure development tools and extensions
  if (IS_DEVELOPMENT) {
    // Enable React Developer Tools
    const { whyDidYouUpdate } = require('@welldone-software/why-did-you-render');
    whyDidYouUpdate(React);
  }

  // Error boundary fallback component
  const ErrorFallback = ({ error }: { error: Error }) => (
    <div 
      role="alert"
      style={{
        padding: '20px',
        margin: '20px',
        border: `1px solid ${lightTheme.palette.error.main}`,
        borderRadius: '4px',
        color: lightTheme.palette.error.main
      }}
    >
      <h2>Application Error</h2>
      <pre style={{ whiteSpace: 'pre-wrap' }}>{error.message}</pre>
      {IS_DEVELOPMENT && <pre>{error.stack}</pre>}
    </div>
  );

  // Render application with providers and error boundary
  root.render(
    <React.StrictMode>
      <ErrorBoundary
        FallbackComponent={ErrorFallback}
        onError={(error, info) => {
          // Log error to monitoring service in production
          if (!IS_DEVELOPMENT) {
            console.error('Application error:', error);
            console.error('Component stack:', info.componentStack);
          }
        }}
        onReset={() => {
          // Reset application state on error recovery
          window.location.reload();
        }}
      >
        <Provider store={store}>
          <App />
        </Provider>
      </ErrorBoundary>
    </React.StrictMode>
  );

  // Register service worker for PWA support
  if (process.env.REACT_APP_ENABLE_PWA === 'true' && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/service-worker.js')
        .then(registration => {
          console.info('Service Worker registered:', registration);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }

  // Initialize performance monitoring
  if (!IS_DEVELOPMENT) {
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
};

// Initialize application
try {
  renderApp();
} catch (error) {
  console.error('Failed to render application:', error);
  // Display fallback error message
  document.body.innerHTML = `
    <div style="padding: 20px; text-align: center;">
      <h1>Application Error</h1>
      <p>We apologize, but something went wrong. Please try refreshing the page.</p>
      ${IS_DEVELOPMENT ? `<pre>${error}</pre>` : ''}
    </div>
  `;
}