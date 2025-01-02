import { 
  Controller, 
  Post, 
  Get, 
  Put,
  Body, 
  Param, 
  UseGuards, 
  UseInterceptors,
  HttpStatus,
  HttpException,
  Logger
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity,
  ApiBearerAuth 
} from '@nestjs/swagger';
import { RateLimit } from '@nestjs/throttler';
import { PaymentService } from './payment.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { PaymentEntity } from './entities/payment.entity';
import { 
  PaymentMethodDetails,
  SecurityContext,
  PaymentResponse,
  DetailedPaymentStatus,
  RefundReason
} from '../../interfaces/payment-gateway.interface';
import { Messages } from '../../constants/messages.constant';
import { ErrorCodes } from '../../constants/error-codes.constant';
import { AuthGuard } from '../../guards/auth.guard';
import { PciComplianceGuard } from '../../guards/pci-compliance.guard';
import { AuditLogInterceptor } from '../../interceptors/audit-log.interceptor';
import { PciCompliantLogger } from '../../utils/pci-compliant-logger.util';
import Decimal from 'decimal.js';

/**
 * Controller handling payment operations with PCI DSS Level 1 compliance
 * Supports multi-gateway integration (Stripe Connect & Tranzilla)
 * @version 1.0.0
 */
@Controller('payments')
@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(AuthGuard, PciComplianceGuard)
@UseInterceptors(AuditLogInterceptor)
export class PaymentController {
  private readonly logger: PciCompliantLogger;

  constructor(
    private readonly paymentService: PaymentService,
    logger: PciCompliantLogger
  ) {
    this.logger = logger;
  }

  /**
   * Create a new payment transaction with enhanced validation
   */
  @Post()
  @RateLimit({ ttl: 60, limit: 10 })
  @ApiOperation({ summary: 'Create new payment transaction' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Payment created successfully',
    type: PaymentEntity 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid payment data' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNPROCESSABLE_ENTITY, 
    description: 'Currency validation failed' 
  })
  @ApiResponse({ 
    status: HttpStatus.TOO_MANY_REQUESTS, 
    description: 'Rate limit exceeded' 
  })
  async createPayment(
    @Body() createPaymentDto: CreatePaymentDto
  ): Promise<PaymentEntity> {
    try {
      this.logger.info('Creating new payment', { 
        amount: createPaymentDto.amount,
        currency: createPaymentDto.currency 
      });

      return await this.paymentService.createPayment(createPaymentDto);
    } catch (error) {
      this.logger.error('Payment creation failed', { 
        error: error.message,
        code: error.code 
      });
      throw new HttpException(
        Messages.PAYMENT.FAILED.templates.en.replace(
          '{reason}', 
          error.message
        ),
        error.code || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Process payment through appropriate gateway with security checks
   */
  @Post(':id/process')
  @RateLimit({ ttl: 60, limit: 5 })
  @ApiOperation({ summary: 'Process existing payment' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Payment processed successfully',
    type: PaymentResponse 
  })
  async processPayment(
    @Param('id') paymentId: string,
    @Body() paymentMethodDetails: PaymentMethodDetails,
    @Body() securityContext: SecurityContext
  ): Promise<PaymentResponse> {
    try {
      this.logger.info('Processing payment', { paymentId });

      return await this.paymentService.processPayment(
        paymentId,
        paymentMethodDetails,
        securityContext
      );
    } catch (error) {
      this.logger.error('Payment processing failed', {
        paymentId,
        error: error.message,
        code: error.code
      });
      throw new HttpException(
        Messages.PAYMENT.FAILED.templates.en.replace(
          '{reason}', 
          error.message
        ),
        error.code || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Refund processed payment with validation
   */
  @Post(':id/refund')
  @RateLimit({ ttl: 60, limit: 3 })
  @ApiOperation({ summary: 'Refund processed payment' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Payment refunded successfully',
    type: PaymentResponse 
  })
  async refundPayment(
    @Param('id') paymentId: string,
    @Body('amount') amount: number,
    @Body() refundReason: RefundReason
  ): Promise<PaymentResponse> {
    try {
      this.logger.info('Initiating refund', { 
        paymentId, 
        amount,
        reason: refundReason.code 
      });

      return await this.paymentService.refundPayment(
        paymentId,
        new Decimal(amount),
        refundReason
      );
    } catch (error) {
      this.logger.error('Refund failed', {
        paymentId,
        error: error.message,
        code: error.code
      });
      throw new HttpException(
        error.message,
        error.code || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get detailed payment status with security information
   */
  @Get(':id/status')
  @ApiOperation({ summary: 'Get payment status' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Payment status retrieved successfully',
    type: DetailedPaymentStatus 
  })
  async getPaymentStatus(
    @Param('id') paymentId: string
  ): Promise<DetailedPaymentStatus> {
    try {
      this.logger.info('Retrieving payment status', { paymentId });

      return await this.paymentService.getPaymentStatus(paymentId);
    } catch (error) {
      this.logger.error('Status retrieval failed', {
        paymentId,
        error: error.message,
        code: error.code
      });
      throw new HttpException(
        error.message,
        error.code || HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}