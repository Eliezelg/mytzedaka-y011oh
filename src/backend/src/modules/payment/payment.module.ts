import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { ConfigModule } from '@nestjs/config'; // ^10.0.0
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentEntity } from './entities/payment.entity';
import { StripeProvider } from './providers/stripe.provider';
import { TranzillaProvider } from './providers/tranzilla.provider';
import { CircuitBreakerModule } from '@nestjs/circuit-breaker';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { paymentConfig } from '../../config/payment.config';

/**
 * PaymentModule provides secure, PCI DSS Level 1 compliant payment processing capabilities
 * through multiple payment gateways (Stripe Connect for international and Tranzilla for Israeli market)
 * with comprehensive monitoring, error handling, and audit logging.
 * @version 1.0.0
 */
@Module({
  imports: [
    // Database configuration for payment entities
    TypeOrmModule.forFeature([PaymentEntity]),

    // Load payment gateway configurations
    ConfigModule.forFeature(paymentConfig),

    // Circuit breaker for resilient payment processing
    CircuitBreakerModule.register({
      options: {
        timeout: 5000,
        maxFailures: 3,
        resetTimeout: 30000
      }
    }),

    // Monitoring for payment operations
    MonitoringModule.register({
      serviceName: 'payment-service',
      metrics: true,
      tracing: true,
      logging: true
    })
  ],
  controllers: [PaymentController],
  providers: [
    PaymentService,
    // Payment gateway providers
    {
      provide: StripeProvider,
      useFactory: async (config) => {
        const provider = new StripeProvider(config);
        await provider.initialize(config.stripe, {
          encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY,
          pciComplianceLevel: 'LEVEL_1',
          auditLogEnabled: true,
          fraudDetectionRules: config.stripe.riskManagement
        });
        return provider;
      },
      inject: ['CONFIG']
    },
    {
      provide: TranzillaProvider,
      useFactory: async (config) => {
        const provider = new TranzillaProvider(config);
        await provider.initialize({
          terminalId: process.env.TRANZILLA_TERMINAL_ID,
          apiKey: process.env.TRANZILLA_API_KEY,
          apiEndpoint: process.env.TRANZILLA_API_ENDPOINT,
          enableTestMode: process.env.NODE_ENV !== 'production',
          complianceMode: {
            israeliTaxAuthority: true,
            dataRetention: '7years',
            auditFrequency: 'daily'
          },
          retryPolicy: {
            maxAttempts: 3,
            backoffMs: 1000
          },
          securitySettings: {
            encryptedComms: true,
            ipRestriction: true,
            tokenization: true,
            fraudDetection: true
          },
          allowedIPs: process.env.TRANZILLA_ALLOWED_IPS?.split(',') || [],
          auditConfig: {
            enabled: true,
            detailedLogging: true,
            retentionPeriod: '7years'
          }
        });
        return provider;
      },
      inject: ['CONFIG']
    },
    // Circuit breaker provider for payment operations
    {
      provide: 'CIRCUIT_BREAKER',
      useFactory: () => ({
        maxFailures: 3,
        resetTimeout: 30000,
        timeout: 5000
      })
    },
    // Monitoring provider for payment tracking
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
    }
  ],
  exports: [PaymentService]
})
export class PaymentModule {}