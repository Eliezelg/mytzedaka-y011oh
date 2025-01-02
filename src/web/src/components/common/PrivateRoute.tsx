/**
 * @fileoverview Enhanced PrivateRoute component implementing secure route protection
 * with role-based access control, loading states, and secure redirects
 * @version 1.0.0
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom'; // v6.14.0
import { useAuthContext } from '../../contexts/AuthContext';

/**
 * Props interface for PrivateRoute component
 */
interface PrivateRouteProps {
  /** Child components to render when access is granted */
  children: React.ReactNode;
  /** Array of roles allowed to access this route */
  roles?: string[];
  /** Custom redirect path for unauthorized access */
  redirectPath?: string;
}

/**
 * Enhanced route protection component with role-based access control
 * and secure redirects
 */
const PrivateRoute: React.FC<PrivateRouteProps> = ({
  children,
  roles,
  redirectPath = '/login'
}) => {
  // Get authentication context and location
  const { user, loading, isAuthenticated } = useAuthContext();
  const location = useLocation();

  // Show loading state while authentication is being checked
  if (loading) {
    return (
      <div 
        role="status" 
        aria-label="Authenticating access" 
        className="loading-container"
      >
        <div className="loading-spinner" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    // Securely encode the return URL
    const returnUrl = encodeURIComponent(location.pathname + location.search);
    
    return (
      <Navigate 
        to={`${redirectPath}?returnUrl=${returnUrl}`}
        state={{ from: location }}
        replace
      />
    );
  }

  // Check role-based access if roles are specified
  if (roles && roles.length > 0) {
    const hasRequiredRole = user && roles.includes(user.role);
    
    if (!hasRequiredRole) {
      // Log unauthorized access attempt
      console.warn(
        'Unauthorized access attempt:', 
        { 
          path: location.pathname,
          userRole: user?.role,
          requiredRoles: roles,
          timestamp: new Date().toISOString()
        }
      );

      // Redirect to dashboard or custom path
      return (
        <Navigate 
          to="/dashboard"
          state={{ 
            from: location,
            error: 'insufficient_permissions'
          }}
          replace
        />
      );
    }
  }

  // Render protected route content
  return (
    <React.Fragment>
      {children}
    </React.Fragment>
  );
};

export default PrivateRoute;