import { Injectable } from '@nestjs/common'; // ^10.0.0
import { InjectModel } from '@nestjs/mongoose'; // ^10.0.0
import { Model } from 'mongoose'; // ^7.5.0
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'; // ^10.0.0
import { Server } from 'socket.io'; // ^4.7.0
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto, CampaignStatus } from './dto/update-campaign.dto';
import { Campaign, CampaignLotteryDetails } from './entities/campaign.entity';
import { CurrencyService } from '../currency/currency.service';
import { LotteryService } from '../lottery/lottery.service';
import { Decimal } from 'decimal.js'; // ^10.4.3

/**
 * Service implementing comprehensive campaign management including creation,
 * updates, progress tracking, lottery handling, and multi-currency support
 */
@Injectable()
@WebSocketGateway({
  cors: true,
  namespace: 'campaigns'
})
export class CampaignService {
  @WebSocketServer()
  private server: Server;

  constructor(
    @InjectModel(Campaign.name) private campaignModel: Model<Campaign>,
    private readonly currencyService: CurrencyService,
    private readonly lotteryService: LotteryService
  ) {}

  /**
   * Creates a new campaign with validation and real-time notification
   */
  async create(createCampaignDto: CreateCampaignDto): Promise<Campaign> {
    const session = await this.campaignModel.startSession();
    session.startTransaction();

    try {
      // Validate dates
      if (createCampaignDto.endDate <= createCampaignDto.startDate) {
        throw new Error('End date must be after start date');
      }

      // Validate currency
      await this.currencyService.validateCurrency(createCampaignDto.currency);

      // Initialize campaign
      const campaign = new this.campaignModel({
        ...createCampaignDto,
        status: CampaignStatus.DRAFT,
        currentAmount: 0,
        donorCount: 0
      });

      // Setup lottery if enabled
      if (createCampaignDto.isLottery) {
        const lotteryDetails = await this.lotteryService.initializeLottery(
          createCampaignDto.prizes,
          createCampaignDto.endDate
        );
        campaign.lotteryDetails = lotteryDetails;
      }

      // Save campaign
      const savedCampaign = await campaign.save({ session });
      await session.commitTransaction();

      // Emit creation event
      this.server.emit('campaignCreated', {
        id: savedCampaign.id,
        title: savedCampaign.title,
        associationId: savedCampaign.associationId
      });

      return savedCampaign;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates campaign progress with real-time notifications
   */
  async updateProgress(
    id: string,
    amount: number,
    currency: string
  ): Promise<Campaign> {
    const session = await this.campaignModel.startSession();
    session.startTransaction();

    try {
      const campaign = await this.campaignModel.findById(id).session(session);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      if (!campaign.isActive()) {
        throw new Error('Campaign is not active');
      }

      // Convert amount to campaign currency if different
      const convertedAmount = await this.currencyService.convert(
        new Decimal(amount),
        currency,
        campaign.currency
      );

      // Update campaign amounts
      campaign.currentAmount = new Decimal(campaign.currentAmount)
        .plus(convertedAmount)
        .toNumber();
      campaign.donorCount += 1;

      // Update lottery entries if applicable
      if (campaign.isLottery) {
        await this.lotteryService.addEntry(
          campaign.id,
          convertedAmount.toNumber()
        );
      }

      // Save updates
      const updatedCampaign = await campaign.save({ session });
      await session.commitTransaction();

      // Emit progress update
      this.server.emit('campaignProgress', {
        id: campaign.id,
        currentAmount: campaign.currentAmount,
        progress: campaign.getProgress(),
        donorCount: campaign.donorCount
      });

      return updatedCampaign;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Updates campaign details with validation
   */
  async update(
    id: string,
    updateCampaignDto: UpdateCampaignDto
  ): Promise<Campaign> {
    const session = await this.campaignModel.startSession();
    session.startTransaction();

    try {
      const campaign = await this.campaignModel.findById(id).session(session);
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Validate currency if updating
      if (updateCampaignDto.currency) {
        await this.currencyService.validateCurrency(updateCampaignDto.currency);
      }

      // Update campaign
      Object.assign(campaign, updateCampaignDto);

      // Validate lottery updates if applicable
      if (updateCampaignDto.isLottery !== undefined) {
        await this.lotteryService.validateLotteryUpdate(
          campaign.id,
          updateCampaignDto.prizes
        );
      }

      const updatedCampaign = await campaign.save({ session });
      await session.commitTransaction();

      // Emit update event
      this.server.emit('campaignUpdated', {
        id: updatedCampaign.id,
        status: updatedCampaign.status
      });

      return updatedCampaign;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Manages lottery aspects of campaigns
   */
  async manageLottery(
    campaignId: string,
    action: 'draw' | 'cancel' | 'verify'
  ): Promise<any> {
    const campaign = await this.campaignModel.findById(campaignId);
    if (!campaign || !campaign.isLottery) {
      throw new Error('Invalid lottery campaign');
    }

    const result = await this.lotteryService.processLotteryAction(
      campaignId,
      action
    );

    // Emit lottery update
    this.server.emit('lotteryUpdate', {
      campaignId,
      action,
      result
    });

    return result;
  }

  /**
   * Retrieves campaign details with progress
   */
  async findOne(id: string): Promise<Campaign> {
    const campaign = await this.campaignModel.findById(id);
    if (!campaign) {
      throw new Error('Campaign not found');
    }
    return campaign;
  }

  /**
   * Lists campaigns with filtering and pagination
   */
  async findAll(filters: any = {}, page = 1, limit = 10): Promise<{
    campaigns: Campaign[];
    total: number;
    page: number;
    pages: number;
  }> {
    const query = this.buildQuery(filters);
    const total = await this.campaignModel.countDocuments(query);
    const campaigns = await this.campaignModel
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    return {
      campaigns,
      total,
      page,
      pages: Math.ceil(total / limit)
    };
  }

  /**
   * Builds MongoDB query from filters
   */
  private buildQuery(filters: any): any {
    const query: any = {};

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.associationId) {
      query.associationId = filters.associationId;
    }

    if (filters.isLottery !== undefined) {
      query.isLottery = filters.isLottery;
    }

    if (filters.active) {
      query.startDate = { $lte: new Date() };
      query.endDate = { $gte: new Date() };
      query.status = CampaignStatus.ACTIVE;
    }

    return query;
  }
}