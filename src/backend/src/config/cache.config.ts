import { RedisOptions } from 'ioredis'; // v5.3.0

// Default configuration values
const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_REDIS_PORT = 6379;
const DEFAULT_CACHE_TTL = 900; // 15 minutes in seconds
const DEFAULT_CLUSTER_MODE = false;
const DEFAULT_TLS_ENABLED = false;

/**
 * Interface defining Redis cache configuration settings
 * Provides comprehensive options for connection, security, and clustering
 */
export interface CacheConfig {
  /** Redis server hostname */
  host: string;
  /** Redis server port */
  port: number;
  /** Optional Redis password for authentication */
  password?: string;
  /** Cache TTL in seconds */
  ttl: number;
  /** Additional Redis client options */
  options: RedisOptions;
  /** Enable/disable cluster mode */
  clusterMode: boolean;
  /** Enable/disable TLS encryption */
  tls: boolean;
}

/**
 * Default cache configuration with secure defaults
 */
export const defaultCacheConfig: Omit<CacheConfig, 'password' | 'options'> = {
  host: DEFAULT_REDIS_HOST,
  port: DEFAULT_REDIS_PORT,
  ttl: DEFAULT_CACHE_TTL,
  clusterMode: DEFAULT_CLUSTER_MODE,
  tls: DEFAULT_TLS_ENABLED
};

/**
 * Retrieves and validates Redis cache configuration from environment variables
 * Falls back to secure defaults if environment variables are not set
 * @returns {CacheConfig} Validated cache configuration object
 */
export function getCacheConfig(): CacheConfig {
  // Get host configuration
  const host = process.env.REDIS_HOST || DEFAULT_REDIS_HOST;

  // Get port configuration and validate
  const port = parseInt(process.env.REDIS_PORT || DEFAULT_REDIS_PORT.toString(), 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    throw new Error('Invalid Redis port configuration');
  }

  // Get password from environment
  const password = process.env.REDIS_PASSWORD;

  // Get TTL configuration and validate
  const ttl = parseInt(process.env.REDIS_CACHE_TTL || DEFAULT_CACHE_TTL.toString(), 10);
  if (isNaN(ttl) || ttl < 0) {
    throw new Error('Invalid cache TTL configuration');
  }

  // Get cluster mode configuration
  const clusterMode = process.env.REDIS_CLUSTER_MODE === 'true' || DEFAULT_CLUSTER_MODE;

  // Get TLS configuration
  const tls = process.env.REDIS_TLS_ENABLED === 'true' || DEFAULT_TLS_ENABLED;

  // Configure Redis client options
  const options: RedisOptions = {
    retryStrategy: (times: number) => {
      // Exponential backoff with max delay of 30 seconds
      const delay = Math.min(times * 50, 30000);
      return delay;
    },
    enableReadyCheck: true,
    maxRetriesPerRequest: 3,
    enableOfflineQueue: true,
    connectTimeout: 10000, // 10 seconds
    commandTimeout: 5000,  // 5 seconds
    keepAlive: 30000,     // 30 seconds
    tls: tls ? {
      rejectUnauthorized: true // Enforce valid certificates in production
    } : undefined,
    password: password,
    lazyConnect: true     // Connect on first command
  };

  // Return validated configuration
  return {
    host,
    port,
    password,
    ttl,
    options,
    clusterMode,
    tls
  };
}