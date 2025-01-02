/**
 * @fileoverview Service layer for managing campaign operations with enhanced currency,
 * validation, and caching support
 * @version 1.0.0
 */

import { ICampaign, ICampaignProgress, CampaignStatus } from '../interfaces/campaign.interface';
import campaignsApi from '../api/campaigns';
import { CurrencyValidator } from '@ijad/currency-utils'; // ^1.0.0
import { CacheManager } from '@ijad/cache-manager'; // ^1.0.0
import { 
  CAMPAIGN_LIMITS, 
  CACHE_DURATION, 
  SUPPORTED_CURRENCIES 
} from '../config/constants';

/**
 * Service class for managing campaign operations with enhanced validation and caching
 */
export class CampaignService {
  private readonly cacheManager: CacheManager;
  private readonly currencyValidator: CurrencyValidator;

  constructor() {
    this.cacheManager = new CacheManager('campaigns');
    this.currencyValidator = new CurrencyValidator(SUPPORTED_CURRENCIES);
  }

  /**
   * Fetches a paginated list of campaigns with caching
   */
  public async fetchCampaigns(
    page: number = 1,
    limit: number = 10,
    filters: Record<string, any> = {}
  ): Promise<{ campaigns: ICampaign[]; total: number }> {
    const cacheKey = `campaigns_${page}_${limit}_${JSON.stringify(filters)}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const result = await campaignsApi.getCampaigns(filters, { page, limit });
    await this.cacheManager.set(cacheKey, result, CACHE_DURATION.CAMPAIGN_LIST);
    return result;
  }

  /**
   * Fetches a specific campaign by ID with caching
   */
  public async fetchCampaignById(id: string): Promise<ICampaign> {
    const cacheKey = `campaign_${id}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const campaign = await campaignsApi.getCampaignById(id);
    await this.cacheManager.set(cacheKey, campaign, CACHE_DURATION.CAMPAIGN_LIST);
    return campaign;
  }

  /**
   * Creates a new campaign with enhanced validation
   */
  public async createNewCampaign(campaignData: Omit<ICampaign, 'id'>): Promise<ICampaign> {
    // Validate currency
    if (!this.currencyValidator.isValid(campaignData.currency)) {
      throw new Error(`Invalid currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }

    // Validate goal amount
    if (
      campaignData.goalAmount < CAMPAIGN_LIMITS.MIN_GOAL_AMOUNT ||
      campaignData.goalAmount > CAMPAIGN_LIMITS.MAX_GOAL_AMOUNT
    ) {
      throw new Error(
        `Goal amount must be between ${CAMPAIGN_LIMITS.MIN_GOAL_AMOUNT} and ${CAMPAIGN_LIMITS.MAX_GOAL_AMOUNT}`
      );
    }

    // Validate campaign duration
    const startDate = new Date(campaignData.startDate);
    const endDate = new Date(campaignData.endDate);
    const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    if (
      durationDays < CAMPAIGN_LIMITS.MIN_DURATION_DAYS ||
      durationDays > CAMPAIGN_LIMITS.MAX_DURATION_DAYS
    ) {
      throw new Error(
        `Campaign duration must be between ${CAMPAIGN_LIMITS.MIN_DURATION_DAYS} and ${CAMPAIGN_LIMITS.MAX_DURATION_DAYS} days`
      );
    }

    // Validate lottery details if applicable
    if (campaignData.isLottery && campaignData.lotteryDetails) {
      this.validateLotteryDetails(campaignData.lotteryDetails);
    }

    const campaign = await campaignsApi.createCampaign(campaignData);
    await this.cacheManager.invalidatePattern('campaigns_*');
    return campaign;
  }

  /**
   * Updates an existing campaign with validation
   */
  public async updateExistingCampaign(
    id: string,
    updateData: Partial<ICampaign>
  ): Promise<ICampaign> {
    // Validate currency if included in update
    if (updateData.currency && !this.currencyValidator.isValid(updateData.currency)) {
      throw new Error(`Invalid currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }

    // Validate goal amount if included in update
    if (updateData.goalAmount !== undefined) {
      if (
        updateData.goalAmount < CAMPAIGN_LIMITS.MIN_GOAL_AMOUNT ||
        updateData.goalAmount > CAMPAIGN_LIMITS.MAX_GOAL_AMOUNT
      ) {
        throw new Error(
          `Goal amount must be between ${CAMPAIGN_LIMITS.MIN_GOAL_AMOUNT} and ${CAMPAIGN_LIMITS.MAX_GOAL_AMOUNT}`
        );
      }
    }

    const campaign = await campaignsApi.updateCampaign(id, updateData);
    await this.cacheManager.invalidate(`campaign_${id}`);
    await this.cacheManager.invalidatePattern('campaigns_*');
    return campaign;
  }

  /**
   * Removes a campaign and clears related cache
   */
  public async removeCampaign(id: string): Promise<void> {
    await campaignsApi.deleteCampaign(id);
    await this.cacheManager.invalidate(`campaign_${id}`);
    await this.cacheManager.invalidatePattern('campaigns_*');
  }

  /**
   * Fetches campaign progress with real-time data
   */
  public async fetchCampaignProgress(id: string): Promise<ICampaignProgress> {
    // Progress data is not cached to ensure real-time accuracy
    return await campaignsApi.getCampaignProgress(id);
  }

  /**
   * Fetches active lottery campaigns
   */
  public async fetchLotteryCampaigns(filters: Record<string, any> = {}): Promise<ICampaign[]> {
    const cacheKey = `lottery_campaigns_${JSON.stringify(filters)}`;
    const cached = await this.cacheManager.get(cacheKey);

    if (cached) {
      return cached;
    }

    const campaigns = await campaignsApi.getLotteryCampaigns(filters);
    await this.cacheManager.set(cacheKey, campaigns, CACHE_DURATION.CAMPAIGN_LIST);
    return campaigns;
  }

  /**
   * Validates lottery campaign details
   */
  private validateLotteryDetails(lotteryDetails: ICampaign['lotteryDetails']): void {
    if (!lotteryDetails) {
      throw new Error('Lottery details are required for lottery campaigns');
    }

    if (!this.currencyValidator.isValid(lotteryDetails.currency)) {
      throw new Error(`Invalid lottery currency. Supported currencies: ${SUPPORTED_CURRENCIES.join(', ')}`);
    }

    if (lotteryDetails.ticketPrice <= 0) {
      throw new Error('Ticket price must be greater than 0');
    }

    if (lotteryDetails.maxTickets <= 0) {
      throw new Error('Maximum number of tickets must be greater than 0');
    }

    if (!lotteryDetails.drawDate || new Date(lotteryDetails.drawDate) <= new Date()) {
      throw new Error('Draw date must be in the future');
    }

    if (!lotteryDetails.prizes || lotteryDetails.prizes.length === 0) {
      throw new Error('At least one prize must be specified');
    }
  }
}

// Export singleton instance
export default new CampaignService();