import { Injectable, Logger } from '@nestjs/common'; // ^10.0.0
import { Cache } from '@nestjs/cache-manager'; // ^2.0.0
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets'; // ^10.0.0
import { Server } from 'socket.io'; // ^4.7.0
import { AnalyticsQueryDto, MetricType } from './dto/analytics-query.dto';
import { DonationService } from '../donation/donation.service';
import { CampaignService } from '../campaign/campaign.service';
import Decimal from 'decimal.js'; // ^10.4.3

/**
 * Enhanced analytics service implementing comprehensive metrics calculation
 * and real-time reporting with multi-currency support and caching optimization
 */
@Injectable()
@WebSocketGateway({
  namespace: 'analytics',
  cors: true
})
export class AnalyticsService {
  @WebSocketServer()
  private server: Server;
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly CACHE_TTL = 300; // 5 minutes cache

  constructor(
    private readonly donationService: DonationService,
    private readonly campaignService: CampaignService,
    private readonly cache: Cache
  ) {}

  /**
   * Retrieves comprehensive analytics metrics with real-time updates
   * @param query Analytics query parameters
   * @returns Calculated metrics with trend analysis
   */
  async getMetrics(query: AnalyticsQueryDto): Promise<any> {
    const cacheKey = this.generateCacheKey(query);
    const cachedData = await this.cache.get(cacheKey);

    if (cachedData) {
      return cachedData;
    }

    try {
      let metrics;
      switch (query.metricType) {
        case MetricType.DONATION:
          metrics = await this.getDonationMetrics(
            query.startDate,
            query.endDate,
            query.associationId
          );
          break;
        case MetricType.CAMPAIGN:
          metrics = await this.getCampaignMetrics(
            query.startDate,
            query.endDate,
            query.associationId
          );
          break;
        case MetricType.ASSOCIATION:
          metrics = await this.getAssociationMetrics(
            query.startDate,
            query.endDate,
            query.associationId
          );
          break;
        default:
          throw new Error('Invalid metric type');
      }

      // Cache results
      await this.cache.set(cacheKey, metrics, this.CACHE_TTL);

      // Emit real-time update
      this.server.emit('analyticsUpdate', {
        type: query.metricType,
        data: metrics
      });

      return metrics;
    } catch (error) {
      this.logger.error(`Error calculating metrics: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Calculates comprehensive donation metrics with trend analysis
   * @param startDate Start date for analysis period
   * @param endDate End date for analysis period
   * @param associationId Optional association filter
   * @returns Detailed donation metrics and trends
   */
  private async getDonationMetrics(
    startDate: Date,
    endDate: Date,
    associationId?: string
  ): Promise<any> {
    const donations = associationId
      ? await this.donationService.findByAssociation(associationId, startDate, endDate)
      : await this.donationService.findAll(startDate, endDate);

    const metrics = {
      totalAmount: new Decimal(0),
      donationCount: 0,
      averageDonation: new Decimal(0),
      currencyBreakdown: {} as Record<string, Decimal>,
      hourlyDistribution: new Array(24).fill(0),
      trends: {
        daily: [] as any[],
        weekly: [] as any[],
        monthly: [] as any[]
      }
    };

    // Process donations
    for (const donation of donations) {
      // Update totals
      metrics.totalAmount = metrics.totalAmount.plus(donation.amount);
      metrics.donationCount++;

      // Update currency breakdown
      if (!metrics.currencyBreakdown[donation.currency]) {
        metrics.currencyBreakdown[donation.currency] = new Decimal(0);
      }
      metrics.currencyBreakdown[donation.currency] = metrics.currencyBreakdown[donation.currency].plus(donation.amount);

      // Update hourly distribution
      const hour = new Date(donation.createdAt).getHours();
      metrics.hourlyDistribution[hour]++;
    }

    // Calculate averages
    metrics.averageDonation = metrics.donationCount > 0
      ? metrics.totalAmount.dividedBy(metrics.donationCount)
      : new Decimal(0);

    // Calculate trends
    metrics.trends = await this.calculateTrends(donations, startDate, endDate);

    return {
      ...metrics,
      totalAmount: metrics.totalAmount.toNumber(),
      averageDonation: metrics.averageDonation.toNumber(),
      currencyBreakdown: Object.fromEntries(
        Object.entries(metrics.currencyBreakdown).map(([k, v]) => [k, v.toNumber()])
      )
    };
  }

  /**
   * Calculates campaign performance metrics
   * @param startDate Start date for analysis period
   * @param endDate End date for analysis period
   * @param associationId Optional association filter
   * @returns Campaign performance metrics
   */
  private async getCampaignMetrics(
    startDate: Date,
    endDate: Date,
    associationId?: string
  ): Promise<any> {
    const campaigns = await this.campaignService.findAll({
      startDate,
      endDate,
      associationId
    });

    return {
      totalCampaigns: campaigns.total,
      activeCampaigns: campaigns.campaigns.filter(c => c.isActive()).length,
      completedCampaigns: campaigns.campaigns.filter(c => c.status === 'COMPLETED').length,
      averageProgress: campaigns.campaigns.reduce((acc, c) => acc + c.getProgress(), 0) / campaigns.total,
      campaignsByStatus: campaigns.campaigns.reduce((acc, c) => {
        acc[c.status] = (acc[c.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  /**
   * Calculates association performance metrics
   * @param startDate Start date for analysis period
   * @param endDate End date for analysis period
   * @param associationId Association ID to analyze
   * @returns Association performance metrics
   */
  private async getAssociationMetrics(
    startDate: Date,
    endDate: Date,
    associationId: string
  ): Promise<any> {
    const [donations, campaigns] = await Promise.all([
      this.donationService.findByAssociation(associationId, startDate, endDate),
      this.campaignService.findAll({ associationId, startDate, endDate })
    ]);

    return {
      totalRevenue: donations.reduce((acc, d) => acc.plus(d.amount), new Decimal(0)).toNumber(),
      donorCount: new Set(donations.map(d => d.userId)).size,
      campaignCount: campaigns.total,
      averageDonationSize: donations.length > 0
        ? donations.reduce((acc, d) => acc.plus(d.amount), new Decimal(0))
            .dividedBy(donations.length)
            .toNumber()
        : 0,
      successRate: campaigns.campaigns.filter(c => c.status === 'COMPLETED').length / campaigns.total * 100
    };
  }

  /**
   * Generates cache key for analytics queries
   * @private
   * @param query Analytics query parameters
   * @returns Unique cache key
   */
  private generateCacheKey(query: AnalyticsQueryDto): string {
    return `analytics:${query.metricType}:${query.startDate.toISOString()}:${query.endDate.toISOString()}:${query.associationId || 'all'}`;
  }

  /**
   * Calculates trend data for different time periods
   * @private
   * @param donations List of donations to analyze
   * @param startDate Start date for trend analysis
   * @param endDate End date for trend analysis
   * @returns Trend analysis data
   */
  private async calculateTrends(
    donations: any[],
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const daily = new Map<string, Decimal>();
    const weekly = new Map<string, Decimal>();
    const monthly = new Map<string, Decimal>();

    for (const donation of donations) {
      const date = new Date(donation.createdAt);
      const dayKey = date.toISOString().split('T')[0];
      const weekKey = `${date.getFullYear()}-W${this.getWeekNumber(date)}`;
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      const amount = new Decimal(donation.amount);

      daily.set(dayKey, (daily.get(dayKey) || new Decimal(0)).plus(amount));
      weekly.set(weekKey, (weekly.get(weekKey) || new Decimal(0)).plus(amount));
      monthly.set(monthKey, (monthly.get(monthKey) || new Decimal(0)).plus(amount));
    }

    return {
      daily: Array.from(daily.entries()).map(([date, amount]) => ({
        date,
        amount: amount.toNumber()
      })),
      weekly: Array.from(weekly.entries()).map(([week, amount]) => ({
        week,
        amount: amount.toNumber()
      })),
      monthly: Array.from(monthly.entries()).map(([month, amount]) => ({
        month,
        amount: amount.toNumber()
      }))
    };
  }

  /**
   * Gets ISO week number for a date
   * @private
   * @param date Date to get week number for
   * @returns ISO week number
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 4 - (d.getDay() || 7));
    const yearStart = new Date(d.getFullYear(), 0, 1);
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }
}