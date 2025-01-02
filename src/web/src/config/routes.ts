import { lazy, Suspense } from 'react';
import { RouteObject } from 'react-router-dom';

// Lazy-loaded page components
const HomePage = lazy(() => import('../pages/HomePage'));
const LoginPage = lazy(() => import('../pages/LoginPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));

/**
 * Enhanced route object with security and metadata features
 */
interface EnhancedRouteObject extends RouteObject {
  /** Access level required for the route */
  access: 'public' | 'protected';
  /** Allowed user roles for protected routes */
  roles?: string[];
  /** Additional route metadata */
  metadata: RouteMetadata;
}

/**
 * Route metadata interface for enhanced functionality
 */
interface RouteMetadata {
  /** Page title for SEO and accessibility */
  title: string;
  /** Enable route prefetching */
  prefetch: boolean;
  /** Caching strategy for route data */
  cacheStrategy: CacheStrategy;
  /** Analytics tracking ID */
  trackingId?: string;
}

/**
 * Cache strategy type for route data
 */
type CacheStrategy = 'no-cache' | 'network-first' | 'cache-first' | 'stale-while-revalidate';

/**
 * Public routes accessible without authentication
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/register',
  '/two-factor',
  '/associations',
  '/campaigns',
  '/forgot-password'
] as const;

/**
 * Protected routes requiring authentication
 */
const PROTECTED_ROUTES = [
  '/dashboard',
  '/profile',
  '/settings',
  '/donations',
  '/payment-methods'
] as const;

/**
 * Association-specific routes
 */
const ASSOCIATION_ROUTES = [
  '/association/dashboard',
  '/association/campaigns',
  '/association/donations',
  '/association/documents'
] as const;

/**
 * Admin-only routes
 */
const ADMIN_ROUTES = [
  '/admin/dashboard',
  '/admin/users',
  '/admin/associations',
  '/admin/reports',
  '/admin/settings'
] as const;

/**
 * Loading component for route suspense
 */
const RouteLoader = () => (
  <div role="progressbar" aria-label="Loading page content">
    Loading...
  </div>
);

/**
 * Enhanced route configuration with security and analytics
 */
export const routes: EnhancedRouteObject[] = [
  {
    path: '/',
    element: (
      <Suspense fallback={<RouteLoader />}>
        <HomePage />
      </Suspense>
    ),
    access: 'public',
    metadata: {
      title: 'Home - International Jewish Association Donation Platform',
      prefetch: true,
      cacheStrategy: 'stale-while-revalidate',
      trackingId: 'home_page'
    }
  },
  {
    path: '/login',
    element: (
      <Suspense fallback={<RouteLoader />}>
        <LoginPage />
      </Suspense>
    ),
    access: 'public',
    metadata: {
      title: 'Login - International Jewish Association Donation Platform',
      prefetch: false,
      cacheStrategy: 'no-cache',
      trackingId: 'login_page'
    }
  },
  {
    path: '/dashboard',
    element: (
      <Suspense fallback={<RouteLoader />}>
        <DashboardPage />
      </Suspense>
    ),
    access: 'protected',
    roles: ['donor', 'association', 'admin'],
    metadata: {
      title: 'Dashboard - International Jewish Association Donation Platform',
      prefetch: true,
      cacheStrategy: 'network-first',
      trackingId: 'dashboard_page'
    }
  },
  // Association routes
  {
    path: '/association/dashboard',
    element: (
      <Suspense fallback={<RouteLoader />}>
        <DashboardPage />
      </Suspense>
    ),
    access: 'protected',
    roles: ['association', 'admin'],
    metadata: {
      title: 'Association Dashboard - International Jewish Association Donation Platform',
      prefetch: true,
      cacheStrategy: 'network-first',
      trackingId: 'association_dashboard'
    }
  },
  // Admin routes
  {
    path: '/admin/dashboard',
    element: (
      <Suspense fallback={<RouteLoader />}>
        <DashboardPage />
      </Suspense>
    ),
    access: 'protected',
    roles: ['admin'],
    metadata: {
      title: 'Admin Dashboard - International Jewish Association Donation Platform',
      prefetch: true,
      cacheStrategy: 'network-first',
      trackingId: 'admin_dashboard'
    }
  }
];

/**
 * Helper function to check if a route is public
 */
export const isPublicRoute = (path: string): boolean => {
  return PUBLIC_ROUTES.includes(path as typeof PUBLIC_ROUTES[number]);
};

/**
 * Helper function to check if a route requires authentication
 */
export const isProtectedRoute = (path: string): boolean => {
  return PROTECTED_ROUTES.includes(path as typeof PROTECTED_ROUTES[number]) ||
         ASSOCIATION_ROUTES.includes(path as typeof ASSOCIATION_ROUTES[number]) ||
         ADMIN_ROUTES.includes(path as typeof ADMIN_ROUTES[number]);
};

/**
 * Helper function to check if a user has access to a route
 */
export const hasRouteAccess = (route: EnhancedRouteObject, userRoles?: string[]): boolean => {
  if (route.access === 'public') return true;
  if (!userRoles) return false;
  return !route.roles || route.roles.some(role => userRoles.includes(role));
};

export default routes;