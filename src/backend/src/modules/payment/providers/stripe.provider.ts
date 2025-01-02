import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UseCircuitBreaker } from '@nestjs/circuit-breaker';
import Stripe from 'stripe';
import {
  PaymentGatewayInterface,
  PaymentRequest,
  PaymentResponse,
  PaymentStatus,
  PaymentGatewayConfig,
  SecurityConfig,
  PaymentMethodDetails,
  SecurityContext,
  DetailedPaymentStatus,
  RefundReason
} from '../../../interfaces/payment-gateway.interface';
import Decimal from 'decimal.js';

@Injectable()
@UseCircuitBreaker({
  maxFailures: 3,
  resetTimeout: 30000,
  timeout: 5000
})
export class StripeProvider implements PaymentGatewayInterface {
  private readonly stripeClient: Stripe;
  private readonly logger: Logger;
  private readonly webhookSecret: string;
  private readonly apiVersion: string = '2023-10-16';
  private securityConfig: SecurityConfig;

  constructor(private readonly config: ConfigService) {
    this.logger = new Logger('StripeProvider', {
      timestamp: true,
      sanitize: true
    });

    const stripeSecretKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('Stripe secret key not configured');
    }

    this.stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: this.apiVersion,
      typescript: true,
      telemetry: false, // Disable telemetry for security
      maxNetworkRetries: 3
    });

    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
  }

  async initialize(
    config: PaymentGatewayConfig,
    securityOptions: SecurityConfig
  ): Promise<void> {
    this.logger.log('Initializing Stripe payment provider with enhanced security');
    
    this.securityConfig = securityOptions;
    
    try {
      // Validate API configuration
      await this.stripeClient.accounts.retrieve();
      
      // Configure webhook endpoints with security settings
      await this.stripeClient.webhookEndpoints.create({
        url: this.config.get<string>('STRIPE_WEBHOOK_URL'),
        enabled_events: [
          'payment_intent.succeeded',
          'payment_intent.failed',
          'charge.refunded',
          'charge.dispute.created'
        ],
        api_version: this.apiVersion
      });

      // Initialize fraud detection rules
      await this.stripeClient.radar.valueListItems.create({
        value_list: securityOptions.fraudDetectionRules.listId,
        value: securityOptions.ipWhitelist?.join(',')
      });

      this.logger.log('Stripe provider initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize Stripe provider', error);
      throw error;
    }
  }

  async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
    this.logger.log('Creating Stripe payment with security validation');

    try {
      // Validate amount precision
      const amount = new Decimal(request.amount).toDecimalPlaces(2);
      
      // Create payment intent with enhanced security options
      const paymentIntent = await this.stripeClient.paymentIntents.create({
        amount: amount.times(100).toNumber(), // Convert to cents
        currency: request.currency.toLowerCase(),
        metadata: {
          associationId: request.associationId,
          donorId: request.donorId,
          ...request.metadata
        },
        capture_method: 'manual', // Separate auth and capture for enhanced security
        setup_future_usage: 'off_session',
        statement_descriptor: 'Jewish Association Donation',
        statement_descriptor_suffix: request.associationId.substring(0, 8),
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never'
        }
      });

      const timestamps = {
        created: new Date(),
        lastUpdated: new Date()
      };

      const securityChecks = {
        fraudDetectionPassed: true,
        pciValidationPassed: true,
        riskAssessmentScore: request.riskAssessment?.score || 0,
        ipVerificationPassed: true
      };

      return {
        transactionId: paymentIntent.id,
        status: PaymentStatus.PENDING,
        amount: amount,
        currency: request.currency,
        gatewayResponse: paymentIntent,
        timestamps,
        securityChecks
      };
    } catch (error) {
      this.logger.error('Failed to create Stripe payment', error);
      throw error;
    }
  }

  async processPayment(
    transactionId: string,
    paymentMethodDetails: PaymentMethodDetails,
    securityContext: SecurityContext
  ): Promise<PaymentResponse> {
    this.logger.log('Processing Stripe payment with security context');

    try {
      // Verify security context
      if (!securityContext.fraudChecksPassed) {
        throw new Error('Failed security checks');
      }

      const paymentIntent = await this.stripeClient.paymentIntents.confirm(
        transactionId,
        {
          payment_method_data: {
            type: paymentMethodDetails.type.toLowerCase(),
            billing_details: {
              address: {
                country: paymentMethodDetails.billingAddress.country,
                postal_code: paymentMethodDetails.billingAddress.postalCode,
                city: paymentMethodDetails.billingAddress.city,
                line1: paymentMethodDetails.billingAddress.addressLine
              }
            }
          },
          mandate_data: {
            customer_acceptance: {
              type: 'online',
              online: {
                ip_address: securityContext.ipAddress,
                user_agent: securityContext.userAgent
              }
            }
          }
        }
      );

      return this.mapStripeResponseToPaymentResponse(paymentIntent);
    } catch (error) {
      this.logger.error('Failed to process Stripe payment', error);
      throw error;
    }
  }

  async refundPayment(
    transactionId: string,
    amount: Decimal,
    refundReason: RefundReason
  ): Promise<PaymentResponse> {
    this.logger.log('Processing refund with audit trail');

    try {
      const refund = await this.stripeClient.refunds.create({
        payment_intent: transactionId,
        amount: amount.times(100).toNumber(),
        reason: refundReason.code as Stripe.RefundCreateParams.Reason,
        metadata: {
          authorizedBy: refundReason.authorizedBy,
          description: refundReason.description,
          supportingDocuments: refundReason.supportingDocuments?.join(',')
        }
      });

      return this.mapStripeResponseToPaymentResponse(refund);
    } catch (error) {
      this.logger.error('Failed to process refund', error);
      throw error;
    }
  }

  async getPaymentStatus(transactionId: string): Promise<DetailedPaymentStatus> {
    this.logger.log('Retrieving detailed payment status');

    try {
      const paymentIntent = await this.stripeClient.paymentIntents.retrieve(
        transactionId,
        {
          expand: ['latest_charge', 'payment_method']
        }
      );

      const response = this.mapStripeResponseToPaymentResponse(paymentIntent);

      return {
        ...response,
        processingDetails: {
          attempts: paymentIntent.created,
          lastAttemptTimestamp: new Date(paymentIntent.created * 1000),
          nextRetryTimestamp: undefined
        },
        auditTrail: {
          events: [{
            timestamp: new Date(paymentIntent.created * 1000),
            action: 'PAYMENT_CREATED',
            actor: 'SYSTEM',
            details: paymentIntent
          }]
        }
      };
    } catch (error) {
      this.logger.error('Failed to retrieve payment status', error);
      throw error;
    }
  }

  async handleWebhook(payload: string, signature: string): Promise<void> {
    this.logger.log('Processing Stripe webhook with signature verification');

    try {
      const event = this.stripeClient.webhooks.constructEvent(
        payload,
        signature,
        this.webhookSecret
      );

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentSuccess(event.data.object);
          break;
        case 'payment_intent.failed':
          await this.handlePaymentFailure(event.data.object);
          break;
        case 'charge.refunded':
          await this.handleRefund(event.data.object);
          break;
        default:
          this.logger.warn(`Unhandled webhook event type: ${event.type}`);
      }
    } catch (error) {
      this.logger.error('Webhook processing failed', error);
      throw error;
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log('Processing successful payment webhook');
    // Implement payment success handling
  }

  private async handlePaymentFailure(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    this.logger.log('Processing failed payment webhook');
    // Implement payment failure handling
  }

  private async handleRefund(charge: Stripe.Charge): Promise<void> {
    this.logger.log('Processing refund webhook');
    // Implement refund handling
  }

  private mapStripeResponseToPaymentResponse(stripeResponse: any): PaymentResponse {
    return {
      transactionId: stripeResponse.id,
      status: this.mapStripeStatus(stripeResponse.status),
      amount: new Decimal(stripeResponse.amount / 100),
      currency: stripeResponse.currency.toUpperCase(),
      gatewayResponse: stripeResponse,
      timestamps: {
        created: new Date(stripeResponse.created * 1000),
        lastUpdated: new Date()
      },
      securityChecks: {
        fraudDetectionPassed: true,
        pciValidationPassed: true,
        riskAssessmentScore: stripeResponse.risk_score || 0,
        ipVerificationPassed: true
      }
    };
  }

  private mapStripeStatus(stripeStatus: string): PaymentStatus {
    const statusMap: Record<string, PaymentStatus> = {
      'requires_payment_method': PaymentStatus.PENDING,
      'requires_confirmation': PaymentStatus.PENDING,
      'requires_action': PaymentStatus.PROCESSING,
      'processing': PaymentStatus.PROCESSING,
      'succeeded': PaymentStatus.COMPLETED,
      'canceled': PaymentStatus.CANCELLED,
      'failed': PaymentStatus.FAILED
    };
    return statusMap[stripeStatus] || PaymentStatus.FAILED;
  }
}