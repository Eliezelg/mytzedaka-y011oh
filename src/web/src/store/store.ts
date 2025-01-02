/**
 * @fileoverview Redux store configuration with enhanced security, performance monitoring,
 * and comprehensive middleware setup for the International Jewish Association Donation Platform
 * @version 1.0.0
 */

import { 
  configureStore, 
  getDefaultMiddleware,
  Middleware,
  isPlainObject,
  Action,
  ThunkAction 
} from '@reduxjs/toolkit'; // ^1.9.5
import { createLogger } from 'redux-logger'; // ^3.0.6
import rootReducer from './reducers/root.reducer';
import { RootState } from './reducers/root.reducer';

// Environment check for development features
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * Custom serialization check middleware to prevent non-serializable values
 */
const serializationCheckMiddleware: Middleware = () => next => action => {
  if (!isPlainObject(action)) {
    console.error('Non-serializable action detected:', action);
    return next(action);
  }

  const checkValue = (value: any, path: string) => {
    if (
      value instanceof Date ||
      value instanceof RegExp ||
      value instanceof Error ||
      typeof value === 'function'
    ) {
      console.error(`Non-serializable value detected at ${path}:`, value);
    }

    if (isPlainObject(value)) {
      Object.entries(value).forEach(([key, nestedValue]) => {
        checkValue(nestedValue, `${path}.${key}`);
      });
    }
  };

  checkValue(action, 'action');
  return next(action);
};

/**
 * Performance monitoring middleware
 */
const performanceMiddleware: Middleware = () => next => action => {
  const start = performance.now();
  const result = next(action);
  const duration = performance.now() - start;

  // Log actions taking longer than 16ms (1 frame at 60fps)
  if (duration > 16) {
    console.warn(`Slow action ${action.type}: ${duration.toFixed(2)}ms`);
  }

  return result;
};

/**
 * Configure and create Redux store with comprehensive middleware setup
 */
const configureAppStore = (preloadedState?: Partial<RootState>) => {
  // Initialize middleware array with required middleware
  const middleware = [
    ...getDefaultMiddleware({
      thunk: true,
      serializableCheck: {
        // Ignore certain paths for serialization checks
        ignoredActions: ['auth/login/fulfilled', 'auth/register/fulfilled'],
        ignoredPaths: ['auth.deviceTrust', 'donations.optimisticUpdates']
      },
      immutableCheck: true
    }),
    serializationCheckMiddleware,
    performanceMiddleware
  ];

  // Add development-only middleware
  if (IS_DEVELOPMENT) {
    middleware.push(
      createLogger({
        collapsed: true,
        duration: true,
        timestamp: true,
        diff: true
      })
    );
  }

  // Configure store with security and performance settings
  const store = configureStore({
    reducer: rootReducer,
    middleware,
    preloadedState,
    devTools: IS_DEVELOPMENT,
    enhancers: []
  });

  // Enable hot module replacement for reducers in development
  if (IS_DEVELOPMENT && module.hot) {
    module.hot.accept('./reducers/root.reducer', () => {
      store.replaceReducer(rootReducer);
    });
  }

  return store;
};

// Create store instance
export const store = configureAppStore();

// Export types for TypeScript support
export type AppStore = ReturnType<typeof configureAppStore>;
export type AppDispatch = typeof store.dispatch;
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;

// Export store instance as default
export default store;