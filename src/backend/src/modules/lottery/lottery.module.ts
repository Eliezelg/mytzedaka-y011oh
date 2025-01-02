import { Module } from '@nestjs/common'; // ^9.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^9.0.0

import { LotteryController } from './lottery.controller';
import { LotteryService } from './lottery.service';
import { Lottery } from './entities/lottery.entity';
import { Campaign } from '../campaign/entities/campaign.entity';

/**
 * NestJS module configuration for lottery functionality
 * Implements secure and scalable campaign-based fundraising lottery system
 * with multi-currency support, audit logging, and monitoring capabilities
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Lottery,
      Campaign
    ])
  ],
  controllers: [LotteryController],
  providers: [
    LotteryService,
    {
      provide: 'LOTTERY_CONFIG',
      useValue: {
        // Security settings
        securityMode: 'strict',
        encryptionEnabled: true,
        auditLogging: true,
        
        // Rate limiting
        rateLimit: {
          ttl: 300, // 5 minutes
          limit: 100 // Max 100 requests per 5 minutes
        },
        
        // Monitoring
        monitoring: {
          enabled: true,
          metricsEnabled: true,
          alertingEnabled: true
        },
        
        // Currency settings
        supportedCurrencies: ['USD', 'EUR', 'ILS', 'GBP'],
        
        // Lottery constraints
        constraints: {
          minTicketPrice: 1,
          maxTicketPrice: 1000000,
          minPrizes: 1,
          maxPrizes: 100,
          maxTicketsPerLottery: 100000,
          minDrawingThreshold: 0.25 // 25% of tickets must be sold
        },
        
        // Cache settings
        cache: {
          ttl: 300, // 5 minutes
          maxItems: 1000
        }
      }
    }
  ],
  exports: [LotteryService]
})
export class LotteryModule {
  static readonly MODULE_NAME = 'lottery';
  
  // Configuration options for module initialization
  private static readonly CONFIG_OPTIONS = {
    // Global module settings
    global: true,
    
    // Database configuration
    database: {
      synchronize: false,
      retryAttempts: 3,
      retryDelay: 1000
    },
    
    // Security configuration
    security: {
      auditLevel: 'detailed',
      securityMode: 'strict',
      monitoringEnabled: true
    }
  };
}