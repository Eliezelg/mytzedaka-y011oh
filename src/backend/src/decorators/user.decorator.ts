import { createParamDecorator, ExecutionContext } from '@nestjs/common'; // @nestjs/common ^10.0.0
import { User } from '../modules/user/entities/user.entity';

/**
 * Custom parameter decorator that extracts the authenticated user from the request object.
 * Provides type-safe access to the current user's information in route handlers.
 * 
 * Features:
 * - Type-safe user extraction
 * - Built-in validation
 * - Development mode error logging
 * - Secure request context handling
 * 
 * @example
 * ```typescript
 * @Get('profile')
 * async getProfile(@GetUser() user: User) {
 *   return user;
 * }
 * ```
 */
export const GetUser = createParamDecorator(
    (data: unknown, ctx: ExecutionContext): User | undefined => {
        try {
            // Validate execution context is HTTP context
            const request = ctx.switchToHttp().getRequest();
            if (!request) {
                throw new Error('Invalid execution context - HTTP request not found');
            }

            // Extract user object from request (populated by AuthGuard)
            const user = request.user;
            if (!user) {
                if (process.env.NODE_ENV === 'development') {
                    console.warn('User object not found in request - ensure AuthGuard is applied');
                }
                return undefined;
            }

            // Validate user object has required properties
            if (!user.id || typeof user.role === 'undefined') {
                throw new Error('Invalid user object - missing required properties');
            }

            // Validate user role is a valid enum value
            const validRoles = Object.values(Roles);
            if (!validRoles.includes(user.role)) {
                throw new Error(`Invalid user role: ${user.role}`);
            }

            return user;
        } catch (error) {
            // Log extraction errors in development mode
            if (process.env.NODE_ENV === 'development') {
                console.error('Error extracting user from request:', error);
            }
            return undefined;
        }
    },
);