import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DonationService } from '../../src/modules/donation/donation.service';
import { PaymentService } from '../../src/modules/payment/payment.service';
import { CampaignService } from '../../src/modules/campaign/campaign.service';
import { DonationEntity } from '../../src/modules/donation/entities/donation.entity';
import { faker } from '@faker-js/faker';
import { 
  PaymentMethodType, 
  PaymentStatus,
  SecurityContext,
  PaymentMethodDetails,
  PaymentResponse 
} from '../../src/interfaces/payment-gateway.interface';
import { Messages } from '../../src/constants/messages.constant';

describe('DonationService', () => {
  let service: DonationService;
  let donationRepository: Repository<DonationEntity>;
  let paymentService: PaymentService;
  let campaignService: CampaignService;

  // Mock WebSocket server
  const mockServer = {
    emit: jest.fn()
  };

  // Test constants
  const TEST_TIMEOUT = 30000;
  const MOCK_USER_ID = faker.string.uuid();
  const MOCK_ASSOCIATION_ID = faker.string.uuid();
  const MOCK_CAMPAIGN_ID = faker.string.uuid();

  beforeAll(() => {
    jest.setTimeout(TEST_TIMEOUT);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DonationService,
        {
          provide: getRepositoryToken(DonationEntity),
          useValue: {
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            create: jest.fn()
          }
        },
        {
          provide: PaymentService,
          useValue: {
            processPayment: jest.fn(),
            validatePaymentMethod: jest.fn(),
            setupRecurringPayment: jest.fn()
          }
        },
        {
          provide: CampaignService,
          useValue: {
            findOne: jest.fn(),
            updateProgress: jest.fn(),
            notifyDonationReceived: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<DonationService>(DonationService);
    donationRepository = module.get<Repository<DonationEntity>>(getRepositoryToken(DonationEntity));
    paymentService = module.get<PaymentService>(PaymentService);
    campaignService = module.get<CampaignService>(CampaignService);

    // Assign mock server
    (service as any).server = mockServer;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSecureDonation', () => {
    const mockDonationDto = {
      amount: 100,
      currency: 'USD',
      userId: MOCK_USER_ID,
      associationId: MOCK_ASSOCIATION_ID,
      campaignId: MOCK_CAMPAIGN_ID,
      paymentMethodType: PaymentMethodType.CREDIT_CARD,
      isAnonymous: false,
      isRecurring: false
    };

    it('should create a donation successfully', async () => {
      const mockDonation = new DonationEntity();
      Object.assign(mockDonation, {
        id: faker.string.uuid(),
        ...mockDonationDto,
        status: PaymentStatus.PENDING
      });

      jest.spyOn(donationRepository, 'save').mockResolvedValue(mockDonation);
      jest.spyOn(campaignService, 'findOne').mockResolvedValue({} as any);

      const result = await service.createSecureDonation(mockDonationDto);

      expect(result).toBeDefined();
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(mockServer.emit).toHaveBeenCalledWith('donationCreated', expect.any(Object));
    });

    it('should validate campaign existence when campaignId provided', async () => {
      jest.spyOn(campaignService, 'findOne').mockRejectedValue(new Error('Campaign not found'));

      await expect(service.createSecureDonation(mockDonationDto))
        .rejects
        .toThrow('Campaign not found');
    });

    it('should handle anonymous donations correctly', async () => {
      const anonymousDonation = { ...mockDonationDto, isAnonymous: true };
      const mockDonation = new DonationEntity();
      Object.assign(mockDonation, {
        id: faker.string.uuid(),
        ...anonymousDonation,
        status: PaymentStatus.PENDING
      });

      jest.spyOn(donationRepository, 'save').mockResolvedValue(mockDonation);
      jest.spyOn(campaignService, 'findOne').mockResolvedValue({} as any);

      const result = await service.createSecureDonation(anonymousDonation);

      expect(result.isAnonymous).toBe(true);
      expect(mockServer.emit).toHaveBeenCalledWith('donationCreated', expect.any(Object));
    });
  });

  describe('processSecurePayment', () => {
    const mockPaymentMethodDetails: PaymentMethodDetails = {
      type: PaymentMethodType.CREDIT_CARD,
      tokenizedData: 'mock_token',
      billingAddress: {
        country: 'US',
        postalCode: '12345',
        city: 'Test City',
        addressLine: '123 Test St'
      }
    };

    const mockSecurityContext: SecurityContext = {
      sessionId: faker.string.uuid(),
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
      fraudChecksPassed: true,
      timestamp: new Date()
    };

    it('should process payment successfully', async () => {
      const mockDonation = new DonationEntity();
      Object.assign(mockDonation, {
        id: faker.string.uuid(),
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.PENDING
      });

      const mockPaymentResponse: PaymentResponse = {
        transactionId: faker.string.uuid(),
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
          riskAssessmentScore: 0,
          ipVerificationPassed: true
        }
      };

      jest.spyOn(donationRepository, 'findOne').mockResolvedValue(mockDonation);
      jest.spyOn(paymentService, 'processPayment').mockResolvedValue(mockPaymentResponse);
      jest.spyOn(donationRepository, 'save').mockResolvedValue({
        ...mockDonation,
        status: PaymentStatus.COMPLETED
      });

      const result = await service.processSecurePayment(
        mockDonation.id,
        mockPaymentMethodDetails,
        mockSecurityContext
      );

      expect(result.status).toBe(PaymentStatus.COMPLETED);
      expect(mockServer.emit).toHaveBeenCalledWith('donationProcessed', expect.any(Object));
    });

    it('should handle payment processing errors', async () => {
      const mockDonation = new DonationEntity();
      Object.assign(mockDonation, {
        id: faker.string.uuid(),
        status: PaymentStatus.PENDING
      });

      jest.spyOn(donationRepository, 'findOne').mockResolvedValue(mockDonation);
      jest.spyOn(paymentService, 'processPayment').mockRejectedValue(new Error('Payment failed'));

      await expect(service.processSecurePayment(
        mockDonation.id,
        mockPaymentMethodDetails,
        mockSecurityContext
      )).rejects.toThrow('Payment failed');

      expect(mockDonation.status).toBe(PaymentStatus.FAILED);
    });

    it('should update campaign progress after successful payment', async () => {
      const mockDonation = new DonationEntity();
      Object.assign(mockDonation, {
        id: faker.string.uuid(),
        amount: 100,
        currency: 'USD',
        campaignId: MOCK_CAMPAIGN_ID,
        status: PaymentStatus.PENDING
      });

      const mockPaymentResponse: PaymentResponse = {
        status: PaymentStatus.COMPLETED,
        transactionId: faker.string.uuid(),
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
          riskAssessmentScore: 0,
          ipVerificationPassed: true
        }
      };

      jest.spyOn(donationRepository, 'findOne').mockResolvedValue(mockDonation);
      jest.spyOn(paymentService, 'processPayment').mockResolvedValue(mockPaymentResponse);
      jest.spyOn(campaignService, 'updateProgress').mockResolvedValue({} as any);

      await service.processSecurePayment(
        mockDonation.id,
        mockPaymentMethodDetails,
        mockSecurityContext
      );

      expect(campaignService.updateProgress).toHaveBeenCalledWith(
        MOCK_CAMPAIGN_ID,
        100,
        'USD'
      );
    });
  });

  describe('getDonationWithAudit', () => {
    it('should retrieve donation with audit information', async () => {
      const mockDonation = new DonationEntity();
      Object.assign(mockDonation, {
        id: faker.string.uuid(),
        amount: 100,
        currency: 'USD',
        status: PaymentStatus.COMPLETED,
        metadata: {
          transactionId: faker.string.uuid(),
          securityChecks: {
            pciValidationPassed: true,
            fraudChecksPassed: true
          }
        }
      });

      jest.spyOn(donationRepository, 'findOne').mockResolvedValue(mockDonation);

      const result = await service.getDonationWithAudit(mockDonation.id);

      expect(result).toBeDefined();
      expect(result.id).toBe(mockDonation.id);
      expect(result.metadata).toBeDefined();
    });

    it('should throw error when donation not found', async () => {
      jest.spyOn(donationRepository, 'findOne').mockResolvedValue(null);

      await expect(service.getDonationWithAudit(faker.string.uuid()))
        .rejects
        .toThrow(Messages.VALIDATION.NOT_FOUND.templates.en.replace('{field}', 'Donation'));
    });
  });
});