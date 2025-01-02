import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common'; // ^10.0.0
import { ConfigService } from '@nestjs/config'; // ^10.0.0
import { MongoClient, MongoClientOptions, ClientSession, Db, MonitorOptions, MongoError } from 'mongodb'; // ^5.0.0
import CircuitBreaker from 'opossum'; // ^6.0.0
import { DatabaseConfig } from '../interfaces/config.interface';

/**
 * Connection monitoring interface for enhanced database health checks
 */
interface ConnectionMonitor {
  isHealthy: boolean;
  lastCheck: Date;
  failureCount: number;
  commandDuration: Record<string, number>;
}

/**
 * Enhanced database provider with security, high availability, and monitoring capabilities
 */
@Injectable()
export class DatabaseProvider implements OnModuleDestroy {
  private client: MongoClient;
  private database: Db;
  private readonly logger = new Logger(DatabaseProvider.name);
  private circuitBreaker: CircuitBreaker;
  private connectionMonitor: ConnectionMonitor;
  private readonly monitorOptions: MonitorOptions = {
    command: true,
    heartbeat: true,
    topology: true,
    serverStatus: true
  };

  constructor(private readonly configService: ConfigService) {
    this.initializeCircuitBreaker();
    this.initializeConnectionMonitor();
    this.setupEncryption();
  }

  /**
   * Initialize circuit breaker for database operations
   */
  private initializeCircuitBreaker(): void {
    this.circuitBreaker = new CircuitBreaker(async () => this.connect(), {
      timeout: 5000,
      resetTimeout: 30000,
      errorThresholdPercentage: 50,
      volumeThreshold: 10
    });

    this.circuitBreaker.on('open', () => {
      this.logger.error('Circuit breaker opened - database connection issues detected');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.warn('Circuit breaker half-open - attempting recovery');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.log('Circuit breaker closed - database connection restored');
    });
  }

  /**
   * Initialize connection monitoring
   */
  private initializeConnectionMonitor(): void {
    this.connectionMonitor = {
      isHealthy: false,
      lastCheck: new Date(),
      failureCount: 0,
      commandDuration: {}
    };
  }

  /**
   * Setup database encryption configuration
   */
  private setupEncryption(): void {
    const dbConfig = this.configService.get<DatabaseConfig>('db');
    if (!dbConfig.options.autoEncryption) {
      dbConfig.options.autoEncryption = {
        keyVaultNamespace: 'encryption.__keyVault',
        kmsProviders: {
          local: { key: Buffer.from(dbConfig.encryptionKey, 'base64') }
        },
        schemaMap: {}
      };
    }
  }

  /**
   * Establish database connection with enhanced security and monitoring
   */
  private async connect(): Promise<MongoClient> {
    const dbConfig = this.configService.get<DatabaseConfig>('db');
    
    const options: MongoClientOptions = {
      ...dbConfig.options,
      monitorCommands: true,
      replicaSet: dbConfig.replicaSet,
      ssl: true,
      authMechanism: 'MONGODB-X509',
      authSource: '$external',
      maxPoolSize: dbConfig.maxPoolSize,
      minPoolSize: dbConfig.minPoolSize,
      connectTimeoutMS: dbConfig.connectTimeoutMs,
      heartbeatFrequencyMS: dbConfig.heartbeatFrequencyMs,
      retryWrites: true,
      retryReads: true,
      w: 'majority',
      readPreference: 'primaryPreferred',
      readConcern: { level: 'majority' }
    };

    try {
      this.client = new MongoClient(dbConfig.uri, options);
      await this.client.connect();
      this.database = this.client.db(dbConfig.name);

      this.setupMonitoring();
      await this.validateConnection();

      this.connectionMonitor.isHealthy = true;
      this.connectionMonitor.lastCheck = new Date();
      
      return this.client;
    } catch (error) {
      this.connectionMonitor.failureCount++;
      this.connectionMonitor.isHealthy = false;
      this.logger.error(`Database connection failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Setup database monitoring and event handlers
   */
  private setupMonitoring(): void {
    this.client.on('commandStarted', (event) => {
      const startTime = Date.now();
      this.connectionMonitor.commandDuration[event.commandId] = startTime;
    });

    this.client.on('commandSucceeded', (event) => {
      const duration = Date.now() - this.connectionMonitor.commandDuration[event.commandId];
      delete this.connectionMonitor.commandDuration[event.commandId];
      
      if (duration > 1000) {
        this.logger.warn(`Slow database operation detected: ${event.commandName} (${duration}ms)`);
      }
    });

    this.client.on('serverHeartbeatFailed', (event) => {
      this.logger.error('Database heartbeat failed', event);
      this.connectionMonitor.isHealthy = false;
    });
  }

  /**
   * Validate database connection and permissions
   */
  private async validateConnection(): Promise<void> {
    try {
      await this.database.command({ ping: 1 });
      await this.database.command({ buildInfo: 1 });
      
      const stats = await this.database.command({ serverStatus: 1 });
      if (stats.ok !== 1) {
        throw new Error('Database health check failed');
      }
    } catch (error) {
      this.logger.error('Database validation failed', error.stack);
      throw error;
    }
  }

  /**
   * Get database connection with circuit breaker protection
   */
  public async getConnection(): Promise<MongoClient> {
    try {
      if (!this.client || !this.connectionMonitor.isHealthy) {
        await this.circuitBreaker.fire();
      }
      return this.client;
    } catch (error) {
      this.logger.error('Failed to get database connection', error.stack);
      throw new MongoError('Database connection failed');
    }
  }

  /**
   * Get database instance with validation
   */
  public async getDatabase(): Promise<Db> {
    try {
      if (!this.database || !this.connectionMonitor.isHealthy) {
        await this.getConnection();
      }
      return this.database;
    } catch (error) {
      this.logger.error('Failed to get database instance', error.stack);
      throw new MongoError('Database instance unavailable');
    }
  }

  /**
   * Start a new database session with transaction support
   */
  public async startSession(): Promise<ClientSession> {
    try {
      const client = await this.getConnection();
      const session = client.startSession({
        defaultTransactionOptions: {
          readPreference: 'primary',
          readConcern: { level: 'majority' },
          writeConcern: { w: 'majority' }
        }
      });
      return session;
    } catch (error) {
      this.logger.error('Failed to start database session', error.stack);
      throw new MongoError('Session creation failed');
    }
  }

  /**
   * Get current connection status and health metrics
   */
  public getConnectionStatus(): ConnectionMonitor {
    return {
      ...this.connectionMonitor,
      lastCheck: new Date()
    };
  }

  /**
   * Cleanup resources on module destruction
   */
  public async onModuleDestroy(): Promise<void> {
    try {
      if (this.client) {
        await this.client.close(true);
        this.logger.log('Database connection closed successfully');
      }
    } catch (error) {
      this.logger.error('Error closing database connection', error.stack);
    } finally {
      this.connectionMonitor.isHealthy = false;
    }
  }
}