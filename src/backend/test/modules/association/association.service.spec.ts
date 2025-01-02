import { Test, TestingModule } from '@nestjs/testing';
import { Repository, DataSource } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AssociationService } from '../../src/modules/association/association.service';
import { Association } from '../../src/modules/association/entities/association.entity';
import { createMockAssociation, createMockAssociationArray } from '../../test/mocks/association.mock';
import { PaymentMethodType, PaymentStatus } from '../../src/interfaces/payment-gateway.interface';

describe('AssociationService', () => {
  let service: AssociationService;
  let repository: Repository<Association>;
  let dataSource: DataSource;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      remove: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AssociationService,
        {
          provide: getRepositoryToken(Association),
          useClass: Repository,
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
      ],
    }).compile();

    service = module.get<AssociationService>(AssociationService);
    repository = module.get<Repository<Association>>(getRepositoryToken(Association));
    dataSource = module.get<DataSource>(DataSource);

    // Set encryption key in environment
    process.env.ASSOCIATION_ENCRYPTION_KEY = 'test-encryption-key-32-chars-long-!';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Data Security', () => {
    it('should encrypt sensitive data during association creation', async () => {
      const mockAssociation = createMockAssociation();
      const savedAssociation = { ...mockAssociation };

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      jest.spyOn(repository, 'create').mockReturnValue(savedAssociation);
      mockQueryRunner.manager.save.mockResolvedValue(savedAssociation);

      const result = await service.create(mockAssociation);

      expect(result.bankInfo).toBeUndefined();
      expect(mockQueryRunner.manager.save).toHaveBeenCalledWith(
        expect.objectContaining({
          bankInfo: expect.objectContaining({
            accountNumber: expect.stringMatching(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/),
            routingNumber: expect.stringMatching(/^[a-f0-9]+:[a-f0-9]+:[a-f0-9]+$/),
          }),
        }),
      );
    });

    it('should prevent duplicate association registration', async () => {
      const mockAssociation = createMockAssociation();
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAssociation);

      await expect(service.create(mockAssociation)).rejects.toThrow(ConflictException);
    });

    it('should validate access to sensitive data', async () => {
      const mockAssociation = createMockAssociation();
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAssociation);

      const result = await service.findOne(mockAssociation.id);
      expect(result.bankInfo).toBeUndefined();
    });
  });

  describe('Multi-Language Support', () => {
    it('should handle Hebrew association creation', async () => {
      const hebrewAssociation = createMockAssociation({}, 'he');
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      mockQueryRunner.manager.save.mockResolvedValue(hebrewAssociation);

      const result = await service.create(hebrewAssociation);

      expect(result.primaryLanguage).toBe('he');
      expect(result.supportedLanguages).toContain('he');
    });

    it('should validate primary language is in supported languages', async () => {
      const invalidAssociation = createMockAssociation({
        primaryLanguage: 'fr',
        supportedLanguages: ['he', 'en'],
      });

      await expect(service.create(invalidAssociation)).rejects.toThrow(BadRequestException);
    });

    it('should support French content management', async () => {
      const frenchAssociation = createMockAssociation({
        primaryLanguage: 'fr',
        supportedLanguages: ['fr', 'en', 'he'],
      });

      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      mockQueryRunner.manager.save.mockResolvedValue(frenchAssociation);

      const result = await service.create(frenchAssociation);
      expect(result.supportedLanguages).toContain('fr');
    });
  });

  describe('Association Management', () => {
    it('should create association with valid data', async () => {
      const mockAssociation = createMockAssociation();
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      mockQueryRunner.manager.save.mockResolvedValue(mockAssociation);

      const result = await service.create(mockAssociation);
      expect(result.id).toBeDefined();
      expect(result.status).toBe('PENDING');
      expect(result.isVerified).toBe(false);
    });

    it('should update association details', async () => {
      const mockAssociation = createMockAssociation();
      const updateData = {
        name: 'Updated Association Name',
        status: 'ACTIVE' as const,
      };

      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAssociation);
      mockQueryRunner.manager.save.mockResolvedValue({ ...mockAssociation, ...updateData });

      const result = await service.update(mockAssociation.id, updateData);
      expect(result.name).toBe(updateData.name);
      expect(result.status).toBe(updateData.status);
    });

    it('should verify association status', async () => {
      const mockAssociation = createMockAssociation({ isVerified: false, status: 'PENDING' });
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAssociation);
      mockQueryRunner.manager.save.mockResolvedValue({ ...mockAssociation, isVerified: true, status: 'ACTIVE' });

      const result = await service.verifyAssociation(mockAssociation.id);
      expect(result.isVerified).toBe(true);
      expect(result.status).toBe('ACTIVE');
    });

    it('should remove association', async () => {
      const mockAssociation = createMockAssociation();
      jest.spyOn(repository, 'findOne').mockResolvedValue(mockAssociation);

      await service.remove(mockAssociation.id);
      expect(mockQueryRunner.manager.remove).toHaveBeenCalledWith(mockAssociation);
    });
  });

  describe('Payment Processing', () => {
    it('should validate Israeli payment gateway configuration', async () => {
      const israeliAssociation = createMockAssociation({}, 'he');
      jest.spyOn(repository, 'findOne').mockResolvedValue(israeliAssociation);

      expect(israeliAssociation.paymentGateways.tranzilla).toBeDefined();
      expect(israeliAssociation.paymentGateways.tranzilla.enabledMethods).toContain(
        PaymentMethodType.ISRAELI_CREDIT_CARD
      );
    });

    it('should validate international payment gateway configuration', async () => {
      const internationalAssociation = createMockAssociation({}, 'en');
      jest.spyOn(repository, 'findOne').mockResolvedValue(internationalAssociation);

      expect(internationalAssociation.paymentGateways.stripe).toBeDefined();
      expect(internationalAssociation.paymentGateways.stripe.enabledMethods).toContain(
        PaymentMethodType.CREDIT_CARD
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent association', async () => {
      jest.spyOn(repository, 'findOne').mockResolvedValue(null);
      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should handle transaction failures', async () => {
      const mockAssociation = createMockAssociation();
      mockQueryRunner.manager.save.mockRejectedValue(new Error('Database error'));

      await expect(service.create(mockAssociation)).rejects.toThrow(Error);
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should validate required fields', async () => {
      const invalidAssociation = createMockAssociation();
      delete invalidAssociation.name;

      await expect(service.create(invalidAssociation)).rejects.toThrow();
    });
  });

  describe('Query Filtering', () => {
    it('should filter associations by status', async () => {
      const mockAssociations = createMockAssociationArray(3);
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockAssociations),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      const result = await service.findAll({ status: 'ACTIVE' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'association.status = :status',
        { status: 'ACTIVE' }
      );
      expect(result.length).toBe(3);
    });

    it('should filter associations by language', async () => {
      const queryBuilder = {
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      jest.spyOn(repository, 'createQueryBuilder').mockReturnValue(queryBuilder as any);

      await service.findAll({ language: 'he' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'association.supportedLanguages @> ARRAY[:language]',
        { language: 'he' }
      );
    });
  });
});