import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by AuthGuard to determine authentication requirements for routes
 * @constant {string}
 */
export const AUTH_KEY = 'isAuthenticated';

/**
 * Authentication configuration interface for route metadata
 * @interface AuthConfig
 */
interface AuthConfig {
  isRequired: boolean;
}

/**
 * Factory function that creates an authentication decorator for route protection.
 * Integrates with NestJS AuthGuard through metadata to enforce authentication requirements.
 * 
 * @param {boolean} isRequired - Whether authentication is required for the route
 * @returns {MethodDecorator} Route decorator that sets authentication metadata
 * 
 * @example
 * // Require authentication for route
 * @Auth(true)
 * async getProtectedResource() {}
 * 
 * @example
 * // Make authentication optional
 * @Auth(false)
 * async getPublicResource() {}
 */
export function Auth(isRequired: boolean): MethodDecorator {
  // Validate isRequired parameter
  if (typeof isRequired !== 'boolean') {
    throw new Error('Auth decorator requires a boolean parameter');
  }

  // Create authentication configuration
  const authConfig: AuthConfig = {
    isRequired
  };

  // Set metadata on route handler
  return SetMetadata(AUTH_KEY, authConfig);
}