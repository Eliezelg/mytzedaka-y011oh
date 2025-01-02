import { MongoClientOptions } from 'mongodb'; // ^5.0.0

/**
 * Supported application environments
 */
export type AppEnvironment = 'development' | 'staging' | 'production';

/**
 * Rate limiting configuration interface
 */
export interface RateLimitConfig {
  readonly windowMs: number;
  readonly maxRequests: number;
  readonly message: string;
  readonly statusCode: number;
  readonly skipFailedRequests: boolean;
  readonly keyGenerator: (req: any) => string;
}

/**
 * CORS configuration options interface
 */
export interface CorsOptions {
  readonly credentials: boolean;
  readonly exposedHeaders: readonly string[];
  readonly allowedHeaders: readonly string[];
  readonly methods: readonly string[];
  readonly maxAge: number;
}

/**
 * Core application configuration interface
 */
export interface AppConfig {
  readonly port: number;
  readonly environment: AppEnvironment;
  readonly apiPrefix: string;
  readonly allowedOrigins: readonly string[];
  readonly corsOptions: CorsOptions;
  readonly rateLimiting: RateLimitConfig;
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  readonly trustProxy: boolean;
  readonly sessionSecret: readonly string[];
  readonly cookieSecret: readonly string[];
}

/**
 * Enhanced MongoDB database configuration interface
 */
export interface DatabaseConfig {
  readonly uri: string;
  name: string;
  options: MongoClientOptions;
  replicaSet?: string;
  authSource?: string;
  ssl: boolean;
  readonly minPoolSize: number;
  readonly maxPoolSize: number;
  readonly connectTimeoutMs: number;
  readonly heartbeatFrequencyMs: number;
}

/**
 * Stripe Connect payment gateway configuration
 */
export interface StripeConfig {
  readonly apiKey: string;
  readonly webhookSecret: string;
  readonly connectAccountId: string;
  enableTestMode: boolean;
  payoutScheduleDays: number;
  readonly webhookEndpoints: readonly string[];
  platformFeePercentage: number;
  readonly apiVersion: string;
  readonly statementDescriptor: string;
  readonly supportedPaymentMethods: readonly string[];
}

/**
 * Tranzilla payment gateway configuration for Israeli market
 */
export interface TranzillaConfig {
  readonly terminalId: string;
  readonly apiKey: string;
  readonly apiEndpoint: string;
  enableTestMode: boolean;
  israeliIdRequired: boolean;
  readonly supportedBanks: readonly string[];
  readonly supplierNumber?: string;
  readonly terminalPassword: string;
  readonly timeoutMs: number;
  readonly supportedCreditCards: readonly string[];
}

/**
 * Combined payment processing configuration
 */
export interface PaymentConfig {
  stripe: StripeConfig;
  tranzilla: TranzillaConfig;
  maxRetryAttempts: number;
  retryDelayMs: number;
  readonly supportedCurrencies: readonly string[];
  defaultCurrency: string;
  minDonationAmount: Record<string, number>;
  maxDonationAmount: Record<string, number>;
  readonly webhookTimeoutMs: number;
  readonly paymentMethodTypes: readonly string[];
  readonly refundWindow: number;
  readonly autoRefundEnabled: boolean;
}

/**
 * Security configuration interface
 */
export interface SecurityConfig {
  readonly jwtSecret: string;
  readonly jwtExpiresIn: string;
  readonly refreshTokenExpiresIn: string;
  readonly passwordHashRounds: number;
  readonly maxLoginAttempts: number;
  readonly lockoutDurationMs: number;
  readonly mfaRequired: boolean;
  readonly mfaIssuer: string;
  readonly ipRateLimiting: RateLimitConfig;
}

/**
 * Complete system configuration interface
 */
export interface SystemConfig {
  readonly app: AppConfig;
  readonly db: DatabaseConfig;
  readonly payment: PaymentConfig;
  readonly security: SecurityConfig;
  readonly version: string;
  readonly buildNumber: string;
  readonly environment: AppEnvironment;
}