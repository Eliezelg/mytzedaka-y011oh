import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { performance } from 'perf_hooks';
import { Decimal } from 'decimal.js';

import { CampaignService } from '../../src/modules/campaign/campaign.service';
import { LotteryService } from '../../src/modules/lottery/lottery.service';
import { CurrencyService } from '../../src/modules/currency/currency.service';
import { Campaign, CampaignStatus } from '../../src/modules/campaign/entities/campaign.entity';
import { CreateCampaignDto } from '../../src/modules/campaign/dto/create-campaign.dto';
import { UpdateCampaignDto } from '../../src/modules/campaign/dto/update-campaign.dto';

describe('CampaignService', () => {
  let campaignService: CampaignService;
  let lotteryService: LotteryService;
  let currencyService: CurrencyService;
  let campaignModel: Model<Campaign>;
  let module: TestingModule;

  // Mock WebSocket Gateway
  @WebSocketGateway()
  class MockWebSocketGateway {
    @WebSocketServer()
    server = {
      emit: jest.fn()
    };
  }

  const mockCampaignModel = {
    new: jest.fn(),
    constructor: jest.fn(),
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    countDocuments: jest.fn(),
    startSession: jest.fn(() => ({
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn()
    }))
  };

  const mockLotteryService = {
    initializeLottery: jest.fn(),
    addEntry: jest.fn(),
    validateLotteryUpdate: jest.fn(),
    processLotteryAction: jest.fn()
  };

  const mockCurrencyService = {
    validateCurrency: jest.fn(),
    convert: jest.fn()
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CampaignService,
        {
          provide: getModelToken(Campaign.name),
          useValue: mockCampaignModel
        },
        {
          provide: LotteryService,
          useValue: mockLotteryService
        },
        {
          provide: CurrencyService,
          useValue: mockCurrencyService
        },
        MockWebSocketGateway
      ]
    }).compile();

    campaignService = module.get<CampaignService>(CampaignService);
    lotteryService = module.get<LotteryService>(LotteryService);
    currencyService = module.get<CurrencyService>(CurrencyService);
    campaignModel = module.get<Model<Campaign>>(getModelToken(Campaign.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Campaign Creation', () => {
    const createCampaignDto: CreateCampaignDto = {
      title: 'Test Campaign',
      description: 'Test Description',
      goalAmount: 10000,
      currency: 'USD',
      startDate: new Date(),
      endDate: new Date(Date.now() + 86400000),
      associationId: 'test-association-id',
      isLottery: false
    };

    it('should create a campaign successfully', async () => {
      const savedCampaign = { ...createCampaignDto, id: 'test-id' };
      mockCampaignModel.save.mockResolvedValue(savedCampaign);
      mockCurrencyService.validateCurrency.mockResolvedValue(true);

      const result = await campaignService.create(createCampaignDto);

      expect(result).toEqual(savedCampaign);
      expect(mockCurrencyService.validateCurrency).toHaveBeenCalledWith('USD');
    });

    it('should validate dates during campaign creation', async () => {
      const invalidDto = {
        ...createCampaignDto,
        endDate: new Date(Date.now() - 86400000)
      };

      await expect(campaignService.create(invalidDto)).rejects.toThrow('End date must be after start date');
    });
  });

  describe('Lottery Campaigns', () => {
    const lotteryDto: CreateCampaignDto = {
      ...createCampaignDto,
      isLottery: true,
      prizes: [
        { name: 'First Prize', value: 1000, currency: 'USD' }
      ]
    };

    it('should initialize lottery details for lottery campaigns', async () => {
      const lotteryDetails = {
        drawDate: new Date(),
        prizes: lotteryDto.prizes
      };
      mockLotteryService.initializeLottery.mockResolvedValue(lotteryDetails);
      mockCampaignModel.save.mockResolvedValue({ ...lotteryDto, id: 'test-id', lotteryDetails });

      const result = await campaignService.create(lotteryDto);

      expect(result.lotteryDetails).toEqual(lotteryDetails);
      expect(mockLotteryService.initializeLottery).toHaveBeenCalled();
    });

    it('should process lottery winner selection', async () => {
      const campaignId = 'test-campaign-id';
      const winnerResult = { userId: 'winner-id', prize: lotteryDto.prizes[0] };
      mockLotteryService.processLotteryAction.mockResolvedValue(winnerResult);

      const result = await campaignService.manageLottery(campaignId, 'draw');

      expect(result).toEqual(winnerResult);
      expect(mockLotteryService.processLotteryAction).toHaveBeenCalledWith(campaignId, 'draw');
    });
  });

  describe('Multi-Currency Support', () => {
    it('should handle currency conversion for donations', async () => {
      const campaignId = 'test-id';
      const amount = 100;
      const fromCurrency = 'EUR';
      const toCurrency = 'USD';
      
      const campaign = {
        id: campaignId,
        currency: toCurrency,
        isActive: () => true
      };

      mockCampaignModel.findById.mockResolvedValue(campaign);
      mockCurrencyService.convert.mockResolvedValue(new Decimal(120));

      const result = await campaignService.updateProgress(campaignId, amount, fromCurrency);

      expect(mockCurrencyService.convert).toHaveBeenCalledWith(
        new Decimal(amount),
        fromCurrency,
        toCurrency
      );
      expect(result.currentAmount).toBe(120);
    });

    it('should validate currencies during campaign updates', async () => {
      const updateDto: UpdateCampaignDto = {
        currency: 'GBP'
      };

      mockCampaignModel.findById.mockResolvedValue({ id: 'test-id' });
      mockCurrencyService.validateCurrency.mockResolvedValue(true);

      await campaignService.update('test-id', updateDto);

      expect(mockCurrencyService.validateCurrency).toHaveBeenCalledWith('GBP');
    });
  });

  describe('Performance Benchmarks', () => {
    it('should process campaign updates within 2 seconds', async () => {
      const startTime = performance.now();
      
      await campaignService.updateProgress('test-id', 100, 'USD');
      
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      
      expect(processingTime).toBeLessThan(2000);
    });

    it('should handle concurrent campaign queries efficiently', async () => {
      const queries = Array(100).fill(null).map(() => 
        campaignService.findAll({ status: CampaignStatus.ACTIVE })
      );

      const startTime = performance.now();
      await Promise.all(queries);
      const endTime = performance.now();
      
      const averageQueryTime = (endTime - startTime) / 100;
      expect(averageQueryTime).toBeLessThan(100);
    });
  });

  describe('Real-time Updates', () => {
    it('should emit campaign progress updates', async () => {
      const campaign = {
        id: 'test-id',
        currentAmount: 1000,
        donorCount: 10,
        getProgress: () => 50,
        isActive: () => true
      };

      mockCampaignModel.findById.mockResolvedValue(campaign);
      mockCurrencyService.convert.mockResolvedValue(new Decimal(100));

      await campaignService.updateProgress('test-id', 100, 'USD');

      expect(module.get(MockWebSocketGateway).server.emit).toHaveBeenCalledWith(
        'campaignProgress',
        expect.objectContaining({
          id: 'test-id',
          currentAmount: expect.any(Number),
          progress: expect.any(Number),
          donorCount: expect.any(Number)
        })
      );
    });
  });
});