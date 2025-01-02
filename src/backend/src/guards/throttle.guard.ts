import { Injectable, ExecutionContext } from '@nestjs/common'; // ^9.0.0
import { ThrottlerGuard } from '@nestjs/throttler'; // ^4.0.0
import { AppConfig } from '../interfaces/config.interface';

/**
 * Enhanced rate limiting guard with environment-specific configurations
 * and endpoint categorization for advanced API protection
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  private readonly environment: string;
  private readonly rateLimits: Record<string, number>;
  private readonly trackerCache: Map<string, string>;

  // Rate limit multipliers for different environments
  private readonly ENV_MULTIPLIERS = {
    development: 2.0,  // More lenient for development
    staging: 1.5,      // Moderate for staging
    production: 1.0    // Strict for production
  };

  // Default rate limits by endpoint category
  private readonly DEFAULT_LIMITS = {
    public: 100,       // Public endpoints like campaign listing
    authenticated: 200, // Authenticated user endpoints
    payment: 50,       // Payment processing endpoints
    admin: 300,        // Administrative endpoints
    reporting: 150     // Reporting and analytics endpoints
  };

  constructor(config: AppConfig) {
    super({
      ttl: 60000, // 1 minute window
      limit: 100  // Default limit, will be adjusted by category
    });
    
    this.environment = config.environment;
    this.rateLimits = config.rateLimiting?.limits || this.DEFAULT_LIMITS;
    this.trackerCache = new Map();
  }

  /**
   * Determines if the request should be allowed based on rate limits
   * @param context Execution context containing request details
   * @returns Promise resolving to boolean indicating if request is allowed
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const request = context.switchToHttp().getRequest();
      const category = this.getEndpointCategory(request);
      const rateLimit = this.getRateLimit(category, this.environment);
      
      // Update TTL and limit based on category and environment
      this.throttler.limit = rateLimit;
      
      const tracker = await this.getTracker(context);
      const ttl = await this.storageService.ttl(tracker);
      const hits = await this.storageService.increment(tracker);

      // Check if rate limit is exceeded
      if (ttl === -1) {
        await this.storageService.set(tracker, 1, this.throttler.ttl);
        return true;
      }

      if (hits > rateLimit) {
        // Log rate limit breach attempt
        console.warn(`Rate limit exceeded for ${tracker} - Category: ${category}, Environment: ${this.environment}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open in case of errors to prevent service disruption
      return true;
    }
  }

  /**
   * Generates a unique tracker key for rate limiting
   * @param context Execution context
   * @returns Unique tracker key
   */
  protected async getTracker(context: ExecutionContext): Promise<string> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || 
               request.connection?.remoteAddress || 
               request.headers['x-forwarded-for']?.split(',')[0];
    
    const path = request.route?.path || request.url;
    const category = this.getEndpointCategory(request);
    
    // Generate unique key combining IP, path and category
    const key = `${ip}-${path}-${category}`;
    
    // Cache tracker key for performance
    if (!this.trackerCache.has(key)) {
      this.trackerCache.set(key, key);
    }
    
    return this.trackerCache.get(key);
  }

  /**
   * Determines rate limit based on endpoint category and environment
   * @param category Endpoint category
   * @param environment Current environment
   * @returns Calculated rate limit
   */
  private getRateLimit(category: string, environment: string): number {
    const baseLimit = this.rateLimits[category] || this.DEFAULT_LIMITS[category] || 100;
    const multiplier = this.ENV_MULTIPLIERS[environment] || 1.0;
    
    return Math.floor(baseLimit * multiplier);
  }

  /**
   * Determines endpoint category based on request metadata
   * @param request HTTP request object
   * @returns Endpoint category string
   */
  private getEndpointCategory(request: any): string {
    // Check for explicit category in route metadata
    const routeMetadata = Reflect.getMetadata('rateLimit:category', request.route?.path);
    if (routeMetadata) {
      return routeMetadata;
    }

    // Determine category based on path and auth status
    if (request.path.startsWith('/api/admin')) {
      return 'admin';
    } else if (request.path.startsWith('/api/payment')) {
      return 'payment';
    } else if (request.path.startsWith('/api/reports')) {
      return 'reporting';
    } else if (request.user) {
      return 'authenticated';
    }
    
    return 'public';
  }
}