import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { HttpStatus } from '@nestjs/common';
import { PaymentController } from '../../src/modules/payment/payment.controller';
import { PaymentService } from '../../src/modules/payment/payment.service';
import { CreatePaymentDto } from '../../src/modules/payment/dto/create-payment.dto';
import { 
  PaymentMethodType,
  PaymentStatus,
  SecurityContext,
  PaymentMethodDetails,
  PaymentResponse,
  DetailedPaymentStatus,
  RefundReason
} from '../../interfaces/payment-gateway.interface';
import { PciCompliantLogger } from '../../utils/pci-compliant-logger.util';
import Decimal from 'decimal.js'; // ^10.4.3

describe('PaymentController', () => {
  let controller: PaymentController;
  let mockPaymentService: jest.Mocked<PaymentService>;
  let mockLogger: jest.Mocked<PciCompliantLogger>;

  // Test timeout for performance validation (2 seconds as per requirements)
  const testTimeout = 2000;

  // Mock data for testing
  const mockCreatePaymentDto: CreatePaymentDto = {
    amount: 100.00,
    currency: 'USD',
    paymentMethodType: PaymentMethodType.CREDIT_CARD,
    donorId: '123e4567-e89b-12d3-a456-426614174000',
    associationId: '123e4567-e89b-12d3-a456-426614174001',
    campaignId: '123e4567-e89b-12d3-a456-426614174002',
    metadata: { source: 'web' }
  };

  const mockSecurityContext: SecurityContext = {
    sessionId: 'test-session-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0',
    fraudChecksPassed: true,
    timestamp: new Date()
  };

  const mockPaymentMethodDetails: PaymentMethodDetails = {
    type: PaymentMethodType.CREDIT_CARD,
    tokenizedData: 'tok_visa_testcard',
    billingAddress: {
      country: 'US',
      postalCode: '12345',
      city: 'Test City',
      addressLine: '123 Test St'
    }
  };

  beforeEach(async () => {
    // Create mock implementations
    mockPaymentService = {
      createPayment: jest.fn(),
      processPayment: jest.fn(),
      refundPayment: jest.fn(),
      getPaymentStatus: jest.fn()
    } as any;

    mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    } as any;

    // Configure test module
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PaymentService,
          useValue: mockPaymentService
        },
        {
          provide: PciCompliantLogger,
          useValue: mockLogger
        }
      ]
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
  });

  describe('createPayment', () => {
    it('should create international payment successfully within timeout', async () => {
      const startTime = Date.now();
      const mockResponse = {
        id: '123',
        ...mockCreatePaymentDto,
        status: PaymentStatus.PENDING
      };

      mockPaymentService.createPayment.mockResolvedValue(mockResponse);

      const result = await controller.createPayment(mockCreatePaymentDto);

      expect(Date.now() - startTime).toBeLessThan(testTimeout);
      expect(result).toEqual(mockResponse);
      expect(mockLogger.info).toHaveBeenCalledWith('Creating new payment', {
        amount: mockCreatePaymentDto.amount,
        currency: mockCreatePaymentDto.currency
      });
    });

    it('should create Israeli market payment successfully', async () => {
      const israeliPaymentDto = {
        ...mockCreatePaymentDto,
        currency: 'ILS',
        paymentMethodType: PaymentMethodType.ISRAELI_CREDIT_CARD
      };

      mockPaymentService.createPayment.mockResolvedValue({
        id: '123',
        ...israeliPaymentDto,
        status: PaymentStatus.PENDING
      });

      const result = await controller.createPayment(israeliPaymentDto);

      expect(result.currency).toBe('ILS');
      expect(result.paymentMethodType).toBe(PaymentMethodType.ISRAELI_CREDIT_CARD);
    });

    it('should handle validation errors properly', async () => {
      mockPaymentService.createPayment.mockRejectedValue({
        code: HttpStatus.BAD_REQUEST,
        message: 'Invalid amount'
      });

      await expect(controller.createPayment({
        ...mockCreatePaymentDto,
        amount: -100
      })).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('processPayment', () => {
    const mockPaymentId = '123e4567-e89b-12d3-a456-426614174000';

    it('should process Stripe payment successfully within timeout', async () => {
      const startTime = Date.now();
      const mockResponse: PaymentResponse = {
        transactionId: 'ch_123456',
        status: PaymentStatus.COMPLETED,
        amount: new Decimal(100.00),
        currency: 'USD',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          processed: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        }
      };

      mockPaymentService.processPayment.mockResolvedValue(mockResponse);

      const result = await controller.processPayment(
        mockPaymentId,
        mockPaymentMethodDetails,
        mockSecurityContext
      );

      expect(Date.now() - startTime).toBeLessThan(testTimeout);
      expect(result).toEqual(mockResponse);
      expect(result.securityChecks.pciValidationPassed).toBe(true);
    });

    it('should process Tranzilla payment successfully', async () => {
      const israeliPaymentDetails: PaymentMethodDetails = {
        ...mockPaymentMethodDetails,
        type: PaymentMethodType.ISRAELI_CREDIT_CARD
      };

      const mockResponse: PaymentResponse = {
        transactionId: 'tr_123456',
        status: PaymentStatus.COMPLETED,
        amount: new Decimal(100.00),
        currency: 'ILS',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          processed: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        }
      };

      mockPaymentService.processPayment.mockResolvedValue(mockResponse);

      const result = await controller.processPayment(
        mockPaymentId,
        israeliPaymentDetails,
        mockSecurityContext
      );

      expect(result.currency).toBe('ILS');
      expect(result.securityChecks.pciValidationPassed).toBe(true);
    });

    it('should handle payment processing errors', async () => {
      mockPaymentService.processPayment.mockRejectedValue({
        code: HttpStatus.INTERNAL_SERVER_ERROR,
        message: 'Gateway timeout'
      });

      await expect(controller.processPayment(
        mockPaymentId,
        mockPaymentMethodDetails,
        mockSecurityContext
      )).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Payment processing failed',
        expect.any(Object)
      );
    });
  });

  describe('refundPayment', () => {
    const mockPaymentId = '123e4567-e89b-12d3-a456-426614174000';
    const mockRefundReason: RefundReason = {
      code: 'CUSTOMER_REQUEST',
      description: 'Customer requested refund',
      authorizedBy: 'admin123'
    };

    it('should process refund successfully within timeout', async () => {
      const startTime = Date.now();
      const mockResponse: PaymentResponse = {
        transactionId: 're_123456',
        status: PaymentStatus.REFUNDED,
        amount: new Decimal(100.00),
        currency: 'USD',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          refunded: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        }
      };

      mockPaymentService.refundPayment.mockResolvedValue(mockResponse);

      const result = await controller.refundPayment(
        mockPaymentId,
        100.00,
        mockRefundReason
      );

      expect(Date.now() - startTime).toBeLessThan(testTimeout);
      expect(result).toEqual(mockResponse);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Initiating refund',
        expect.any(Object)
      );
    });
  });

  describe('getPaymentStatus', () => {
    const mockPaymentId = '123e4567-e89b-12d3-a456-426614174000';

    it('should retrieve payment status successfully', async () => {
      const mockResponse: DetailedPaymentStatus = {
        transactionId: 'ch_123456',
        status: PaymentStatus.COMPLETED,
        amount: new Decimal(100.00),
        currency: 'USD',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          processed: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        },
        processingDetails: {
          attempts: 1,
          lastAttemptTimestamp: new Date()
        },
        auditTrail: {
          events: [{
            timestamp: new Date(),
            action: 'PAYMENT_CREATED',
            actor: 'system',
            details: {}
          }]
        }
      };

      mockPaymentService.getPaymentStatus.mockResolvedValue(mockResponse);

      const result = await controller.getPaymentStatus(mockPaymentId);

      expect(result).toEqual(mockResponse);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Retrieving payment status',
        { paymentId: mockPaymentId }
      );
    });
  });
});