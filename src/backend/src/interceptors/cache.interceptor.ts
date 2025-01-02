import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'; // v10.0.0
import { Observable, of, tap } from 'rxjs'; // v7.8.0
import { CacheProvider } from '../providers/cache.provider';
import { createHash } from 'crypto';

// Cache configuration constants
const CACHE_KEY_PREFIX = 'http-cache:';
const CACHE_VERSION = 'v1:';
const DEFAULT_TTL = 900; // 15 minutes in seconds
const MAX_CACHE_SIZE = 1024 * 1024; // 1MB max cache size

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly defaultTTL: number = DEFAULT_TTL;
  private readonly excludePatterns: RegExp[] = [
    /^\/health$/,
    /^\/metrics$/,
    /^\/auth\//,
    /\.(jpg|jpeg|png|gif|ico|css|js)$/i
  ];
  private readonly hitCounter: Map<string, number> = new Map();

  constructor(private readonly cacheProvider: CacheProvider) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();

    // Check if caching should be bypassed
    if (this.shouldBypassCache(context)) {
      return next.handle();
    }

    // Generate cache key
    const cacheKey = await this.generateCacheKey(context);

    try {
      // Attempt to get from cache
      const cachedResponse = await this.cacheProvider.get(cacheKey);
      
      if (cachedResponse) {
        this.updateMetrics(cacheKey, true);
        return of(cachedResponse);
      }

      // Cache miss - execute handler and cache response
      return next.handle().pipe(
        tap(async (response) => {
          try {
            // Don't cache large responses
            if (JSON.stringify(response).length <= MAX_CACHE_SIZE) {
              // Get custom TTL from route metadata if available
              const customTTL = Reflect.getMetadata('cacheTTL', context.getHandler());
              await this.cacheProvider.set(
                cacheKey,
                response,
                customTTL || this.defaultTTL
              );
            }
            this.updateMetrics(cacheKey, false);
          } catch (error) {
            console.error(`Cache set error for key ${cacheKey}:`, error);
          }
        })
      );

    } catch (error) {
      console.error(`Cache interceptor error for key ${cacheKey}:`, error);
      // Fallback to non-cached response on error
      return next.handle();
    }
  }

  private async generateCacheKey(context: ExecutionContext): Promise<string> {
    const request = context.switchToHttp().getRequest();
    const { method, url, query, body } = request;
    
    // Build cache key components
    const components = [
      CACHE_VERSION,
      method,
      url,
      new URLSearchParams(query).toString()
    ];

    // Add hashed body for POST/PUT requests
    if (['POST', 'PUT'].includes(method) && body) {
      const bodyHash = createHash('sha256')
        .update(JSON.stringify(body))
        .digest('hex');
      components.push(bodyHash);
    }

    // Add user context if authenticated
    if (request.user) {
      components.push(`user:${request.user.id}`);
    }

    // Generate final cache key
    return `${CACHE_KEY_PREFIX}${components.join(':')}`;
  }

  private shouldBypassCache(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const { method, url, headers } = request;

    // Check cache control headers
    if (headers['cache-control'] === 'no-cache' || 
        headers['pragma'] === 'no-cache') {
      return true;
    }

    // Only cache GET requests by default
    if (method !== 'GET') {
      return true;
    }

    // Check excluded patterns
    if (this.excludePatterns.some(pattern => pattern.test(url))) {
      return true;
    }

    // Check if route is marked as non-cacheable
    const isNonCacheable = Reflect.getMetadata('nonCacheable', context.getHandler());
    if (isNonCacheable) {
      return true;
    }

    return false;
  }

  private updateMetrics(cacheKey: string, isHit: boolean): void {
    // Update hit counter
    const currentHits = this.hitCounter.get(cacheKey) || 0;
    this.hitCounter.set(cacheKey, currentHits + 1);

    // Log cache performance metrics
    const endTime = Date.now();
    console.debug(`Cache ${isHit ? 'hit' : 'miss'} for key ${cacheKey}`);
    
    // Cleanup old metrics periodically
    if (this.hitCounter.size > 1000) {
      const oldestKeys = Array.from(this.hitCounter.keys()).slice(0, 100);
      oldestKeys.forEach(key => this.hitCounter.delete(key));
    }
  }
}