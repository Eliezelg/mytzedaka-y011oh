import { Prop, Schema } from '@nestjs/mongoose'; // @nestjs/mongoose ^10.0.0
import { Document } from 'mongoose'; // mongoose ^7.5.0
import { Roles } from '../../../constants/roles.constant';

/**
 * User entity class representing the core user data model for the International Jewish Association Donation Platform.
 * Implements MongoDB integration with comprehensive security features and audit capabilities.
 * 
 * Features:
 * - Role-based access control
 * - Multi-language support (English, French, Hebrew)
 * - Two-factor authentication
 * - Security audit tracking
 * - Account lockout protection
 */
@Schema({ timestamps: true, collection: 'users' })
export class User extends Document {
    /**
     * User's email address, serves as the primary identifier
     * Automatically converted to lowercase and indexed for efficient querying
     */
    @Prop({ required: true, unique: true, index: true, lowercase: true })
    email: string;

    /**
     * Hashed password string
     * Excluded from query results by default for security
     */
    @Prop({ required: true, select: false })
    password: string;

    /**
     * User's first name with automatic whitespace trimming
     */
    @Prop({ required: true, trim: true })
    firstName: string;

    /**
     * User's last name with automatic whitespace trimming
     */
    @Prop({ required: true, trim: true })
    lastName: string;

    /**
     * International format phone number
     * Validated using E.164 format regex
     */
    @Prop({ match: /^\+?[1-9]\d{1,14}$/ })
    phoneNumber: string;

    /**
     * User role for RBAC implementation
     * Defaults to DONOR role and indexed for authorization queries
     */
    @Prop({ type: String, enum: Roles, default: Roles.DONOR, index: true })
    role: Roles;

    /**
     * User's preferred language for platform interaction
     * Supports English (en), French (fr), and Hebrew (he)
     */
    @Prop({ type: String, enum: ['en', 'fr', 'he'], default: 'en', index: true })
    preferredLanguage: string;

    /**
     * Email verification status
     * Indexed for filtering verified/unverified users
     */
    @Prop({ default: false, index: true })
    isVerified: boolean;

    /**
     * JWT refresh token for authentication
     * Excluded from query results by default for security
     */
    @Prop({ select: false })
    refreshToken: string;

    /**
     * Two-factor authentication status flag
     */
    @Prop({ default: false })
    twoFactorEnabled: boolean;

    /**
     * Encrypted two-factor authentication secret
     * Excluded from query results by default for security
     */
    @Prop({ select: false })
    twoFactorSecret: string;

    /**
     * Timestamp of user's last successful login
     * Used for security audit and analytics
     */
    @Prop()
    lastLoginAt: Date;

    /**
     * Timestamp of user's last password change
     * Used for password expiration and security policies
     */
    @Prop()
    passwordChangedAt: Date;

    /**
     * Counter for failed login attempts
     * Used for account lockout protection
     */
    @Prop({ default: 0 })
    failedLoginAttempts: number;

    /**
     * Timestamp until which the account is locked
     * Used for temporary account lockouts after multiple failed attempts
     */
    @Prop()
    accountLockedUntil: Date;

    /**
     * Last IP address used for login
     * Used for security audit and fraud detection
     */
    @Prop()
    lastIpAddress: string;
}

/**
 * MongoDB schema for the User collection
 * Exported for use in module configuration
 */
export const UserSchema = User.schema;