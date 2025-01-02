import { Injectable, UnauthorizedException } from '@nestjs/common'; // ^10.0.0
import { Strategy } from 'passport-local'; // ^1.0.0
import { PassportStrategy } from '@nestjs/passport'; // ^10.0.0
import { Request } from 'express'; // ^4.18.0
import { AuthService } from '../auth.service';
import { EMAIL_REGEX } from '../../../constants/regex.constant';

/**
 * Enhanced Passport local strategy implementation for email-based authentication
 * Implements comprehensive security features including:
 * - Email format validation using RFC 5322 standard
 * - Input sanitization
 * - Rate limiting integration
 * - Audit logging
 * - Brute force protection
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly authService: AuthService) {
    super({
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
      session: false
    });
  }

  /**
   * Validates user credentials with enhanced security checks
   * @param req Express request object for IP tracking
   * @param email User's email address
   * @param password User's password
   * @returns Validated user object or throws UnauthorizedException
   */
  async validate(
    req: Request,
    email: string,
    password: string
  ): Promise<any> {
    try {
      // Email format validation
      if (!email || !EMAIL_REGEX.test(email)) {
        throw new UnauthorizedException('Invalid email format');
      }

      // Sanitize inputs
      const sanitizedEmail = email.toLowerCase().trim();
      const sanitizedPassword = password.trim();

      // Log authentication attempt with IP for audit
      await this.authService.logAuthAttempt({
        email: sanitizedEmail,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date()
      });

      // Validate credentials with brute force protection
      const user = await this.authService.validateUser(
        sanitizedEmail,
        sanitizedPassword
      );

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      // Return validated user without sensitive fields
      return {
        id: user._id,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
        twoFactorEnabled: user.twoFactorEnabled
      };

    } catch (error) {
      // Log failed authentication attempt
      await this.authService.logAuthAttempt({
        email: email?.toLowerCase().trim(),
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date(),
        error: error.message
      });

      // Rethrow with generic message for security
      throw new UnauthorizedException('Invalid credentials');
    }
  }
}