import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { CircuitBreakerModule } from '@nestjs/circuit-breaker'; // ^10.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // ^10.0.0

import { DonationController } from './donation.controller';
import { DonationService } from './donation.service';
import { DonationEntity } from './entities/donation.entity';
import { PaymentModule } from '../payment/payment.module';
import { CampaignModule } from '../campaign/campaign.module';

/**
 * DonationModule configures and exports donation-related functionality
 * with enhanced security, real-time monitoring, and compliance features
 * for processing international donations through multiple payment gateways.
 * 
 * Features:
 * - PCI DSS Level 1 compliance
 * - Dual payment gateway support (Stripe Connect & Tranzilla)
 * - Real-time donation tracking
 * - Enhanced security with rate limiting and circuit breakers
 * - Comprehensive audit logging
 * 
 * @version 1.0.0
 */
@Module({
  imports: [
    // Database configuration for donation entities
    TypeOrmModule.forFeature([DonationEntity]),

    // Payment processing module with dual gateway support
    PaymentModule,

    // Campaign module for donation attribution
    CampaignModule,

    // Circuit breaker for payment resilience
    CircuitBreakerModule.register({
      timeout: 5000,
      maxFailures: 3,
      resetTimeout: 30000
    }),

    // Rate limiting for security
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10
    })
  ],
  controllers: [DonationController],
  providers: [
    DonationService,
    // Monitoring provider for donation tracking
    {
      provide: 'MONITORING',
      useFactory: () => ({
        metrics: true,
        alerting: true,
        logging: 'verbose',
        errorReporting: {
          enabled: true,
          detailedErrors: process.env.NODE_ENV !== 'production'
        }
      })
    },
    // Audit logging provider
    {
      provide: 'AUDIT_LOGGER',
      useFactory: () => ({
        enabled: true,
        detailedLogging: true,
        retentionPeriod: '7years',
        pciCompliant: true,
        encryptionEnabled: true
      })
    }
  ],
  exports: [DonationService]
})
export class DonationModule {
  /**
   * Module version for tracking API compatibility
   * @private
   */
  private readonly moduleVersion: string = '1.0.0';

  /**
   * PCI DSS compliance level
   * @private
   */
  private readonly pciComplianceLevel: number = 1;

  /**
   * Supported payment gateways
   * @private
   */
  private readonly supportedGateways = {
    international: 'STRIPE',
    israeli: 'TRANZILLA'
  };
}