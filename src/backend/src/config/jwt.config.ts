import { JwtSignOptions } from '@nestjs/jwt';
import { Roles } from '../constants/roles.constant';

/**
 * Interface defining the structure of JWT token payload with strict typing.
 * Ensures type safety and consistent payload structure across the application.
 */
export interface JwtPayload {
  /** Unique identifier of the user (UUID) */
  sub: string;
  /** User's email address */
  email: string;
  /** Array of user roles for RBAC */
  roles: Roles[];
  /** Token issued at timestamp */
  iat: number;
  /** Token expiration timestamp */
  exp: number;
  /** Token issuer identifier */
  iss: string;
  /** Token audience identifier */
  aud: string;
  /** Key identifier for rotation */
  kid: string;
  /** Unique token identifier */
  jti: string;
  /** Not before timestamp */
  nbf: number;
}

/**
 * Comprehensive JWT configuration for the International Jewish Association Donation Platform.
 * Implements industry-standard security practices with RS256 signing and strict validation.
 * @version 1.0.0
 */
export const jwtConfig = {
  /**
   * Access token configuration with 15-minute expiry
   * Uses RS256 asymmetric encryption for enhanced security
   */
  accessToken: {
    secret: process.env.JWT_ACCESS_SECRET,
    expiresIn: '15m',
    algorithm: 'RS256',
    publicKey: process.env.JWT_ACCESS_PUBLIC_KEY,
    privateKey: process.env.JWT_ACCESS_PRIVATE_KEY,
  },

  /**
   * Refresh token configuration with 7-day expiry
   * Uses separate key pair for security isolation
   */
  refreshToken: {
    secret: process.env.JWT_REFRESH_SECRET,
    expiresIn: '7d',
    algorithm: 'RS256',
    publicKey: process.env.JWT_REFRESH_PUBLIC_KEY,
    privateKey: process.env.JWT_REFRESH_PRIVATE_KEY,
  },

  /**
   * JWT signing options enforcing strict security parameters
   * Implements industry best practices for token generation
   */
  signOptions: {
    issuer: 'ijap-auth',
    audience: 'ijap-api',
    algorithm: 'RS256' as const,
    allowedAlgorithms: ['RS256'] as const,
    keyid: 'v1',
    notBefore: '0s',
  } as JwtSignOptions,

  /**
   * Validation options for token verification
   * Implements strict validation with no clock tolerance
   */
  validationOptions: {
    ignoreExpiration: false,
    ignoreNotBefore: false,
    clockTolerance: 0,
    maxAge: '15m',
  },

  /**
   * Role-based validation options
   * Maps to platform's RBAC implementation
   */
  roleValidation: {
    allowedRoles: [
      Roles.ADMIN,
      Roles.ASSOCIATION,
      Roles.DONOR,
      Roles.GUEST,
    ],
    defaultRole: Roles.GUEST,
  },
} as const;