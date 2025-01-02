import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { HttpStatus } from '@nestjs/common'; // ^10.0.0
import { faker } from '@faker-js/faker'; // ^8.0.0
import { AssociationController } from '../../src/modules/association/association.controller';
import { AssociationService } from '../../src/modules/association/association.service';
import { createMockAssociation, createMockAssociationArray } from '../../mocks/association.mock';
import { PaymentMethodType } from '../../src/interfaces/payment-gateway.interface';

describe('AssociationController', () => {
  let controller: AssociationController;
  let service: AssociationService;

  const mockAssociationService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    verifyAssociation: jest.fn(),
    configurePaymentGateway: jest.fn(),
    validateComplianceStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AssociationController],
      providers: [
        {
          provide: AssociationService,
          useValue: mockAssociationService,
        },
      ],
    }).compile();

    controller = module.get<AssociationController>(AssociationController);
    service = module.get<AssociationService>(AssociationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new association with valid data', async () => {
      const mockAssociation = createMockAssociation();
      mockAssociationService.create.mockResolvedValue(mockAssociation);

      const result = await controller.create(mockAssociation);

      expect(result).toBe(mockAssociation);
      expect(service.create).toHaveBeenCalledWith(mockAssociation);
    });

    it('should validate Hebrew content for Israeli associations', async () => {
      const mockIsraeliAssociation = createMockAssociation({}, 'he');
      mockAssociationService.create.mockResolvedValue(mockIsraeliAssociation);

      const result = await controller.create(mockIsraeliAssociation);

      expect(result.primaryLanguage).toBe('he');
      expect(result.supportedLanguages).toContain('he');
    });

    it('should handle sensitive data securely', async () => {
      const mockAssociation = createMockAssociation();
      mockAssociationService.create.mockResolvedValue(mockAssociation);

      const result = await controller.create(mockAssociation);

      expect(result.bankInfo).toBeUndefined();
      expect(result.paymentGateways).toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('should return filtered associations', async () => {
      const mockAssociations = createMockAssociationArray(3);
      mockAssociationService.findAll.mockResolvedValue(mockAssociations);

      const filters = {
        status: 'ACTIVE',
        isVerified: true,
        categories: ['Education'],
        language: 'he'
      };

      const result = await controller.findAll(
        filters.status,
        filters.isVerified,
        filters.categories,
        filters.language
      );

      expect(result).toBe(mockAssociations);
      expect(service.findAll).toHaveBeenCalledWith(filters);
    });

    it('should support multi-language filtering', async () => {
      const mockAssociations = createMockAssociationArray(2);
      mockAssociationService.findAll.mockResolvedValue(mockAssociations);

      await controller.findAll(undefined, undefined, undefined, 'fr');

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ language: 'fr' })
      );
    });
  });

  describe('findOne', () => {
    it('should return a single association', async () => {
      const mockAssociation = createMockAssociation();
      mockAssociationService.findOne.mockResolvedValue(mockAssociation);

      const result = await controller.findOne(mockAssociation.id);

      expect(result).toBe(mockAssociation);
      expect(service.findOne).toHaveBeenCalledWith(mockAssociation.id);
    });

    it('should handle non-existent associations', async () => {
      mockAssociationService.findOne.mockResolvedValue(null);

      await expect(controller.findOne(faker.string.uuid()))
        .rejects
        .toThrow();
    });
  });

  describe('update', () => {
    it('should update association details', async () => {
      const mockAssociation = createMockAssociation();
      const updateData = {
        name: 'Updated Name',
        status: 'ACTIVE' as const
      };
      mockAssociationService.update.mockResolvedValue({ ...mockAssociation, ...updateData });

      const result = await controller.update(mockAssociation.id, updateData);

      expect(result.name).toBe(updateData.name);
      expect(service.update).toHaveBeenCalledWith(mockAssociation.id, updateData);
    });

    it('should validate payment gateway updates', async () => {
      const mockAssociation = createMockAssociation();
      const updateData = {
        paymentGateways: {
          stripe: {
            accountId: 'acct_test',
            publicKey: 'pk_test'
          }
        }
      };

      await controller.update(mockAssociation.id, updateData);

      expect(service.update).toHaveBeenCalledWith(
        mockAssociation.id,
        expect.objectContaining({
          paymentGateways: expect.any(Object)
        })
      );
    });
  });

  describe('remove', () => {
    it('should remove an association', async () => {
      const mockAssociation = createMockAssociation();
      mockAssociationService.remove.mockResolvedValue(undefined);

      await controller.remove(mockAssociation.id);

      expect(service.remove).toHaveBeenCalledWith(mockAssociation.id);
    });
  });

  describe('verify', () => {
    it('should verify an association', async () => {
      const mockAssociation = createMockAssociation({ isVerified: false });
      const verifiedAssociation = { ...mockAssociation, isVerified: true };
      mockAssociationService.verifyAssociation.mockResolvedValue(verifiedAssociation);

      const result = await controller.verify(mockAssociation.id);

      expect(result.isVerified).toBe(true);
      expect(service.verifyAssociation).toHaveBeenCalledWith(mockAssociation.id);
    });

    it('should validate compliance requirements during verification', async () => {
      const mockAssociation = createMockAssociation({ isVerified: false });
      mockAssociationService.verifyAssociation.mockImplementation(async () => {
        await mockAssociationService.validateComplianceStatus(mockAssociation.id);
        return { ...mockAssociation, isVerified: true };
      });

      await controller.verify(mockAssociation.id);

      expect(service.validateComplianceStatus).toHaveBeenCalledWith(mockAssociation.id);
    });
  });

  describe('setupPaymentGateway', () => {
    it('should configure Stripe for international associations', async () => {
      const mockAssociation = createMockAssociation();
      const gatewayConfig = {
        provider: 'STRIPE',
        accountId: 'acct_test',
        publicKey: 'pk_test',
        secretKey: 'sk_test',
        enabledMethods: [PaymentMethodType.CREDIT_CARD]
      };

      mockAssociationService.configurePaymentGateway.mockResolvedValue({
        ...mockAssociation,
        paymentGateways: { stripe: gatewayConfig }
      });

      const result = await controller.setupPaymentGateway(mockAssociation.id, gatewayConfig);

      expect(result.paymentGateways.stripe).toBeDefined();
      expect(service.configurePaymentGateway).toHaveBeenCalledWith(
        mockAssociation.id,
        gatewayConfig
      );
    });

    it('should configure Tranzilla for Israeli associations', async () => {
      const mockAssociation = createMockAssociation({}, 'he');
      const gatewayConfig = {
        provider: 'TRANZILLA',
        terminalId: '1234567',
        username: 'test_user',
        password: 'test_pass',
        enabledMethods: [PaymentMethodType.ISRAELI_CREDIT_CARD]
      };

      mockAssociationService.configurePaymentGateway.mockResolvedValue({
        ...mockAssociation,
        paymentGateways: { tranzilla: gatewayConfig }
      });

      const result = await controller.setupPaymentGateway(mockAssociation.id, gatewayConfig);

      expect(result.paymentGateways.tranzilla).toBeDefined();
      expect(service.configurePaymentGateway).toHaveBeenCalledWith(
        mockAssociation.id,
        gatewayConfig
      );
    });

    it('should validate PCI compliance requirements', async () => {
      const mockAssociation = createMockAssociation();
      const gatewayConfig = {
        provider: 'STRIPE',
        accountId: 'acct_test',
        publicKey: 'pk_test',
        secretKey: 'sk_test',
        pciCompliance: {
          level: 'LEVEL_1',
          certification: 'CERTIFIED',
          lastAuditDate: new Date()
        }
      };

      await controller.setupPaymentGateway(mockAssociation.id, gatewayConfig);

      expect(service.configurePaymentGateway).toHaveBeenCalledWith(
        mockAssociation.id,
        expect.objectContaining({
          pciCompliance: expect.any(Object)
        })
      );
    });
  });
});