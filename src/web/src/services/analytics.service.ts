/**
 * @fileoverview Analytics service for handling data retrieval and processing
 * @version 1.0.0
 */

import dayjs from 'dayjs'; // ^1.11.0
import { injectable } from 'inversify';
import { apiClient } from '../api/apiClient';
import { CACHE_DURATION } from '../config/constants';

/**
 * Analytics metric types
 */
export enum MetricType {
  DONATIONS = 'donations',
  OVERHEAD = 'overhead',
  SATISFACTION = 'satisfaction'
}

/**
 * Analytics metrics interface
 */
export interface AnalyticsMetrics {
  startDate: string;
  endDate: string;
  metricType: MetricType;
  data: {
    values: number[];
    labels: string[];
    total: number;
    average: number;
    trend: number;
  };
  metadata: {
    lastUpdated: string;
    dataPoints: number;
  };
}

/**
 * Donation metrics interface
 */
export interface DonationMetrics {
  totalAmount: number;
  donorCount: number;
  averageDonation: number;
  recurringDonations: number;
  conversionRate: number;
  projections?: {
    nextMonth: number;
    nextQuarter: number;
  };
  trends: {
    daily: number;
    weekly: number;
    monthly: number;
  };
}

/**
 * Cache configuration interface
 */
interface CacheConfig {
  key: string;
  duration: number;
}

/**
 * Decorator for caching results
 */
function cacheable(duration: number) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const cachePrefix = `analytics_${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${cachePrefix}_${JSON.stringify(args)}`;
      const cachedData = localStorage.getItem(cacheKey);

      if (cachedData && !args[0]?.refresh) {
        const { data, timestamp } = JSON.parse(cachedData);
        if (Date.now() - timestamp < duration * 1000) {
          return data;
        }
      }

      const result = await originalMethod.apply(this, args);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({ data: result, timestamp: Date.now() })
      );
      return result;
    };

    return descriptor;
  };
}

/**
 * Rate limiting decorator
 */
function rateLimit(limit: number, window: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const rateLimitKey = `rateLimit_${propertyKey}`;
    
    descriptor.value = async function (...args: any[]) {
      const currentCalls = JSON.parse(
        localStorage.getItem(rateLimitKey) || '{"calls":[], "timestamp":0}'
      );
      
      const now = Date.now();
      const windowMs = window === '1m' ? 60000 : 3600000;
      
      currentCalls.calls = currentCalls.calls.filter(
        (timestamp: number) => now - timestamp < windowMs
      );

      if (currentCalls.calls.length >= limit) {
        throw new Error('Rate limit exceeded');
      }

      currentCalls.calls.push(now);
      localStorage.setItem(rateLimitKey, JSON.stringify(currentCalls));

      return originalMethod.apply(this, args);
    };

    return descriptor;
  };
}

/**
 * Analytics service class
 */
@injectable()
export class AnalyticsService {
  private readonly METRICS_ENDPOINT = '/analytics/metrics';
  private readonly DONATIONS_ENDPOINT = '/analytics/donations';

  constructor(private readonly circuitBreaker: CircuitBreaker) {}

  /**
   * Retrieves analytics metrics for specified parameters
   */
  @cacheable(CACHE_DURATION.USER_PROFILE)
  @rateLimit(100, '1m')
  public async getMetrics({
    startDate,
    endDate,
    metricType,
    refresh = false
  }: {
    startDate: Date;
    endDate: Date;
    metricType: MetricType;
    refresh?: boolean;
  }): Promise<AnalyticsMetrics> {
    try {
      const formattedStartDate = dayjs(startDate).format('YYYY-MM-DD');
      const formattedEndDate = dayjs(endDate).format('YYYY-MM-DD');

      const response = await this.circuitBreaker.execute(() =>
        apiClient.get(this.METRICS_ENDPOINT, {
          params: {
            startDate: formattedStartDate,
            endDate: formattedEndDate,
            type: metricType
          }
        })
      );

      const metrics = response.data;
      this.validateMetrics(metrics);

      return {
        ...metrics,
        metadata: {
          lastUpdated: dayjs().toISOString(),
          dataPoints: metrics.data.values.length
        }
      };
    } catch (error) {
      console.error('Failed to fetch metrics:', error);
      throw new Error('Failed to retrieve analytics metrics');
    }
  }

  /**
   * Retrieves donation-specific metrics with trend analysis
   */
  @cacheable(CACHE_DURATION.DONATION_HISTORY)
  @rateLimit(50, '1m')
  public async getDonationMetrics({
    startDate,
    endDate,
    associationId,
    includeProjections = false
  }: {
    startDate: Date;
    endDate: Date;
    associationId?: string;
    includeProjections?: boolean;
  }): Promise<DonationMetrics> {
    try {
      const response = await this.circuitBreaker.execute(() =>
        apiClient.get(this.DONATIONS_ENDPOINT, {
          params: {
            startDate: dayjs(startDate).format('YYYY-MM-DD'),
            endDate: dayjs(endDate).format('YYYY-MM-DD'),
            associationId,
            includeProjections
          }
        })
      );

      const metrics = response.data;
      
      return {
        ...metrics,
        trends: this.calculateTrends(metrics.data),
        ...(includeProjections && {
          projections: this.calculateProjections(metrics.data)
        })
      };
    } catch (error) {
      console.error('Failed to fetch donation metrics:', error);
      throw new Error('Failed to retrieve donation metrics');
    }
  }

  /**
   * Validates analytics metrics data
   */
  private validateMetrics(metrics: AnalyticsMetrics): boolean {
    if (!metrics || !metrics.data) {
      throw new Error('Invalid metrics data structure');
    }

    if (metrics.data.values.length !== metrics.data.labels.length) {
      throw new Error('Metrics data and labels mismatch');
    }

    if (metrics.data.values.some(isNaN)) {
      throw new Error('Invalid numerical values in metrics');
    }

    return true;
  }

  /**
   * Calculates trends from metrics data
   */
  private calculateTrends(data: number[]): {
    daily: number;
    weekly: number;
    monthly: number;
  } {
    return {
      daily: this.calculateTrendPercentage(data, 1),
      weekly: this.calculateTrendPercentage(data, 7),
      monthly: this.calculateTrendPercentage(data, 30)
    };
  }

  /**
   * Calculates trend percentage for a given period
   */
  private calculateTrendPercentage(data: number[], period: number): number {
    if (data.length < period * 2) {
      return 0;
    }

    const currentPeriod = data.slice(-period).reduce((a, b) => a + b, 0);
    const previousPeriod = data
      .slice(-period * 2, -period)
      .reduce((a, b) => a + b, 0);

    return previousPeriod === 0
      ? 0
      : ((currentPeriod - previousPeriod) / previousPeriod) * 100;
  }

  /**
   * Calculates future projections based on historical data
   */
  private calculateProjections(data: number[]): {
    nextMonth: number;
    nextQuarter: number;
  } {
    const monthlyAverage = data.slice(-30).reduce((a, b) => a + b, 0) / 30;
    const trend = this.calculateTrendPercentage(data, 30);

    return {
      nextMonth: monthlyAverage * (1 + trend / 100) * 30,
      nextQuarter: monthlyAverage * (1 + trend / 100) * 90
    };
  }
}

export default AnalyticsService;