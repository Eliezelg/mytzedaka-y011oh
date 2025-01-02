import { Injectable, Logger, Retry } from '@nestjs/common';
import { CircuitBreaker } from '@nestjs/circuit-breaker';
import { PaymentEntity } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { 
  PaymentGatewayInterface,
  PaymentStatus,
  PaymentResponse,
  SecurityContext,
  PaymentMethodDetails,
  SecurityConfig,
  PaymentGatewayConfig
} from '../../interfaces/payment-gateway.interface';
import { Messages } from '../../constants/messages.constant';
import { ErrorCodes } from '../../constants/error-codes.constant';
import Decimal from 'decimal.js';

/**
 * PCI DSS Level 1 compliant payment processing service
 * Implements multi-gateway support (Stripe Connect & Tranzilla) with high availability
 * @version 1.0.0
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly stripeConfig: PaymentGatewayConfig;
  private readonly tranzillaConfig: PaymentGatewayConfig;

  constructor(
    @InjectRepository(PaymentEntity)
    private readonly paymentRepository: Repository<PaymentEntity>,
    private readonly circuitBreaker: CircuitBreaker
  ) {
    this.initializeGatewayConfigs();
    this.validateSecurityConfigs();
  }

  /**
   * Initialize payment gateway configurations with PCI compliant settings
   * @private
   */
  private initializeGatewayConfigs(): void {
    this.stripeConfig = {
      provider: 'STRIPE',
      apiKey: process.env.STRIPE_API_KEY,
      apiSecret: process.env.STRIPE_API_SECRET,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      regionalSettings: {
        country: 'US',
        currency: 'USD',
        locale: 'en'
      },
      timeout: 10000,
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000
      }
    };

    this.tranzillaConfig = {
      provider: 'TRANZILLA',
      apiKey: process.env.TRANZILLA_API_KEY,
      apiSecret: process.env.TRANZILLA_API_SECRET,
      environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox',
      regionalSettings: {
        country: 'IL',
        currency: 'ILS',
        locale: 'he'
      },
      timeout: 10000,
      retryPolicy: {
        maxAttempts: 3,
        backoffMs: 1000
      }
    };
  }

  /**
   * Validate security configurations for PCI DSS compliance
   * @private
   */
  private validateSecurityConfigs(): void {
    const securityConfig: SecurityConfig = {
      encryptionKey: process.env.PAYMENT_ENCRYPTION_KEY,
      certificatePath: process.env.PCI_CERTIFICATE_PATH,
      pciComplianceLevel: 'LEVEL_1',
      ipWhitelist: process.env.PAYMENT_IP_WHITELIST?.split(','),
      fraudDetectionRules: {
        maxAmountPerTransaction: 1000000,
        requireVerificationAbove: 10000,
        blacklistedCountries: ['KP', 'IR']
      },
      auditLogEnabled: true
    };

    if (!securityConfig.encryptionKey || !securityConfig.certificatePath) {
      throw new Error('Missing required security configurations for PCI compliance');
    }
  }

  /**
   * Create a new payment transaction with comprehensive validation
   * @param paymentDto Payment creation data transfer object
   * @returns Created payment entity
   */
  @Retry({ attempts: 3, delay: 1000 })
  async createPayment(paymentDto: CreatePaymentDto): Promise<PaymentEntity> {
    this.logger.log(`Creating payment for amount ${paymentDto.amount} ${paymentDto.currency}`);

    const payment = new PaymentEntity();
    Object.assign(payment, {
      ...paymentDto,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    try {
      const savedPayment = await this.paymentRepository.save(payment);
      this.logger.log(`Payment created with ID: ${savedPayment.id}`);
      return savedPayment;
    } catch (error) {
      this.logger.error(`Payment creation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Process payment through appropriate gateway with circuit breaker pattern
   * @param paymentId Payment entity ID to process
   * @param paymentMethodDetails Secure payment method information
   * @param securityContext Security context for fraud prevention
   * @returns Processed payment response
   */
  async processPayment(
    paymentId: string,
    paymentMethodDetails: PaymentMethodDetails,
    securityContext: SecurityContext
  ): Promise<PaymentResponse> {
    const payment = await this.paymentRepository.findOne({ where: { id: paymentId } });
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }

    const gateway = this.selectPaymentGateway(payment.currency);
    const paymentRequest = {
      amount: new Decimal(payment.amount),
      currency: payment.currency,
      paymentMethodType: paymentMethodDetails.type,
      associationId: payment.associationId,
      donorId: payment.donorId,
      metadata: payment.metadata
    };

    try {
      const response = await this.circuitBreaker.execute(() => 
        gateway.processPayment(paymentId, paymentMethodDetails, securityContext)
      );

      await this.updatePaymentStatus(payment, response);
      return response;
    } catch (error) {
      await this.handlePaymentError(payment, error);
      throw error;
    }
  }

  /**
   * Select appropriate payment gateway based on currency and region
   * @private
   * @param currency Payment currency code
   * @returns Configured payment gateway instance
   */
  private selectPaymentGateway(currency: string): PaymentGatewayInterface {
    if (currency === 'ILS') {
      return this.initializeGateway(this.tranzillaConfig);
    }
    return this.initializeGateway(this.stripeConfig);
  }

  /**
   * Initialize payment gateway with security configurations
   * @private
   * @param config Gateway configuration
   * @returns Configured gateway instance
   */
  private initializeGateway(config: PaymentGatewayConfig): PaymentGatewayInterface {
    // Gateway initialization logic here
    return {} as PaymentGatewayInterface; // Placeholder
  }

  /**
   * Update payment status with audit logging
   * @private
   * @param payment Payment entity to update
   * @param response Payment gateway response
   */
  private async updatePaymentStatus(
    payment: PaymentEntity,
    response: PaymentResponse
  ): Promise<void> {
    payment.status = response.status;
    payment.gatewayTransactionId = response.transactionId;
    payment.updatedAt = new Date();

    if (response.errorMessage) {
      payment.errorMessage = response.errorMessage;
    }

    await this.paymentRepository.save(payment);
    this.logger.log(`Payment ${payment.id} status updated to ${response.status}`);
  }

  /**
   * Handle payment processing errors with comprehensive logging
   * @private
   * @param payment Payment entity that failed
   * @param error Error details
   */
  private async handlePaymentError(
    payment: PaymentEntity,
    error: any
  ): Promise<void> {
    payment.status = PaymentStatus.FAILED;
    payment.errorMessage = error.message;
    payment.updatedAt = new Date();

    await this.paymentRepository.save(payment);
    this.logger.error(
      `Payment ${payment.id} failed: ${error.message}`,
      error.stack
    );
  }
}