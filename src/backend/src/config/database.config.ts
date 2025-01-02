import { MongoClientOptions } from 'mongodb'; // ^5.0.0
import { registerAs } from '@nestjs/config'; // ^10.0.0
import { DatabaseConfig } from '../interfaces/config.interface';

/**
 * Default MongoDB connection options with enterprise-grade security and performance settings
 */
const DEFAULT_DB_OPTIONS: MongoClientOptions = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  
  // Connection pool settings
  maxPoolSize: 50,
  minPoolSize: 10,
  maxIdleTimeMS: 30000,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  keepAlive: true,

  // Security settings
  ssl: true,
  sslValidate: true,
  
  // Write and read concerns for data consistency
  retryWrites: true,
  retryReads: true,
  w: 'majority',
  readPreference: 'primaryPreferred',
  readConcern: { level: 'majority' },
  writeConcern: {
    w: 'majority',
    j: true,
    wtimeout: 1000
  },

  // Field-level encryption configuration
  autoEncryption: {
    keyVaultNamespace: 'encryption.__keyVault',
    kmsProviders: {
      aws: {} // AWS KMS provider configuration loaded from environment
    },
    schemaMap: {} // Schema-based encryption rules loaded from environment
  }
};

/**
 * Factory function that generates comprehensive database configuration
 * with multi-region support, security, and high availability settings
 */
export const databaseConfig = registerAs('database', (): DatabaseConfig => {
  // Load environment variables
  const {
    MONGODB_USERNAME,
    MONGODB_PASSWORD,
    MONGODB_HOST,
    MONGODB_PORT,
    MONGODB_DATABASE,
    MONGODB_REPLICA_SET,
    MONGODB_AUTH_SOURCE,
    NODE_ENV,
    AWS_KMS_KEY_ARN,
    AWS_REGION,
    MONGODB_SSL_CA_PATH,
    MONGODB_MIN_POOL_SIZE,
    MONGODB_MAX_POOL_SIZE
  } = process.env;

  // Validate required environment variables
  if (!MONGODB_USERNAME || !MONGODB_PASSWORD || !MONGODB_HOST) {
    throw new Error('Missing required MongoDB configuration environment variables');
  }

  // Construct MongoDB Atlas connection URI with credentials and replica set
  const uri = `mongodb+srv://${MONGODB_USERNAME}:${MONGODB_PASSWORD}@${MONGODB_HOST}/${MONGODB_DATABASE}?retryWrites=true&w=majority`;

  // Configure database name based on environment
  const name = MONGODB_DATABASE || `donation_platform_${NODE_ENV || 'development'}`;

  // Merge default options with environment-specific configurations
  const options: MongoClientOptions = {
    ...DEFAULT_DB_OPTIONS,
    
    // Override pool size from environment if provided
    minPoolSize: Number(MONGODB_MIN_POOL_SIZE) || DEFAULT_DB_OPTIONS.minPoolSize,
    maxPoolSize: Number(MONGODB_MAX_POOL_SIZE) || DEFAULT_DB_OPTIONS.maxPoolSize,

    // Configure AWS KMS for field-level encryption
    autoEncryption: {
      ...DEFAULT_DB_OPTIONS.autoEncryption,
      kmsProviders: {
        aws: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          region: AWS_REGION
        }
      }
    },

    // Configure monitoring and logging
    monitorCommands: true,
    loggerLevel: NODE_ENV === 'development' ? 'debug' : 'warn',

    // Configure connection pool monitoring
    poolMonitor: true,

    // Configure server monitoring
    serverMonitoring: true,

    // Configure automatic index creation
    autoIndex: NODE_ENV === 'development',

    // Configure compression
    compressors: ['snappy', 'zlib'],

    // Configure heartbeat
    heartbeatFrequencyMS: 10000,

    // Configure load balancing
    loadBalanced: true
  };

  // Return the complete database configuration
  return {
    uri,
    name,
    options,
    replicaSet: MONGODB_REPLICA_SET,
    authSource: MONGODB_AUTH_SOURCE || 'admin',
    ssl: true,
    minPoolSize: Number(MONGODB_MIN_POOL_SIZE) || DEFAULT_DB_OPTIONS.minPoolSize,
    maxPoolSize: Number(MONGODB_MAX_POOL_SIZE) || DEFAULT_DB_OPTIONS.maxPoolSize,
    connectTimeoutMs: DEFAULT_DB_OPTIONS.connectTimeoutMS!,
    heartbeatFrequencyMs: 10000
  };
});