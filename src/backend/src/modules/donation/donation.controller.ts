import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  Logger,
  Request,
  UnauthorizedException,
  BadRequestException,
  NotFoundException
} from '@nestjs/common'; // ^10.0.0

import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiParam,
  ApiQuery
} from '@nestjs/swagger'; // ^6.0.0

import { RateLimit } from '@nestjs/throttler'; // ^5.0.0

import { DonationService } from './donation.service';
import { CreateDonationDto } from './dto/create-donation.dto';
import { AuthGuard } from '../../guards/auth.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { PciComplianceGuard } from '../../guards/pci-compliance.guard';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';
import { TransformInterceptor } from '../../interceptors/transform.interceptor';
import { Messages } from '../../constants/messages.constant';
import { PaymentMethodType, SecurityContext } from '../../interfaces/payment-gateway.interface';

/**
 * Controller handling donation-related endpoints with enhanced security and PCI DSS compliance
 * Implements dual payment gateway support (Stripe Connect & Tranzilla) with real-time updates
 * @version 1.0.0
 */
@Controller('donations')
@ApiTags('donations')
@ApiSecurity('bearer')
@UseGuards(AuthGuard, RolesGuard)
@UseInterceptors(LoggingInterceptor, TransformInterceptor)
@RateLimit({ ttl: 60, limit: 100 })
export class DonationController {
  private readonly logger = new Logger(DonationController.name);

  constructor(private readonly donationService: DonationService) {}

  /**
   * Creates a new donation with comprehensive validation and security checks
   */
  @Post()
  @UseGuards(PciComplianceGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  @ApiOperation({ summary: 'Create new donation with enhanced security' })
  @ApiResponse({ status: 201, description: 'Donation created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input or payment details' })
  @ApiResponse({ status: 403, description: 'Payment method not allowed' })
  async create(
    @Body() createDonationDto: CreateDonationDto,
    @Request() request: any
  ) {
    this.logger.log(`Processing donation request for amount ${createDonationDto.amount} ${createDonationDto.currency}`);

    try {
      // Create security context for payment processing
      const securityContext: SecurityContext = {
        sessionId: request.sessionId,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        fraudChecksPassed: true,
        timestamp: new Date()
      };

      // Create donation with enhanced validation
      const donation = await this.donationService.createSecureDonation({
        ...createDonationDto,
        userId: request.user.id
      });

      // Process payment with appropriate gateway
      const paymentResponse = await this.donationService.processSecurePayment(
        donation.id,
        {
          type: createDonationDto.paymentMethodType,
          tokenizedData: request.body.paymentToken,
          billingAddress: request.body.billingAddress
        },
        securityContext
      );

      return {
        id: donation.id,
        status: paymentResponse.status,
        transactionId: paymentResponse.transactionId
      };
    } catch (error) {
      this.logger.error(`Donation creation failed: ${error.message}`, error.stack);
      throw new BadRequestException(error.message);
    }
  }

  /**
   * Retrieves donation details with audit information
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get donation details' })
  @ApiParam({ name: 'id', description: 'Donation ID' })
  @ApiResponse({ status: 200, description: 'Donation details retrieved' })
  @ApiResponse({ status: 404, description: 'Donation not found' })
  async findOne(@Param('id') id: string, @Request() request: any) {
    try {
      const donation = await this.donationService.getDonationWithAudit(id);
      
      // Check access permissions
      if (!donation.isAnonymous && donation.userId !== request.user.id && !request.user.isAdmin) {
        throw new UnauthorizedException();
      }

      return donation;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new NotFoundException(Messages.VALIDATION.NOT_FOUND.templates.en.replace('{field}', 'Donation'));
      }
      throw error;
    }
  }

  /**
   * Lists donations with filtering and pagination
   */
  @Get()
  @ApiOperation({ summary: 'List donations with filters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING', 'COMPLETED', 'FAILED'] })
  async findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Request() request: any
  ) {
    try {
      const filters = {
        status,
        userId: request.user.isAdmin ? undefined : request.user.id
      };

      return await this.donationService.findAll(filters, page, limit);
    } catch (error) {
      this.logger.error(`Failed to retrieve donations: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Retrieves donation statistics with security checks
   */
  @Get('stats')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Get donation statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStats(@Request() request: any) {
    try {
      return await this.donationService.getDonationStats(request.user.id);
    } catch (error) {
      this.logger.error(`Failed to retrieve donation stats: ${error.message}`, error.stack);
      throw error;
    }
  }
}