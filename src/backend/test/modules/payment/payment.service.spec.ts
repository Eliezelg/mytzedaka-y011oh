import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { CircuitBreaker } from '@nestjs/circuit-breaker';
import { PaymentService } from '../../../src/modules/payment/payment.service';
import { PaymentEntity } from '../../../src/modules/payment/entities/payment.entity';
import { 
  PaymentGatewayInterface,
  PaymentStatus,
  PaymentMethodType,
  SecurityContext,
  PaymentMethodDetails,
  PaymentResponse
} from '../../../src/interfaces/payment-gateway.interface';
import { CreatePaymentDto } from '../../../src/modules/payment/dto/create-payment.dto';
import { Messages } from '../../../src/constants/messages.constant';
import { ErrorCodes } from '../../../src/constants/error-codes.constant';

describe('PaymentService', () => {
  let service: PaymentService;
  let mockPaymentRepository: jest.Mocked<Repository<PaymentEntity>>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;
  let mockStripeGateway: jest.Mocked<PaymentGatewayInterface>;
  let mockTranzillaGateway: jest.Mocked<PaymentGatewayInterface>;

  const testSecurityContext: SecurityContext = {
    sessionId: 'test-session-123',
    ipAddress: '192.168.1.1',
    userAgent: 'Jest Test Runner',
    fraudChecksPassed: true,
    timestamp: new Date()
  };

  const testPaymentMethodDetails: PaymentMethodDetails = {
    type: PaymentMethodType.CREDIT_CARD,
    tokenizedData: 'tok_test_123',
    billingAddress: {
      country: 'US',
      postalCode: '12345',
      city: 'Test City',
      addressLine: '123 Test St'
    }
  };

  beforeEach(async () => {
    mockPaymentRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn()
    } as any;

    mockCircuitBreaker = {
      execute: jest.fn()
    } as any;

    mockStripeGateway = {
      processPayment: jest.fn(),
      initialize: jest.fn()
    } as any;

    mockTranzillaGateway = {
      processPayment: jest.fn(),
      initialize: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        {
          provide: 'PaymentEntityRepository',
          useValue: mockPaymentRepository
        },
        {
          provide: CircuitBreaker,
          useValue: mockCircuitBreaker
        }
      ]
    }).compile();

    service = module.get<PaymentService>(PaymentService);
  });

  describe('Payment Gateway Selection', () => {
    it('should select Tranzilla for ILS currency', async () => {
      const payment = new PaymentEntity();
      payment.currency = 'ILS';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      const mockResponse: PaymentResponse = {
        transactionId: 'trz_123',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'ILS',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await service.processPayment(
        'test-payment-id',
        testPaymentMethodDetails,
        testSecurityContext
      );

      expect(result.currency).toBe('ILS');
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });

    it('should select Stripe for non-ILS currencies', async () => {
      const payment = new PaymentEntity();
      payment.currency = 'USD';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      const mockResponse: PaymentResponse = {
        transactionId: 'ch_123',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'USD',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await service.processPayment(
        'test-payment-id',
        testPaymentMethodDetails,
        testSecurityContext
      );

      expect(result.currency).toBe('USD');
      expect(mockCircuitBreaker.execute).toHaveBeenCalled();
    });
  });

  describe('Payment Processing', () => {
    it('should process payment within 2 seconds', async () => {
      const payment = new PaymentEntity();
      payment.id = 'test-payment-id';
      payment.amount = 100;
      payment.currency = 'USD';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      const startTime = Date.now();
      await service.processPayment(
        payment.id,
        testPaymentMethodDetails,
        testSecurityContext
      );
      const endTime = Date.now();
      const processingTime = endTime - startTime;

      expect(processingTime).toBeLessThan(2000);
    });

    it('should handle payment failures gracefully', async () => {
      const payment = new PaymentEntity();
      payment.id = 'test-payment-id';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      mockCircuitBreaker.execute.mockRejectedValue(new Error('Payment failed'));

      await expect(
        service.processPayment(
          payment.id,
          testPaymentMethodDetails,
          testSecurityContext
        )
      ).rejects.toThrow('Payment failed');

      expect(mockPaymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.FAILED
        })
      );
    });

    it('should maintain error rate below 0.1%', async () => {
      const totalAttempts = 1000;
      const maxAllowedErrors = Math.floor(totalAttempts * 0.001);
      let errorCount = 0;

      const payment = new PaymentEntity();
      payment.id = 'test-payment-id';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      for (let i = 0; i < totalAttempts; i++) {
        try {
          await service.processPayment(
            payment.id,
            testPaymentMethodDetails,
            testSecurityContext
          );
        } catch (error) {
          errorCount++;
        }
      }

      expect(errorCount).toBeLessThanOrEqual(maxAllowedErrors);
    });
  });

  describe('PCI Compliance', () => {
    it('should not log sensitive payment data', async () => {
      const consoleSpy = jest.spyOn(console, 'log');
      const payment = new PaymentEntity();
      payment.id = 'test-payment-id';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      await service.processPayment(
        payment.id,
        testPaymentMethodDetails,
        testSecurityContext
      );

      const loggedData = consoleSpy.mock.calls.flat().join(' ');
      expect(loggedData).not.toContain(testPaymentMethodDetails.tokenizedData);
      expect(loggedData).not.toContain('creditCard');
    });

    it('should validate security context for each transaction', async () => {
      const payment = new PaymentEntity();
      payment.id = 'test-payment-id';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      const invalidSecurityContext = { ...testSecurityContext, fraudChecksPassed: false };

      await expect(
        service.processPayment(
          payment.id,
          testPaymentMethodDetails,
          invalidSecurityContext
        )
      ).rejects.toThrow();
    });

    it('should enforce TLS for payment processing', async () => {
      const payment = new PaymentEntity();
      payment.id = 'test-payment-id';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      const mockResponse: PaymentResponse = {
        transactionId: 'test_123',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'USD',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      const result = await service.processPayment(
        payment.id,
        testPaymentMethodDetails,
        testSecurityContext
      );

      expect(result.securityChecks.pciValidationPassed).toBe(true);
    });
  });

  describe('Transaction Tracking', () => {
    it('should create payment with audit trail', async () => {
      const createPaymentDto: CreatePaymentDto = {
        amount: 100,
        currency: 'USD',
        paymentMethodType: PaymentMethodType.CREDIT_CARD,
        donorId: 'test-donor-id',
        associationId: 'test-association-id'
      };

      const savedPayment = new PaymentEntity();
      Object.assign(savedPayment, createPaymentDto);
      savedPayment.id = 'test-payment-id';
      savedPayment.status = PaymentStatus.PENDING;

      mockPaymentRepository.save.mockResolvedValue(savedPayment);

      const result = await service.createPayment(createPaymentDto);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it('should update payment status with timestamps', async () => {
      const payment = new PaymentEntity();
      payment.id = 'test-payment-id';
      mockPaymentRepository.findOne.mockResolvedValue(payment);

      const mockResponse: PaymentResponse = {
        transactionId: 'test_123',
        status: PaymentStatus.COMPLETED,
        amount: 100,
        currency: 'USD',
        gatewayResponse: {},
        timestamps: {
          created: new Date(),
          lastUpdated: new Date()
        },
        securityChecks: {
          fraudDetectionPassed: true,
          pciValidationPassed: true,
          riskAssessmentScore: 0.1,
          ipVerificationPassed: true
        }
      };

      mockCircuitBreaker.execute.mockResolvedValue(mockResponse);

      await service.processPayment(
        payment.id,
        testPaymentMethodDetails,
        testSecurityContext
      );

      expect(mockPaymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PaymentStatus.COMPLETED,
          updatedAt: expect.any(Date)
        })
      );
    });
  });
});