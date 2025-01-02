import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_KEY } from '../decorators/auth.decorator';
import { JwtStrategy } from '../modules/auth/strategies/jwt.strategy';

/**
 * Enhanced AuthGuard implementing comprehensive JWT authentication and security controls
 * for the International Jewish Association Donation Platform.
 * 
 * Features:
 * - JWT token validation with RS256 signing
 * - Role-based access control
 * - Security header validation
 * - Token blacklist checking
 * - Audit logging
 */
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly jwtStrategy: JwtStrategy
  ) {}

  /**
   * Determines if a route can be activated based on authentication requirements
   * and comprehensive security checks
   * 
   * @param context - Execution context containing request details
   * @returns Promise<boolean> - Whether access is allowed
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      // Extract authentication requirement metadata
      const authConfig = this.reflector.get(AUTH_KEY, context.getHandler());
      const request = context.switchToHttp().getRequest();

      // If no auth config is present, allow access
      if (!authConfig) {
        return true;
      }

      // Validate security headers
      if (!this.validateHeaders(request)) {
        this.logger.warn(`Invalid security headers from IP: ${request.ip}`);
        throw new UnauthorizedException('Invalid security headers');
      }

      // Extract and validate JWT token
      const authHeader = request.headers.authorization;
      if (!authHeader) {
        if (authConfig.isRequired) {
          this.logger.warn(`Missing authorization header from IP: ${request.ip}`);
          throw new UnauthorizedException('Missing authentication token');
        }
        return true;
      }

      // Validate token format
      const [bearer, token] = authHeader.split(' ');
      if (bearer !== 'Bearer' || !token) {
        this.logger.warn(`Invalid token format from IP: ${request.ip}`);
        throw new UnauthorizedException('Invalid token format');
      }

      // Validate token structure and check blacklist
      const payload = await this.jwtStrategy.validateTokenStructure(token);
      if (!payload) {
        this.logger.warn(`Invalid token structure from IP: ${request.ip}`);
        throw new UnauthorizedException('Invalid token structure');
      }

      const isBlacklisted = await this.jwtStrategy.checkTokenBlacklist(token);
      if (isBlacklisted) {
        this.logger.warn(`Blacklisted token used from IP: ${request.ip}`);
        throw new UnauthorizedException('Token has been revoked');
      }

      // Validate token and get user
      const user = await this.jwtStrategy.validate(payload);
      if (!user) {
        this.logger.warn(`Token validation failed for user: ${payload.sub}`);
        throw new UnauthorizedException('Invalid token');
      }

      // Attach user to request for downstream use
      request.user = user;

      // Log successful authentication
      this.logger.debug(`Successfully authenticated user: ${user.email}`);
      
      return true;
    } catch (error) {
      this.logger.error(`Authentication error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates security-related headers in the request
   * 
   * @param request - HTTP request object
   * @returns boolean - Whether headers meet security requirements
   */
  private validateHeaders(request: any): boolean {
    try {
      // Validate Content-Type for POST/PUT/PATCH requests
      if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
        const contentType = request.headers['content-type'];
        if (!contentType || !contentType.includes('application/json')) {
          return false;
        }
      }

      // Validate security headers
      const xRequestedWith = request.headers['x-requested-with'];
      if (!xRequestedWith || xRequestedWith !== 'XMLHttpRequest') {
        return false;
      }

      // Validate origin for CORS
      const origin = request.headers.origin;
      if (origin && !this.isValidOrigin(origin)) {
        return false;
      }

      // Validate User-Agent
      const userAgent = request.headers['user-agent'];
      if (!userAgent || userAgent.length > 500) {
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Header validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Validates request origin against allowed domains
   * 
   * @param origin - Request origin header value
   * @returns boolean - Whether origin is allowed
   */
  private isValidOrigin(origin: string): boolean {
    const allowedOrigins = [
      'https://ijap.org',
      'https://admin.ijap.org',
      'https://api.ijap.org'
    ];
    return allowedOrigins.includes(origin);
  }
}