import { Module } from '@nestjs/common'; // ^10.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // ^5.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^2.0.0

import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { DonationModule } from '../donation/donation.module';
import { CampaignModule } from '../campaign/campaign.module';

/**
 * Module configuring secure and compliant report generation functionality
 * with support for multiple formats, languages, and real-time analytics.
 * Implements PCI DSS Level 1 compliance for financial data handling.
 * 
 * Features:
 * - Automated tax receipt generation with digital signatures
 * - Multi-format report exports (PDF, Excel, CSV)
 * - Multi-language support (Hebrew, English, French)
 * - Real-time analytics and metrics
 * - Enhanced security with rate limiting and caching
 * 
 * @version 1.0.0
 */
@Module({
  imports: [
    // Import required modules for data access
    DonationModule,
    CampaignModule,

    // Configure rate limiting for report generation endpoints
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10 // Maximum requests per time window
    }),

    // Configure caching for frequently generated reports
    CacheModule.register({
      ttl: 3600, // Cache TTL in seconds
      max: 100, // Maximum number of items in cache
      isGlobal: false // Module-scoped cache
    })
  ],
  controllers: [ReportController],
  providers: [
    ReportService,
    // Monitoring provider for report generation tracking
    {
      provide: 'REPORT_MONITORING',
      useFactory: () => ({
        metrics: {
          enabled: true,
          detailedTracking: true,
          retentionPeriod: '90days'
        },
        security: {
          pciCompliance: true,
          dataEncryption: true,
          auditLogging: true
        },
        performance: {
          caching: true,
          compression: true,
          streamingEnabled: true
        }
      })
    }
  ],
  exports: [ReportService]
})
export class ReportModule {
  /**
   * Supported report export formats
   * @private
   */
  private static readonly SUPPORTED_FORMATS = ['PDF', 'EXCEL', 'CSV'] as const;

  /**
   * Supported languages for report generation
   * @private
   */
  private static readonly SUPPORTED_LANGUAGES = ['he', 'en', 'fr'] as const;

  /**
   * PCI DSS compliance level for financial data handling
   * @private
   */
  private static readonly PCI_COMPLIANCE_LEVEL = 1;

  /**
   * Report generation rate limits
   * @private
   */
  private static readonly RATE_LIMITS = {
    defaultTtl: 60,
    defaultLimit: 10,
    taxReceiptTtl: 300,
    taxReceiptLimit: 5
  };

  /**
   * Cache configuration for report types
   * @private
   */
  private static readonly CACHE_CONFIG = {
    defaultTtl: 3600,
    maxItems: 100,
    taxReceiptTtl: 86400, // 24 hours
    campaignReportTtl: 1800 // 30 minutes
  };
}