/**
 * @fileoverview Storage Configuration
 * Configures document storage settings with enhanced security and monitoring
 * @version 1.0.0
 */

import { registerAs } from '@nestjs/config'; // v10.0.0
import { StorageUploadOptions, StorageSecurityOptions } from '../interfaces/storage-provider.interface';

/**
 * Default upload options for document storage
 */
const defaultUploadOptions: StorageUploadOptions = {
  encrypt: true,
  acl: 'private',
  contentType: 'application/octet-stream',
  retentionPeriod: 2555, // 7 years default retention
  metadata: {},
  tags: {
    environment: process.env.NODE_ENV || 'development'
  }
};

/**
 * Storage configuration factory function
 * Implements comprehensive storage settings with enhanced security
 */
const getStorageConfig = () => ({
  // Storage provider configuration
  provider: process.env.STORAGE_PROVIDER || 's3',

  // AWS S3 configuration
  s3: {
    region: process.env.AWS_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET_NAME,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT, // Optional custom endpoint
    retention: {
      enabled: true,
      defaultDays: 2555, // 7 years retention
      minimumDays: 365, // 1 year minimum
      maximumDays: 3650 // 10 years maximum
    },
    lifecycle: {
      enabled: true,
      transitionToGlacierDays: 365,
      expirationDays: 3650
    },
    versioning: {
      enabled: true,
      mfa_delete: true
    }
  },

  // Local storage configuration
  local: {
    storagePath: process.env.LOCAL_STORAGE_PATH || './storage',
    tempPath: process.env.TEMP_STORAGE_PATH || './storage/temp',
    backupPath: process.env.BACKUP_STORAGE_PATH || './storage/backup',
    retention: {
      enabled: true,
      checkInterval: '0 0 * * *', // Daily retention check
      defaultDays: 2555
    }
  },

  // Encryption configuration (AES-256-GCM)
  encryption: {
    enabled: true,
    algorithm: 'aes-256-gcm',
    keySize: 256,
    keyRotation: {
      enabled: true,
      intervalDays: 90,
      backupKeys: 3
    },
    saltLength: 32,
    ivLength: 12,
    authTagLength: 16
  },

  // Security configuration
  security: {
    accessControl: {
      enabled: true,
      maxConcurrentDownloads: 10,
      requireSignedUrls: true,
      signedUrlExpiration: 3600 // 1 hour
    },
    auditLogging: {
      enabled: true,
      logLevel: 'info',
      logRetention: 365 // days
    },
    ipRestrictions: {
      enabled: process.env.ENABLE_IP_RESTRICTIONS === 'true',
      allowedIps: process.env.ALLOWED_IPS?.split(',') || [],
      allowedRanges: process.env.ALLOWED_IP_RANGES?.split(',') || []
    },
    rateLimiting: {
      enabled: true,
      maxRequestsPerHour: 1000,
      maxUploadSizeMB: 100
    }
  },

  // Monitoring configuration
  monitoring: {
    metrics: {
      enabled: true,
      interval: 60, // seconds
      detailed: true
    },
    alerting: {
      enabled: true,
      thresholds: {
        storageUsage: 85, // percentage
        errorRate: 5, // percentage
        latency: 1000 // milliseconds
      }
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
      format: 'json',
      retention: 90, // days
      compression: true
    }
  },

  // Default upload options
  defaultUploadOptions,

  // Backup configuration
  backup: {
    enabled: true,
    schedule: '0 0 * * *', // Daily backup
    retention: 30, // days
    encryption: true,
    compression: true
  }
});

/**
 * Registered storage configuration
 * Exports comprehensive storage settings for the application
 */
export const storageConfig = registerAs('storage', getStorageConfig);

/**
 * Export configuration types for type safety
 */
export type StorageConfiguration = ReturnType<typeof getStorageConfig>;