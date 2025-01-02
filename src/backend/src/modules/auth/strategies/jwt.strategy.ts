import { Injectable, Logger } from '@nestjs/common'; // @nestjs/common ^10.0.0
import { PassportStrategy } from '@nestjs/passport'; // @nestjs/passport ^10.0.0
import { Strategy, ExtractJwt } from 'passport-jwt'; // passport-jwt ^4.0.0
import { jwtConfig } from '../../../config/jwt.config';
import { UserService } from '../../user/user.service';
import { User } from '../../user/entities/user.entity';

/**
 * Interface defining JWT token payload structure with enhanced security fields
 * Implements strict typing for token validation and security checks
 */
export interface JwtPayload {
  sub: string;          // User ID
  email: string;        // User email
  roles: string[];      // User roles
  iat: number;          // Issued at timestamp
  exp: number;          // Expiration timestamp
  iss: string;          // Token issuer
  aud: string;          // Token audience
  jti: string;         // Unique token ID
  deviceId: string;    // Device identifier
  lastLogin: number;   // Last login timestamp
}

/**
 * Enhanced JWT authentication strategy implementing secure token validation
 * and user authentication with advanced security features
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private readonly userService: UserService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.accessToken.publicKey,
      algorithms: [jwtConfig.signOptions.algorithm],
      issuer: jwtConfig.signOptions.issuer,
      audience: jwtConfig.signOptions.audience,
      passReqToCallback: true,
    });
  }

  /**
   * Validates JWT token payload and retrieves associated user
   * Implements comprehensive security checks and audit logging
   * @param payload - JWT token payload
   * @returns Promise<User> - Authenticated user object
   */
  async validate(payload: JwtPayload): Promise<User> {
    try {
      // Validate required payload fields
      if (!payload.sub || !payload.email || !payload.roles) {
        this.logger.warn('Invalid token payload structure');
        return null;
      }

      // Validate token expiration
      const currentTimestamp = Math.floor(Date.now() / 1000);
      if (payload.exp <= currentTimestamp) {
        this.logger.warn(`Token expired for user ${payload.sub}`);
        return null;
      }

      // Validate issuer and audience
      if (payload.iss !== jwtConfig.signOptions.issuer || 
          payload.aud !== jwtConfig.signOptions.audience) {
        this.logger.warn(`Invalid token issuer/audience for user ${payload.sub}`);
        return null;
      }

      // Retrieve and validate user
      const user = await this.userService.findById(payload.sub);
      if (!user) {
        this.logger.warn(`User not found: ${payload.sub}`);
        return null;
      }

      // Validate user account status
      if (!user.isVerified) {
        this.logger.warn(`Unverified user attempt: ${payload.sub}`);
        return null;
      }

      if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
        this.logger.warn(`Locked account access attempt: ${payload.sub}`);
        return null;
      }

      // Validate user roles
      if (!payload.roles.includes(user.role)) {
        this.logger.warn(`Invalid role claim for user ${payload.sub}`);
        return null;
      }

      // Log successful validation
      this.logger.debug(`Successfully validated token for user ${payload.sub}`);
      
      return user;
    } catch (error) {
      this.logger.error(`Token validation error: ${error.message}`);
      return null;
    }
  }

  /**
   * Additional token validation helper method
   * Implements extra security checks for token integrity
   * @param payload - JWT token payload
   * @returns Promise<boolean> - Validation result
   */
  private async validateToken(payload: JwtPayload): Promise<boolean> {
    try {
      // Verify token age is within acceptable range
      const tokenAge = Math.floor(Date.now() / 1000) - payload.iat;
      if (tokenAge > 900) { // 15 minutes in seconds
        this.logger.warn(`Token age exceeded for user ${payload.sub}`);
        return false;
      }

      // Verify last login timestamp matches user record
      const user = await this.userService.findById(payload.sub);
      if (user.lastLoginAt && 
          payload.lastLogin !== user.lastLoginAt.getTime()) {
        this.logger.warn(`Invalid login timestamp for user ${payload.sub}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Additional token validation error: ${error.message}`);
      return false;
    }
  }
}