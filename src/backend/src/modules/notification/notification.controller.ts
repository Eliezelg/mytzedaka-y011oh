import { 
  Controller, 
  Post, 
  Get, 
  Put, 
  Delete, 
  Body, 
  Param, 
  UseGuards, 
  UseInterceptors,
  Logger,
  Query
} from '@nestjs/common'; // ^10.0.0
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger'; // ^7.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import { LoggingInterceptor } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { Auth } from '../../decorators/auth.decorator';
import { NotificationType } from './entities/notification.entity';

interface PaginationDto {
  page?: number;
  limit?: number;
}

@Controller('notifications')
@UseGuards(LoggingInterceptor)
@ApiTags('notifications')
export class NotificationController {
  private readonly logger = new Logger(NotificationController.name);

  constructor(
    private readonly notificationService: NotificationService
  ) {}

  /**
   * Creates a new notification with real-time delivery
   * Supports multi-language content and enhanced security features
   */
  @Post()
  @Auth(true)
  @RateLimit({ points: 100, duration: 60 })
  @ApiOperation({ summary: 'Create notification' })
  @ApiResponse({ 
    status: 201, 
    description: 'Notification created successfully',
    type: 'NotificationEntity'
  })
  async create(@Body() createNotificationDto: CreateNotificationDto) {
    this.logger.debug(`Creating notification for user ${createNotificationDto.userId}`);
    
    try {
      const notification = await this.notificationService.create(createNotificationDto);
      
      // Emit real-time notification
      await this.notificationService.emitNotification(notification);
      
      return notification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Retrieves paginated notifications for a user with language filtering
   */
  @Get('user/:userId')
  @Auth(true)
  @ApiOperation({ summary: 'Get user notifications' })
  @ApiResponse({
    status: 200,
    description: 'Retrieved user notifications successfully',
    type: 'PaginatedNotifications'
  })
  async findAllForUser(
    @Param('userId') userId: string,
    @Query() paginationDto: PaginationDto,
    @Query('language') language?: string,
    @Query('type') type?: NotificationType,
    @Query('isRead') isRead?: boolean
  ) {
    this.logger.debug(`Fetching notifications for user ${userId}`);

    try {
      const filters = {
        language,
        type,
        isRead: isRead !== undefined ? Boolean(isRead) : undefined
      };

      return await this.notificationService.findAllForUser(
        userId,
        {
          page: paginationDto.page || 1,
          limit: paginationDto.limit || 10
        },
        filters
      );
    } catch (error) {
      this.logger.error(`Failed to fetch notifications: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Marks a notification as read with real-time status update
   */
  @Put(':id/read')
  @Auth(true)
  @ApiOperation({ summary: 'Mark notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read successfully',
    type: 'NotificationEntity'
  })
  async markAsRead(
    @Param('id') id: string,
    @Query('userId') userId: string
  ) {
    this.logger.debug(`Marking notification ${id} as read for user ${userId}`);

    try {
      return await this.notificationService.markAsRead(id, userId);
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Deletes a notification with audit logging
   */
  @Delete(':id')
  @Auth(true)
  @ApiOperation({ summary: 'Delete notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully'
  })
  async delete(
    @Param('id') id: string,
    @Query('userId') userId: string
  ) {
    this.logger.debug(`Deleting notification ${id} for user ${userId}`);

    try {
      await this.notificationService.deleteNotification(id, userId);
      return { message: 'Notification deleted successfully' };
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`, error.stack);
      throw error;
    }
  }
}