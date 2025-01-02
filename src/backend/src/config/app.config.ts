// @nestjs/config ^3.0.0
import { ConfigFactory } from '@nestjs/config';
// joi ^17.9.0
import * as Joi from 'joi';
import { AppConfig, AppEnvironment, RateLimitConfig, SecurityConfig } from '../interfaces/config.interface';

// Default configuration values
const DEFAULT_PORT = 3000;
const DEFAULT_API_PREFIX = '/api/v1';
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'https://ijap.org'];

// Rate limiting configuration for high concurrency (10,000 concurrent users)
const RATE_LIMIT: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10000, // Support for 10k concurrent users
  message: 'Too many requests from this IP, please try again later',
  statusCode: 429,
  skipFailedRequests: false,
  keyGenerator: (req: any) => req.ip
};

// Security headers for production hardening
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none';"
};

// Configuration validation schema
const configValidationSchema = Joi.object({
  PORT: Joi.number().default(DEFAULT_PORT),
  NODE_ENV: Joi.string().valid('development', 'staging', 'production').required(),
  API_PREFIX: Joi.string().default(DEFAULT_API_PREFIX),
  ALLOWED_ORIGINS: Joi.array().items(Joi.string()).default(DEFAULT_ALLOWED_ORIGINS),
  SESSION_SECRET: Joi.string().required(),
  COOKIE_SECRET: Joi.string().required(),
  TRUST_PROXY: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string().valid('debug', 'info', 'warn', 'error').default('info')
});

export const appConfig: ConfigFactory<AppConfig> = () => {
  // Validate environment variables
  const validatedConfig = configValidationSchema.validate(process.env, {
    allowUnknown: true,
    stripUnknown: true
  });

  if (validatedConfig.error) {
    throw new Error(`Config validation error: ${validatedConfig.error.message}`);
  }

  const { value: envVars } = validatedConfig;

  // Environment-specific configurations
  const environment = envVars.NODE_ENV as AppEnvironment;
  const isProduction = environment === 'production';

  // CORS configuration based on environment
  const corsOptions = {
    credentials: true,
    exposedHeaders: ['Content-Disposition', 'X-Request-Id'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    maxAge: isProduction ? 24 * 60 * 60 : 1 * 60 * 60 // 24 hours in production, 1 hour in development
  };

  // Security configuration
  const security: SecurityConfig = {
    jwtSecret: process.env.JWT_SECRET || '',
    jwtExpiresIn: isProduction ? '15m' : '1h',
    refreshTokenExpiresIn: '7d',
    passwordHashRounds: isProduction ? 12 : 10,
    maxLoginAttempts: isProduction ? 5 : 10,
    lockoutDurationMs: isProduction ? 30 * 60 * 1000 : 5 * 60 * 1000,
    mfaRequired: isProduction,
    mfaIssuer: 'IJAP',
    ipRateLimiting: {
      ...RATE_LIMIT,
      maxRequests: isProduction ? RATE_LIMIT.maxRequests : RATE_LIMIT.maxRequests * 2
    }
  };

  // Construct and return the complete configuration object
  return {
    port: envVars.PORT,
    environment,
    apiPrefix: envVars.API_PREFIX,
    allowedOrigins: envVars.ALLOWED_ORIGINS,
    corsOptions,
    rateLimiting: RATE_LIMIT,
    logLevel: envVars.LOG_LEVEL,
    trustProxy: envVars.TRUST_PROXY,
    sessionSecret: [envVars.SESSION_SECRET],
    cookieSecret: [envVars.COOKIE_SECRET],
    security,
    headers: isProduction ? SECURITY_HEADERS : {}
  };
};

// Export configuration validation schema for testing
export const validationSchema = configValidationSchema;