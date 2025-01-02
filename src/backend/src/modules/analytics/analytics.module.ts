import { Module } from '@nestjs/common'; // ^10.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^2.0.0
import { ConfigModule, ConfigService } from '@nestjs/config'; // ^3.0.0
import * as redisStore from 'cache-manager-redis-store';

import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DonationModule } from '../donation/donation.module';
import { CampaignModule } from '../campaign/campaign.module';

/**
 * Analytics module providing real-time metrics, reporting capabilities,
 * and caching mechanisms for optimal performance.
 * Implements comprehensive tracking of donation volumes, administrative overhead,
 * and donor satisfaction metrics.
 */
@Module({
  imports: [
    // Load analytics-specific configuration
    ConfigModule.forFeature(() => ({
      analytics: {
        metrics: {
          enabled: true,
          retentionDays: 90,
          aggregationIntervals: ['hourly', 'daily', 'weekly', 'monthly']
        },
        reporting: {
          maxConcurrentReports: 10,
          exportFormats: ['CSV', 'PDF', 'XLSX'],
          schedulingEnabled: true
        },
        caching: {
          ttl: 300, // 5 minutes
          maxItems: 10000,
          checkPeriod: 600
        },
        realtime: {
          enabled: true,
          maxConnections: 10000,
          updateInterval: 5000
        }
      }
    })),

    // Configure Redis caching for analytics data
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        host: configService.get('REDIS_HOST'),
        port: configService.get('REDIS_PORT'),
        ttl: 300, // 5 minutes cache TTL
        max: 10000, // Maximum number of items in cache
        checkPeriod: 600, // Seconds to check for expired items
      }),
      inject: [ConfigService]
    }),

    // Required modules for analytics processing
    DonationModule,
    CampaignModule
  ],
  controllers: [AnalyticsController],
  providers: [
    AnalyticsService,
    // Analytics configuration token
    {
      provide: 'ANALYTICS_CONFIG',
      useValue: {
        metrics: {
          donationVolume: true,
          administrativeOverhead: true,
          donorSatisfaction: true,
          realTimeUpdates: true
        },
        performance: {
          maxConcurrentUsers: 10000,
          cacheEnabled: true,
          optimizationLevel: 'high'
        },
        security: {
          dataEncryption: true,
          accessControl: true,
          auditLogging: true
        }
      }
    }
  ],
  exports: [AnalyticsService]
})
export class AnalyticsModule {
  /**
   * Analytics module version for API compatibility tracking
   * @private
   */
  private readonly moduleVersion: string = '1.0.0';

  /**
   * Analytics configuration token for dependency injection
   * @private
   */
  private readonly ANALYTICS_CONFIG_TOKEN = Symbol('ANALYTICS_CONFIG');
}