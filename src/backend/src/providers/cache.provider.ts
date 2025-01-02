import { Injectable, Logger } from '@nestjs/common'; // v10.0.0
import Redis from 'ioredis'; // v5.3.0
import { CacheConfig } from '../config/cache.config';

// Constants for cache configuration
const CACHE_PREFIX = 'ijap:cache:';
const DEFAULT_TTL = 900; // 15 minutes in seconds
const RETRY_ATTEMPTS = 3;
const COMPRESSION_THRESHOLD = 1024; // bytes

@Injectable()
export class CacheProvider {
  private readonly redisClient: Redis;
  private readonly logger: Logger;
  private readonly defaultTTL: number;
  private readonly clusterMode: boolean;
  private readonly metrics: Map<string, number>;

  constructor(config: CacheConfig) {
    this.logger = new Logger('CacheProvider');
    this.defaultTTL = config.ttl || DEFAULT_TTL;
    this.clusterMode = config.clusterMode;
    this.metrics = new Map([
      ['hits', 0],
      ['misses', 0],
      ['errors', 0],
      ['writes', 0],
      ['deletes', 0]
    ]);

    // Initialize Redis client with configuration
    this.redisClient = this.clusterMode
      ? new Redis.Cluster([{ host: config.host, port: config.port }], {
          ...config.options,
          redisOptions: config.options
        })
      : new Redis({
          host: config.host,
          port: config.port,
          ...config.options
        });

    // Setup error handling and monitoring
    this.setupErrorHandling();
    this.setupHealthCheck();
  }

  private setupErrorHandling(): void {
    this.redisClient.on('error', (error) => {
      this.logger.error(`Redis client error: ${error.message}`, error.stack);
      this.metrics.set('errors', (this.metrics.get('errors') || 0) + 1);
    });

    this.redisClient.on('connect', () => {
      this.logger.log('Successfully connected to Redis');
    });

    this.redisClient.on('reconnecting', () => {
      this.logger.warn('Attempting to reconnect to Redis');
    });
  }

  private setupHealthCheck(): void {
    setInterval(async () => {
      try {
        const health = await this.getHealth();
        if (!health.isConnected) {
          this.logger.warn('Redis health check failed', health);
        }
      } catch (error) {
        this.logger.error('Health check error:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  private getCacheKey(key: string): string {
    return `${CACHE_PREFIX}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (!key) {
        throw new Error('Cache key cannot be empty');
      }

      const cacheKey = this.getCacheKey(key);
      const startTime = Date.now();
      const cachedValue = await this.redisClient.get(cacheKey);

      if (!cachedValue) {
        this.metrics.set('misses', (this.metrics.get('misses') || 0) + 1);
        return null;
      }

      this.metrics.set('hits', (this.metrics.get('hits') || 0) + 1);
      const parsedValue = JSON.parse(cachedValue);
      
      this.logger.debug(`Cache get operation completed in ${Date.now() - startTime}ms`);
      return parsedValue;
    } catch (error) {
      this.metrics.set('errors', (this.metrics.get('errors') || 0) + 1);
      this.logger.error(`Error retrieving cache key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (!key) {
        throw new Error('Cache key cannot be empty');
      }

      const cacheKey = this.getCacheKey(key);
      const serializedValue = JSON.stringify(value);
      const effectiveTTL = ttl || this.defaultTTL;

      const startTime = Date.now();
      await this.redisClient.set(cacheKey, serializedValue, 'EX', effectiveTTL);
      
      this.metrics.set('writes', (this.metrics.get('writes') || 0) + 1);
      this.logger.debug(`Cache set operation completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.metrics.set('errors', (this.metrics.get('errors') || 0) + 1);
      this.logger.error(`Error setting cache key ${key}: ${error.message}`);
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (!key) {
        throw new Error('Cache key cannot be empty');
      }

      const cacheKey = this.getCacheKey(key);
      const startTime = Date.now();
      await this.redisClient.del(cacheKey);

      this.metrics.set('deletes', (this.metrics.get('deletes') || 0) + 1);
      this.logger.debug(`Cache delete operation completed in ${Date.now() - startTime}ms`);
    } catch (error) {
      this.metrics.set('errors', (this.metrics.get('errors') || 0) + 1);
      this.logger.error(`Error deleting cache key ${key}: ${error.message}`);
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      this.logger.warn('Executing cache clear operation - this will remove all cached data');
      
      if (this.clusterMode) {
        // In cluster mode, we need to clear each node
        const nodes = (this.redisClient as Redis.Cluster).nodes('master');
        await Promise.all(nodes.map(node => node.flushdb()));
      } else {
        await this.redisClient.flushdb();
      }

      this.logger.log('Cache clear operation completed successfully');
    } catch (error) {
      this.metrics.set('errors', (this.metrics.get('errors') || 0) + 1);
      this.logger.error('Error clearing cache:', error);
      throw error;
    }
  }

  async getHealth(): Promise<{
    isConnected: boolean;
    metrics: { [key: string]: number };
    memory: { used: number; peak: number };
    uptime: number;
  }> {
    try {
      const info = await this.redisClient.info();
      const memory = {
        used: parseInt(info.match(/used_memory:(\d+)/)?.[1] || '0', 10),
        peak: parseInt(info.match(/used_memory_peak:(\d+)/)?.[1] || '0', 10)
      };

      const uptime = parseInt(info.match(/uptime_in_seconds:(\d+)/)?.[1] || '0', 10);
      const isConnected = this.redisClient.status === 'ready';

      return {
        isConnected,
        metrics: Object.fromEntries(this.metrics),
        memory,
        uptime
      };
    } catch (error) {
      this.logger.error('Error getting cache health metrics:', error);
      return {
        isConnected: false,
        metrics: Object.fromEntries(this.metrics),
        memory: { used: 0, peak: 0 },
        uptime: 0
      };
    }
  }
}