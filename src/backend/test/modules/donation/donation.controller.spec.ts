import { Test, TestingModule } from '@nestjs/testing';
import { DonationController } from '../../src/modules/donation/donation.controller';
import { DonationService } from '../../src/modules/donation/donation.service';
import { PaymentMethodType, PaymentStatus, SecurityContext } from '../../interfaces/payment-gateway.interface';
import { faker } from '@faker-js/faker';
import { UnauthorizedException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Messages } from '../../constants/messages.constant';
import { ErrorCodes } from '../../constants/error-codes.constant';

describe('DonationController', () => {
  let controller: DonationController;
  let donationService: DonationService;

  // Mock security context for PCI compliance
  const mockSecurityContext: SecurityContext = {
    sessionId: faker.string.uuid(),
    ipAddress: faker.internet.ip(),
    userAgent: faker.internet.userAgent(),
    fraudChecksPassed: true,
    timestamp: new Date()
  };

  // Mock donation service with enhanced security
  const mockDonationService = {
    createSecureDonation: jest.fn(),
    processSecurePayment: jest.fn(),
    getDonationWithAudit: jest.fn(),
    findAll: jest.fn(),
    getDonationStats: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DonationController],
      providers: [
        {
          provide: DonationService,
          useValue: mockDonationService
        }
      ]
    }).compile();

    controller = module.get<DonationController>(DonationController);
    donationService = module.get<DonationService>(DonationService);
  });

  describe('create', () => {
    const mockCreateDonationDto = {
      amount: 100.00,
      currency: 'USD',
      paymentMethodType: PaymentMethodType.CREDIT_CARD,
      associationId: faker.string.uuid(),
      campaignId: faker.string.uuid(),
      isAnonymous: false,
      isRecurring: false
    };

    const mockRequest = {
      user: { id: faker.string.uuid() },
      sessionId: faker.string.uuid(),
      ip: faker.internet.ip(),
      headers: { 'user-agent': faker.internet.userAgent() },
      body: {
        paymentToken: 'tok_visa_testtoken',
        billingAddress: {
          country: 'US',
          postalCode: '12345',
          city: 'Test City',
          addressLine: '123 Test St'
        }
      }
    };

    it('should create donation with PCI compliance', async () => {
      const mockDonation = {
        id: faker.string.uuid(),
        ...mockCreateDonationDto,
        userId: mockRequest.user.id,
        status: PaymentStatus.PENDING
      };

      const mockPaymentResponse = {
        status: PaymentStatus.COMPLETED,
        transactionId: faker.string.uuid()
      };

      mockDonationService.createSecureDonation.mockResolvedValue(mockDonation);
      mockDonationService.processSecurePayment.mockResolvedValue(mockPaymentResponse);

      const result = await controller.create(mockCreateDonationDto, mockRequest);

      expect(result).toEqual({
        id: mockDonation.id,
        status: mockPaymentResponse.status,
        transactionId: mockPaymentResponse.transactionId
      });

      expect(mockDonationService.createSecureDonation).toHaveBeenCalledWith({
        ...mockCreateDonationDto,
        userId: mockRequest.user.id
      });

      expect(mockDonationService.processSecurePayment).toHaveBeenCalledWith(
        mockDonation.id,
        {
          type: mockCreateDonationDto.paymentMethodType,
          tokenizedData: mockRequest.body.paymentToken,
          billingAddress: mockRequest.body.billingAddress
        },
        expect.objectContaining({
          sessionId: mockRequest.sessionId,
          ipAddress: mockRequest.ip,
          userAgent: mockRequest.headers['user-agent'],
          fraudChecksPassed: true
        })
      );
    });

    it('should validate Israeli payment methods', async () => {
      const israeliDonationDto = {
        ...mockCreateDonationDto,
        currency: 'ILS',
        paymentMethodType: PaymentMethodType.ISRAELI_CREDIT_CARD
      };

      const mockDonation = {
        id: faker.string.uuid(),
        ...israeliDonationDto,
        userId: mockRequest.user.id,
        status: PaymentStatus.PENDING
      };

      mockDonationService.createSecureDonation.mockResolvedValue(mockDonation);
      mockDonationService.processSecurePayment.mockResolvedValue({
        status: PaymentStatus.COMPLETED,
        transactionId: faker.string.uuid()
      });

      await controller.create(israeliDonationDto, mockRequest);

      expect(mockDonationService.createSecureDonation).toHaveBeenCalledWith(
        expect.objectContaining({
          currency: 'ILS',
          paymentMethodType: PaymentMethodType.ISRAELI_CREDIT_CARD
        })
      );
    });

    it('should handle payment processing errors', async () => {
      mockDonationService.createSecureDonation.mockResolvedValue({
        id: faker.string.uuid(),
        status: PaymentStatus.PENDING
      });

      mockDonationService.processSecurePayment.mockRejectedValue(
        new Error('Payment gateway error')
      );

      await expect(controller.create(mockCreateDonationDto, mockRequest))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('findOne', () => {
    const mockDonationId = faker.string.uuid();
    const mockUserId = faker.string.uuid();

    it('should return donation with audit trail', async () => {
      const mockDonation = {
        id: mockDonationId,
        userId: mockUserId,
        isAnonymous: false,
        amount: 100,
        currency: 'USD'
      };

      mockDonationService.getDonationWithAudit.mockResolvedValue(mockDonation);

      const result = await controller.findOne(mockDonationId, { user: { id: mockUserId } });

      expect(result).toEqual(mockDonation);
      expect(mockDonationService.getDonationWithAudit).toHaveBeenCalledWith(mockDonationId);
    });

    it('should prevent unauthorized access to non-anonymous donations', async () => {
      const mockDonation = {
        id: mockDonationId,
        userId: faker.string.uuid(), // Different user
        isAnonymous: false
      };

      mockDonationService.getDonationWithAudit.mockResolvedValue(mockDonation);

      await expect(controller.findOne(mockDonationId, { user: { id: mockUserId } }))
        .rejects
        .toThrow(UnauthorizedException);
    });

    it('should allow access to anonymous donations', async () => {
      const mockDonation = {
        id: mockDonationId,
        userId: faker.string.uuid(),
        isAnonymous: true
      };

      mockDonationService.getDonationWithAudit.mockResolvedValue(mockDonation);

      const result = await controller.findOne(mockDonationId, { user: { id: mockUserId } });

      expect(result).toEqual(mockDonation);
    });

    it('should handle not found donations', async () => {
      mockDonationService.getDonationWithAudit.mockRejectedValue(
        new NotFoundException(Messages.VALIDATION.NOT_FOUND.templates.en.replace('{field}', 'Donation'))
      );

      await expect(controller.findOne(mockDonationId, { user: { id: mockUserId } }))
        .rejects
        .toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    const mockRequest = {
      user: {
        id: faker.string.uuid(),
        isAdmin: false
      }
    };

    it('should return filtered donations for regular users', async () => {
      const mockDonations = {
        items: [
          {
            id: faker.string.uuid(),
            amount: 100,
            currency: 'USD',
            userId: mockRequest.user.id
          }
        ],
        total: 1,
        page: 1,
        pages: 1
      };

      mockDonationService.findAll.mockResolvedValue(mockDonations);

      const result = await controller.findAll(1, 10, 'COMPLETED', mockRequest);

      expect(result).toEqual(mockDonations);
      expect(mockDonationService.findAll).toHaveBeenCalledWith(
        {
          status: 'COMPLETED',
          userId: mockRequest.user.id
        },
        1,
        10
      );
    });

    it('should return all donations for admin users', async () => {
      const adminRequest = {
        user: {
          id: faker.string.uuid(),
          isAdmin: true
        }
      };

      mockDonationService.findAll.mockResolvedValue({
        items: [],
        total: 0,
        page: 1,
        pages: 1
      });

      await controller.findAll(1, 10, 'COMPLETED', adminRequest);

      expect(mockDonationService.findAll).toHaveBeenCalledWith(
        {
          status: 'COMPLETED',
          userId: undefined
        },
        1,
        10
      );
    });

    it('should handle service errors', async () => {
      mockDonationService.findAll.mockRejectedValue(new Error('Database error'));

      await expect(controller.findAll(1, 10, 'COMPLETED', mockRequest))
        .rejects
        .toThrow(Error);
    });
  });

  describe('getStats', () => {
    const mockRequest = {
      user: { id: faker.string.uuid() }
    };

    it('should return donation statistics', async () => {
      const mockStats = {
        totalDonations: 10,
        totalAmount: 1000,
        currencies: {
          USD: 800,
          ILS: 200
        }
      };

      mockDonationService.getDonationStats.mockResolvedValue(mockStats);

      const result = await controller.getStats(mockRequest);

      expect(result).toEqual(mockStats);
      expect(mockDonationService.getDonationStats).toHaveBeenCalledWith(mockRequest.user.id);
    });

    it('should handle statistics errors', async () => {
      mockDonationService.getDonationStats.mockRejectedValue(new Error('Stats calculation error'));

      await expect(controller.getStats(mockRequest))
        .rejects
        .toThrow(Error);
    });
  });
});