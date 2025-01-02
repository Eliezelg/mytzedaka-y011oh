import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Roles } from '../constants/roles.constant';

/**
 * Guard implementation for Role-Based Access Control (RBAC) in the International Jewish Association Donation Platform.
 * Provides secure, type-safe route protection based on user roles with comprehensive validation and audit logging.
 * 
 * @implements {CanActivate}
 */
@Injectable()
export class RolesGuard implements CanActivate {
    /**
     * Cache for storing metadata to optimize repeated route access checks
     * Key: handler+class identifier, Value: required roles array
     */
    private readonly metadataCache: Map<string, Roles[]>;

    /**
     * Creates an instance of RolesGuard.
     * @param {Reflector} reflector - NestJS reflector service for metadata access
     */
    constructor(private readonly reflector: Reflector) {
        this.metadataCache = new Map<string, Roles[]>();
    }

    /**
     * Validates if the current user has the required roles to access the route.
     * Implements caching, comprehensive validation, and detailed error handling.
     * 
     * @param {ExecutionContext} context - Execution context containing request details
     * @returns {Promise<boolean>} True if access is granted, throws UnauthorizedException otherwise
     */
    async canActivate(context: ExecutionContext): Promise<boolean> {
        // Generate cache key from handler and class identifiers
        const handler = context.getHandler();
        const controller = context.getClass();
        const cacheKey = `${controller.name}:${handler.name}`;

        // Check cache or retrieve and cache required roles
        let requiredRoles = this.metadataCache.get(cacheKey);
        if (!requiredRoles) {
            requiredRoles = this.reflector.getAllAndOverwrite<Roles[]>(ROLES_KEY, [
                handler,
                controller,
            ]);
            this.metadataCache.set(cacheKey, requiredRoles || []);
        }

        // Allow access if no roles are required
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // Validate user object and structure
        if (!user || !user.role) {
            throw new UnauthorizedException(
                'Access denied: User authentication required'
            );
        }

        // Validate user role against required roles
        if (!this.validateRole(user.role, requiredRoles)) {
            // Log unauthorized access attempt
            console.warn(
                `Unauthorized access attempt - User Role: ${user.role}, ` +
                `Required Roles: ${requiredRoles.join(', ')}, ` +
                `Route: ${request.method} ${request.url}`
            );

            throw new UnauthorizedException(
                'Access denied: Insufficient role permissions'
            );
        }

        return true;
    }

    /**
     * Performs type-safe validation of user role against required roles.
     * Implements role hierarchy where ADMIN has access to all routes.
     * 
     * @param {string} userRole - Role of the current user
     * @param {Roles[]} requiredRoles - Array of roles that grant access
     * @returns {boolean} True if user role is valid and sufficient
     */
    private validateRole(userRole: string, requiredRoles: Roles[]): boolean {
        // Validate user role is a valid enum value
        if (!Object.values(Roles).includes(userRole as Roles)) {
            return false;
        }

        // Admin role has access to all routes
        if (userRole === Roles.ADMIN) {
            return true;
        }

        // Check if user role matches any required roles
        return requiredRoles.includes(userRole as Roles);
    }
}