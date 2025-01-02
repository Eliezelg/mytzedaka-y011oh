import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { CacheModule } from '@nestjs/cache-manager'; // ^2.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // ^5.0.0
import { WebSocketGateway } from '@nestjs/websockets'; // ^10.0.0

import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationEntity } from './entities/notification.entity';
import { MailProvider } from '../../providers/mail.provider';

/**
 * NotificationModule provides comprehensive notification functionality including:
 * - Real-time notifications via WebSocket
 * - Email notifications through SendGrid
 * - Multi-language support (Hebrew, English, French)
 * - Rate limiting and caching
 * - Secure delivery mechanisms
 */
@Module({
  imports: [
    // Configure TypeORM for notification persistence
    TypeOrmModule.forFeature([NotificationEntity]),

    // Configure caching for notification optimization
    CacheModule.register({
      ttl: 300, // 5 minutes cache TTL
      max: 1000, // Maximum cache items
      isGlobal: true
    }),

    // Configure rate limiting for notification endpoints
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10 // Maximum requests per window
    })
  ],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    MailProvider,
    // Configure WebSocket gateway for real-time notifications
    {
      provide: WebSocketGateway,
      useFactory: () => {
        return new WebSocketGateway({
          cors: true,
          namespace: 'notifications',
          transports: ['websocket', 'polling'],
          pingInterval: 10000,
          pingTimeout: 5000
        });
      }
    }
  ],
  exports: [NotificationService] // Export service for use in other modules
})
export class NotificationModule {
  /**
   * Initializes the notification module with required dependencies
   * and configures WebSocket, caching, and rate limiting
   */
  constructor() {
    // Module initialization is handled by NestJS dependency injection
  }
}