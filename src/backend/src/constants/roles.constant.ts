/**
 * Role-based access control (RBAC) enumeration for the International Jewish Association Donation Platform.
 * Defines the core roles and their associated access levels throughout the application.
 * These roles are immutable and serve as the foundation for the platform's security model.
 * 
 * Used by:
 * - RolesGuard for route protection
 * - RolesDecorator for declarative route protection
 * - AuthService for authentication and authorization logic
 */
export enum Roles {
    /**
     * Platform administrator with full system access.
     * Permissions include:
     * - User management
     * - System configuration
     * - Financial oversight
     * - Security administration
     * - Full platform access
     */
    ADMIN = 'ADMIN',

    /**
     * Charitable organization representative with organization-scoped access.
     * Permissions include:
     * - Campaign management
     * - Limited donor data access
     * - Financial reports access
     * - Organization document management
     * - Organization-scoped operations
     */
    ASSOCIATION = 'ASSOCIATION',

    /**
     * Registered donor with user-scoped access.
     * Permissions include:
     * - Personal profile management
     * - Donation history access
     * - Payment methods management
     * - Campaign interaction
     * - User-scoped operations
     */
    DONOR = 'DONOR',

    /**
     * Unauthenticated user with public resource access.
     * Permissions include:
     * - Public campaign viewing
     * - Association directory access
     * - Registration process
     * - Public resource access
     */
    GUEST = 'GUEST'
}