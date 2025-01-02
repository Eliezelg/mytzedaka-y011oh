import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { DonationEntity } from './entities/donation.entity';
import { PaymentService } from '../payment/payment.service';
import { CampaignService } from '../campaign/campaign.service';
import { 
  PaymentMethodType, 
  PaymentStatus, 
  SecurityContext,
  PaymentMethodDetails,
  PaymentResponse
} from '../../interfaces/payment-gateway.interface';
import { Messages } from '../../constants/messages.constant';
import { validateDonationAmount } from '../../utils/validation.util';
import Decimal from 'decimal.js';

/**
 * Enhanced donation service implementing secure payment processing,
 * real-time updates, and PCI DSS compliance
 * @version 1.0.0
 */
@Injectable()
@WebSocketGateway({
  namespace: 'donations',
  cors: true
})
export class DonationService {
  @WebSocketServer()
  private server: Server;
  private readonly logger = new Logger(DonationService.name);

  constructor(
    @InjectRepository(DonationEntity)
    private readonly donationRepository: Repository<DonationEntity>,
    private readonly paymentService: PaymentService,
    private readonly campaignService: CampaignService
  ) {}

  /**
   * Creates a new donation with comprehensive validation and security checks
   * @param createDonationDto Donation creation data
   * @returns Created donation entity
   */
  async createSecureDonation(
    createDonationDto: {
      amount: number;
      currency: string;
      userId: string;
      associationId: string;
      campaignId?: string;
      paymentMethodType: PaymentMethodType;
      isAnonymous?: boolean;
      isRecurring?: boolean;
      recurringFrequency?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<DonationEntity> {
    // Validate donation amount
    const amountValidation = validateDonationAmount(
      createDonationDto.amount,
      createDonationDto.currency as any
    );
    if (!amountValidation.isValid) {
      throw new Error(amountValidation.error);
    }

    // Validate campaign if provided
    if (createDonationDto.campaignId) {
      await this.campaignService.findOne(createDonationDto.campaignId);
    }

    const donation = new DonationEntity();
    Object.assign(donation, {
      ...createDonationDto,
      status: PaymentStatus.PENDING,
      paymentGateway: this.selectPaymentGateway(createDonationDto.currency)
    });

    try {
      const savedDonation = await this.donationRepository.save(donation);
      this.logger.log(`Donation created with ID: ${savedDonation.id}`);

      // Emit real-time update
      this.server.emit('donationCreated', {
        id: savedDonation.id,
        amount: savedDonation.amount,
        currency: savedDonation.currency,
        campaignId: savedDonation.campaignId
      });

      return savedDonation;
    } catch (error) {
      this.logger.error(`Donation creation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Processes donation payment with enhanced security and PCI compliance
   * @param donationId Donation entity ID
   * @param paymentMethodDetails Secure payment method information
   * @param securityContext Security context for fraud prevention
   * @returns Processed payment response
   */
  async processSecurePayment(
    donationId: string,
    paymentMethodDetails: PaymentMethodDetails,
    securityContext: SecurityContext
  ): Promise<PaymentResponse> {
    const donation = await this.donationRepository.findOne({ where: { id: donationId } });
    if (!donation) {
      throw new Error(Messages.VALIDATION.NOT_FOUND.templates.en.replace('{field}', 'Donation'));
    }

    try {
      // Process payment through payment service
      const paymentResponse = await this.paymentService.processPayment(
        donationId,
        paymentMethodDetails,
        securityContext
      );

      // Update donation status
      await this.updateDonationStatus(donation, paymentResponse);

      // Update campaign progress if applicable
      if (donation.campaignId && paymentResponse.status === PaymentStatus.COMPLETED) {
        await this.campaignService.updateProgress(
          donation.campaignId,
          donation.amount,
          donation.currency
        );
      }

      // Emit real-time update
      this.server.emit('donationProcessed', {
        id: donation.id,
        status: paymentResponse.status,
        amount: donation.amount,
        currency: donation.currency,
        campaignId: donation.campaignId
      });

      return paymentResponse;
    } catch (error) {
      await this.handlePaymentError(donation, error);
      throw error;
    }
  }

  /**
   * Retrieves donation details with audit information
   * @param id Donation ID
   * @returns Donation entity with audit details
   */
  async getDonationWithAudit(id: string): Promise<DonationEntity> {
    const donation = await this.donationRepository.findOne({ where: { id } });
    if (!donation) {
      throw new Error(Messages.VALIDATION.NOT_FOUND.templates.en.replace('{field}', 'Donation'));
    }
    return donation;
  }

  /**
   * Selects appropriate payment gateway based on currency
   * @private
   * @param currency Payment currency code
   * @returns Payment gateway identifier
   */
  private selectPaymentGateway(currency: string): 'STRIPE' | 'TRANZILLA' {
    return currency === 'ILS' ? 'TRANZILLA' : 'STRIPE';
  }

  /**
   * Updates donation status with audit logging
   * @private
   * @param donation Donation entity to update
   * @param paymentResponse Payment gateway response
   */
  private async updateDonationStatus(
    donation: DonationEntity,
    paymentResponse: PaymentResponse
  ): Promise<void> {
    donation.status = paymentResponse.status;
    donation.processedAt = new Date();
    donation.metadata = {
      ...donation.metadata,
      transactionId: paymentResponse.transactionId,
      gatewayResponse: paymentResponse.gatewayResponse,
      securityChecks: paymentResponse.securityChecks
    };

    await this.donationRepository.save(donation);
    this.logger.log(`Donation ${donation.id} status updated to ${paymentResponse.status}`);
  }

  /**
   * Handles payment processing errors with comprehensive logging
   * @private
   * @param donation Donation entity that failed
   * @param error Error details
   */
  private async handlePaymentError(
    donation: DonationEntity,
    error: any
  ): Promise<void> {
    donation.status = PaymentStatus.FAILED;
    donation.metadata = {
      ...donation.metadata,
      errorMessage: error.message,
      errorCode: error.code,
      errorTimestamp: new Date().toISOString()
    };

    await this.donationRepository.save(donation);
    this.logger.error(
      `Payment failed for donation ${donation.id}: ${error.message}`,
      error.stack
    );
  }
}