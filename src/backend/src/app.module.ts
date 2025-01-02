import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CacheModule } from '@nestjs/cache-manager';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule } from '@nestjs/config';
import * as redisStore from 'cache-manager-redis-store';
import * as Joi from 'joi';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { AssociationModule } from './modules/association/association.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { DonationModule } from './modules/donation/donation.module';
import { PaymentModule } from './modules/payment/payment.module';
import { DocumentModule } from './modules/document/document.module';

/**
 * Root module of the International Jewish Association Donation Platform
 * Implements comprehensive security, caching, and database configurations
 * with microservices architecture support.
 */
@Module({
  imports: [
    // Environment configuration with validation
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: Joi.object({
        // Database configuration
        MONGODB_URI: Joi.string().required(),
        
        // Redis configuration
        REDIS_HOST: Joi.string().required(),
        REDIS_PORT: Joi.number().required(),
        
        // Security configuration
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRATION: Joi.string().default('15m'),
        
        // Payment gateway configuration
        STRIPE_API_KEY: Joi.string().required(),
        TRANZILLA_TERMINAL_ID: Joi.string().required(),
        
        // Document storage configuration
        DOCUMENT_STORAGE_BUCKET: Joi.string().required(),
        DOCUMENT_ENCRYPTION_KEY: Joi.string().required(),
        
        // Rate limiting configuration
        RATE_LIMIT_TTL: Joi.number().default(60),
        RATE_LIMIT_LIMIT: Joi.number().default(100)
      })
    }),

    // MongoDB configuration with optimized connection pooling
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 100,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      family: 4,
      keepAlive: true,
      keepAliveInitialDelay: 300000
    }),

    // Redis cache configuration for distributed caching
    CacheModule.register({
      isGlobal: true,
      store: redisStore,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      ttl: 300, // 5 minutes default TTL
      max: 10000, // Maximum number of items in cache
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      reconnectOnError: (err: Error) => err.message.includes('READONLY')
    }),

    // Rate limiting configuration for API protection
    ThrottlerModule.forRoot([{
      ttl: 60, // Time window in seconds
      limit: 100 // Request limit per window
    }]),

    // Feature modules
    AuthModule,
    AssociationModule,
    CampaignModule,
    DonationModule,
    PaymentModule,
    DocumentModule
  ],
  controllers: [], // Root level controllers if needed
  providers: [] // Root level providers if needed
})
export class AppModule {}