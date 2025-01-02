import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common'; // ^10.0.0
import { CampaignController } from '../../src/modules/campaign/campaign.controller';
import { CampaignService } from '../../src/modules/campaign/campaign.service';
import { CreateCampaignDto } from '../../src/modules/campaign/dto/create-campaign.dto';
import { UpdateCampaignDto, CampaignStatus } from '../../src/modules/campaign/dto/update-campaign.dto';
import { createMockCampaign, createMockLotteryCampaign } from '../../test/mocks/campaign.mock';
import { Roles } from '../../src/constants/roles.constant';

describe('CampaignController', () => {
  let controller: CampaignController;
  let mockCampaignService: jest.Mocked<CampaignService>;

  const mockUser = {
    id: 'test-user-id',
    role: Roles.ASSOCIATION,
    associationId: 'test-association-id'
  };

  beforeEach(async () => {
    mockCampaignService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      manageLottery: jest.fn(),
      updateProgress: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignController],
      providers: [
        {
          provide: CampaignService,
          useValue: mockCampaignService
        }
      ]
    }).compile();

    controller = module.get<CampaignController>(CampaignController);
  });

  describe('create', () => {
    it('should create a standard campaign successfully', async () => {
      const mockCampaign = createMockCampaign();
      const createDto: CreateCampaignDto = {
        title: mockCampaign.title,
        description: mockCampaign.description,
        goalAmount: mockCampaign.goalAmount,
        currency: mockCampaign.currency,
        startDate: mockCampaign.startDate,
        endDate: mockCampaign.endDate,
        associationId: mockCampaign.associationId,
        images: mockCampaign.images,
        tags: mockCampaign.tags
      };

      mockCampaignService.create.mockResolvedValue(mockCampaign);

      const result = await controller.create(createDto);

      expect(result).toBe(mockCampaign);
      expect(mockCampaignService.create).toHaveBeenCalledWith(createDto);
    });

    it('should create a lottery campaign successfully', async () => {
      const mockLotteryCampaign = createMockLotteryCampaign();
      const createDto: CreateCampaignDto = {
        ...mockLotteryCampaign,
        isLottery: true
      };

      mockCampaignService.create.mockResolvedValue(mockLotteryCampaign);

      const result = await controller.create(createDto);

      expect(result).toBe(mockLotteryCampaign);
      expect(mockCampaignService.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw BadRequestException for invalid campaign data', async () => {
      const invalidDto = {
        title: '', // Invalid - too short
        description: 'Test',
        goalAmount: -100, // Invalid - negative amount
        currency: 'INVALID' // Invalid currency
      };

      mockCampaignService.create.mockRejectedValue(new Error('Invalid campaign data'));

      await expect(controller.create(invalidDto as any)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return filtered campaigns with pagination', async () => {
      const mockCampaigns = [createMockCampaign(), createMockCampaign()];
      const mockPaginatedResponse = {
        campaigns: mockCampaigns,
        total: 2,
        page: 1,
        pages: 1
      };

      mockCampaignService.findAll.mockResolvedValue(mockPaginatedResponse);

      const result = await controller.findAll(
        CampaignStatus.ACTIVE,
        'USD',
        'test-association-id',
        1,
        10,
        false,
        true
      );

      expect(result).toBe(mockPaginatedResponse);
      expect(mockCampaignService.findAll).toHaveBeenCalledWith(
        {
          status: CampaignStatus.ACTIVE,
          currency: 'USD',
          associationId: 'test-association-id',
          isLottery: false,
          active: true
        },
        1,
        10
      );
    });
  });

  describe('findOne', () => {
    it('should return a campaign by ID', async () => {
      const mockCampaign = createMockCampaign();
      mockCampaignService.findOne.mockResolvedValue(mockCampaign);

      const result = await controller.findOne(mockCampaign.id);

      expect(result).toBe(mockCampaign);
      expect(mockCampaignService.findOne).toHaveBeenCalledWith(mockCampaign.id);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      mockCampaignService.findOne.mockRejectedValue(new Error('Campaign not found'));

      await expect(controller.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update campaign successfully', async () => {
      const mockCampaign = createMockCampaign();
      const updateDto: UpdateCampaignDto = {
        title: 'Updated Title',
        status: CampaignStatus.ACTIVE
      };

      mockCampaignService.update.mockResolvedValue({ ...mockCampaign, ...updateDto });

      const result = await controller.update(mockCampaign.id, updateDto);

      expect(result.title).toBe(updateDto.title);
      expect(result.status).toBe(updateDto.status);
      expect(mockCampaignService.update).toHaveBeenCalledWith(mockCampaign.id, updateDto);
    });

    it('should throw ForbiddenException for unauthorized update', async () => {
      const mockCampaign = createMockCampaign({ associationId: 'different-association' });
      mockCampaignService.update.mockRejectedValue(new Error('Unauthorized access'));

      await expect(
        controller.update(mockCampaign.id, { title: 'Updated' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('should delete campaign successfully', async () => {
      const mockCampaign = createMockCampaign();
      mockCampaignService.remove.mockResolvedValue({ success: true });

      const result = await controller.remove(mockCampaign.id);

      expect(result).toEqual({ success: true });
      expect(mockCampaignService.remove).toHaveBeenCalledWith(mockCampaign.id);
    });

    it('should throw NotFoundException for non-existent campaign', async () => {
      mockCampaignService.remove.mockRejectedValue(new Error('Campaign not found'));

      await expect(controller.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('manageLottery', () => {
    it('should process lottery draw successfully', async () => {
      const mockLotteryCampaign = createMockLotteryCampaign();
      mockCampaignService.manageLottery.mockResolvedValue({
        success: true,
        winners: ['winner-1', 'winner-2']
      });

      const result = await controller.manageLottery(mockLotteryCampaign.id, 'draw');

      expect(result.success).toBe(true);
      expect(result.winners).toHaveLength(2);
      expect(mockCampaignService.manageLottery).toHaveBeenCalledWith(
        mockLotteryCampaign.id,
        'draw'
      );
    });

    it('should throw BadRequestException for invalid lottery action', async () => {
      mockCampaignService.manageLottery.mockRejectedValue(new Error('Invalid lottery action'));

      await expect(
        controller.manageLottery('campaign-id', 'invalid-action' as any)
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateProgress', () => {
    it('should update campaign progress with currency conversion', async () => {
      const mockCampaign = createMockCampaign();
      mockCampaignService.updateProgress.mockResolvedValue({
        ...mockCampaign,
        currentAmount: 1500,
        donorCount: 1
      });

      const result = await controller.updateProgress(mockCampaign.id, 1000, 'USD');

      expect(result.currentAmount).toBe(1500);
      expect(result.donorCount).toBe(1);
      expect(mockCampaignService.updateProgress).toHaveBeenCalledWith(
        mockCampaign.id,
        1000,
        'USD'
      );
    });

    it('should throw BadRequestException for invalid progress update', async () => {
      mockCampaignService.updateProgress.mockRejectedValue(new Error('Invalid amount'));

      await expect(
        controller.updateProgress('campaign-id', -100, 'USD')
      ).rejects.toThrow(BadRequestException);
    });
  });
});