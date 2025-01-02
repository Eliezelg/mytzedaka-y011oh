import { SetMetadata } from '@nestjs/common';
import { Roles } from '../constants/roles.constant';

/**
 * Metadata key for storing role requirements on route handlers.
 * Used by RolesGuard to determine authorization requirements.
 */
export const ROLES_KEY = 'roles';

/**
 * Custom decorator factory for implementing role-based access control (RBAC) in routes.
 * Provides type-safe role assignment using the Roles enum and integrates with NestJS guard system.
 * 
 * @param {...Roles[]} roles - One or more roles required for route access
 * @returns {CustomDecorator<string>} Route decorator with role metadata
 * 
 * @example
 * // Restrict route to admin only
 * @Roles(Roles.ADMIN)
 * 
 * @example
 * // Allow either admin or association access
 * @Roles(Roles.ADMIN, Roles.ASSOCIATION)
 * 
 * @see RolesGuard for the corresponding guard implementation
 * @see Roles for the available role definitions
 */
export const Roles = (...roles: Roles[]) => SetMetadata(ROLES_KEY, roles);