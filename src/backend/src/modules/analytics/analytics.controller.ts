import { 
  Controller, 
  Get, 
  Post, 
  Query, 
  UseInterceptors,
  UseGuards
} from '@nestjs/common'; // ^10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity 
} from '@nestjs/swagger'; // ^7.0.0
import { CacheInterceptor } from '@nestjs/cache-manager'; // ^2.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0

import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto } from './dto/analytics-query.dto';
import { Auth } from '../../decorators/auth.decorator';

/**
 * Controller handling analytics and reporting endpoints with caching and rate limiting
 * Implements real-time metrics tracking and secure access controls
 */
@Controller('analytics')
@ApiTags('Analytics')
@ApiSecurity('bearer')
@UseGuards(Auth)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Retrieves real-time analytics metrics with caching
   * @param query Analytics query parameters including date range and metric type
   * @returns Cached analytics metrics with error handling
   */
  @Get('metrics')
  @Auth(true)
  @RateLimit({ 
    points: 100, 
    duration: 60,
    errorMessage: 'Too many metrics requests. Please try again later.'
  })
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get analytics metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics metrics retrieved successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Insufficient permissions' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too Many Requests - Rate limit exceeded' 
  })
  async getMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getMetrics(query);
  }

  /**
   * Generates comprehensive analytics report with access control
   * @param query Analytics query parameters for report generation
   * @returns Detailed analytics report with error handling
   */
  @Post('report')
  @Auth(true)
  @RateLimit({ 
    points: 50, 
    duration: 60,
    errorMessage: 'Too many report generation requests. Please try again later.'
  })
  @ApiOperation({ summary: 'Generate analytics report' })
  @ApiResponse({ 
    status: 200, 
    description: 'Analytics report generated successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Insufficient permissions' 
  })
  @ApiResponse({ 
    status: 429, 
    description: 'Too Many Requests - Rate limit exceeded' 
  })
  async generateReport(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.generateReport(query);
  }

  /**
   * Retrieves real-time donation metrics with caching
   * @param query Analytics query parameters for donation metrics
   * @returns Cached donation metrics with error handling
   */
  @Get('donations')
  @Auth(true)
  @RateLimit({ 
    points: 100, 
    duration: 60,
    errorMessage: 'Too many donation metrics requests. Please try again later.'
  })
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get donation metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Donation metrics retrieved successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Insufficient permissions' 
  })
  async getDonationMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getDonationMetrics(
      query.startDate,
      query.endDate,
      query.associationId
    );
  }

  /**
   * Retrieves campaign performance metrics with caching
   * @param query Analytics query parameters for campaign metrics
   * @returns Cached campaign metrics with error handling
   */
  @Get('campaigns')
  @Auth(true)
  @RateLimit({ 
    points: 100, 
    duration: 60,
    errorMessage: 'Too many campaign metrics requests. Please try again later.'
  })
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get campaign metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Campaign metrics retrieved successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Insufficient permissions' 
  })
  async getCampaignMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getCampaignMetrics(
      query.startDate,
      query.endDate,
      query.associationId
    );
  }

  /**
   * Retrieves association performance metrics with caching
   * @param query Analytics query parameters for association metrics
   * @returns Cached association metrics with error handling
   */
  @Get('associations')
  @Auth(true)
  @RateLimit({ 
    points: 100, 
    duration: 60,
    errorMessage: 'Too many association metrics requests. Please try again later.'
  })
  @UseInterceptors(CacheInterceptor)
  @ApiOperation({ summary: 'Get association metrics' })
  @ApiResponse({ 
    status: 200, 
    description: 'Association metrics retrieved successfully',
    type: Object
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Forbidden - Insufficient permissions' 
  })
  async getAssociationMetrics(@Query() query: AnalyticsQueryDto) {
    return this.analyticsService.getAssociationMetrics(
      query.startDate,
      query.endDate,
      query.associationId
    );
  }
}