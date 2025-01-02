import { Module } from '@nestjs/common'; // ^10.0.0
import { MongooseModule } from '@nestjs/mongoose'; // ^10.0.0
import { ConfigModule } from '@nestjs/config'; // ^10.0.0
import { EventEmitterModule } from '@nestjs/event-emitter'; // ^1.0.0

import { CampaignController } from './campaign.controller';
import { CampaignService } from './campaign.service';
import { Campaign, CampaignSchema } from './schemas/campaign.schema';

// Import required services for enhanced functionality
import { CurrencyService } from '../currency/currency.service';
import { LotteryService } from '../lottery/lottery.service';
import { NotificationService } from '../notification/notification.service';

/**
 * Campaign module providing comprehensive campaign management functionality
 * with support for multi-currency donations, real-time updates, and lottery features.
 * 
 * Features:
 * - Campaign CRUD operations with enhanced validation
 * - Multi-currency support with real-time conversion
 * - Lottery campaign management
 * - Real-time progress updates via WebSocket
 * - Role-based access control
 */
@Module({
  imports: [
    // MongoDB configuration with optimized indexes and validation
    MongooseModule.forFeature([
      {
        name: Campaign.name,
        schema: CampaignSchema,
        // Enable timestamps and indexes for performance
        options: {
          timestamps: true,
          autoIndex: true,
          autoCreate: true,
          validateBeforeSave: true
        }
      }
    ]),
    
    // Configuration module for environment-specific settings
    ConfigModule.forRoot({
      isGlobal: false,
      // Load campaign-specific configuration
      load: [() => ({
        campaign: {
          maxLotteryPrizes: 10,
          supportedCurrencies: ['ILS', 'USD', 'EUR', 'GBP'],
          minDonationAmount: 1,
          maxCampaignDuration: 365 // days
        }
      })]
    }),

    // Event emitter for real-time updates
    EventEmitterModule.forRoot({
      // Configure event emitter for WebSocket support
      wildcard: true,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false
    })
  ],
  
  // Register campaign controller
  controllers: [CampaignController],
  
  // Register required services
  providers: [
    CampaignService,
    CurrencyService, // For multi-currency support
    LotteryService, // For lottery campaign management
    NotificationService // For real-time updates
  ],
  
  // Export CampaignService for use in other modules
  exports: [CampaignService]
})
export class CampaignModule {
  /**
   * Module version for tracking API compatibility
   * @private
   */
  private readonly moduleVersion: string = '1.0.0';

  /**
   * Flag indicating whether lottery functionality is enabled
   * Can be configured via environment variables
   * @private
   */
  private readonly isLotteryEnabled: boolean = process.env.ENABLE_LOTTERY === 'true';
}