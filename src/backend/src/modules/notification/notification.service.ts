import { Injectable, Logger, Catch, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { NotificationEntity, NotificationType } from './entities/notification.entity';
import { CreateNotificationDto } from './dto/create-notification.dto';
import { MailProvider } from '../../providers/mail.provider';

interface PaginationDto {
  page: number;
  limit: number;
}

interface NotificationFilterDto {
  isRead?: boolean;
  type?: NotificationType;
  startDate?: Date;
  endDate?: Date;
}

interface PaginatedNotifications {
  items: NotificationEntity[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
@WebSocketGateway({
  cors: true,
  namespace: 'notifications'
})
@Catch(HttpException)
export class NotificationService {
  @WebSocketServer()
  private server: Server;

  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly notificationRepository: Repository<NotificationEntity>,
    private readonly mailProvider: MailProvider
  ) {}

  /**
   * Creates a new notification and handles its delivery
   * Supports multi-language content and real-time updates
   */
  async create(createNotificationDto: CreateNotificationDto): Promise<NotificationEntity> {
    try {
      // Create notification entity
      const notification = this.notificationRepository.create({
        ...createNotificationDto,
        isRead: false
      });

      // Save notification to database
      const savedNotification = await this.notificationRepository.save(notification);

      // Emit real-time notification via WebSocket
      this.server.to(notification.userId).emit('newNotification', {
        id: savedNotification.id,
        type: savedNotification.type,
        title: savedNotification.title,
        message: savedNotification.message
      });

      // Send email notification based on type
      await this.handleEmailNotification(savedNotification);

      this.logger.log(`Created notification ${savedNotification.id} for user ${savedNotification.userId}`);
      return savedNotification;
    } catch (error) {
      this.logger.error(`Failed to create notification: ${error.message}`, error.stack);
      throw new HttpException(`Failed to create notification: ${error.message}`, 500);
    }
  }

  /**
   * Retrieves paginated notifications for a user with filtering options
   */
  async findAllForUser(
    userId: string,
    paginationDto: PaginationDto,
    filterDto?: NotificationFilterDto
  ): Promise<PaginatedNotifications> {
    try {
      const { page = 1, limit = 10 } = paginationDto;
      const skip = (page - 1) * limit;

      // Build query with filters
      const whereClause: FindOptionsWhere<NotificationEntity> = { userId };
      if (filterDto?.isRead !== undefined) {
        whereClause.isRead = filterDto.isRead;
      }
      if (filterDto?.type) {
        whereClause.type = filterDto.type;
      }
      if (filterDto?.startDate) {
        whereClause.createdAt = {
          $gte: filterDto.startDate
        } as any;
      }
      if (filterDto?.endDate) {
        whereClause.createdAt = {
          ...whereClause.createdAt as any,
          $lte: filterDto.endDate
        } as any;
      }

      // Execute query with pagination
      const [items, total] = await this.notificationRepository.findAndCount({
        where: whereClause,
        order: { createdAt: 'DESC' },
        skip,
        take: limit
      });

      return {
        items,
        total,
        page,
        limit
      };
    } catch (error) {
      this.logger.error(`Failed to fetch notifications: ${error.message}`, error.stack);
      throw new HttpException(`Failed to fetch notifications: ${error.message}`, 500);
    }
  }

  /**
   * Marks a notification as read
   */
  async markAsRead(id: string, userId: string): Promise<NotificationEntity> {
    try {
      const notification = await this.notificationRepository.findOne({
        where: { id, userId }
      });

      if (!notification) {
        throw new HttpException('Notification not found', 404);
      }

      notification.isRead = true;
      const updatedNotification = await this.notificationRepository.save(notification);

      // Emit read status update
      this.server.to(userId).emit('notificationRead', { id });

      return updatedNotification;
    } catch (error) {
      this.logger.error(`Failed to mark notification as read: ${error.message}`, error.stack);
      throw new HttpException(`Failed to mark notification as read: ${error.message}`, 500);
    }
  }

  /**
   * Deletes a notification
   */
  async deleteNotification(id: string, userId: string): Promise<void> {
    try {
      const result = await this.notificationRepository.delete({ id, userId });

      if (result.affected === 0) {
        throw new HttpException('Notification not found', 404);
      }

      // Emit deletion event
      this.server.to(userId).emit('notificationDeleted', { id });
    } catch (error) {
      this.logger.error(`Failed to delete notification: ${error.message}`, error.stack);
      throw new HttpException(`Failed to delete notification: ${error.message}`, 500);
    }
  }

  /**
   * Handles email notification delivery based on notification type
   */
  private async handleEmailNotification(notification: NotificationEntity): Promise<void> {
    try {
      switch (notification.type) {
        case NotificationType.DONATION_RECEIVED:
          await this.mailProvider.sendDonationConfirmation({
            email: notification.user.email,
            donorName: `${notification.user.firstName} ${notification.user.lastName}`,
            amount: notification.metadata?.amount,
            currency: notification.metadata?.currency,
            associationName: notification.metadata?.associationName
          });
          break;

        case NotificationType.CAMPAIGN_CREATED:
        case NotificationType.CAMPAIGN_UPDATED:
        case NotificationType.CAMPAIGN_COMPLETED:
          await this.mailProvider.sendCampaignNotification({
            email: notification.user.email,
            campaignName: notification.metadata?.campaignName,
            type: this.mapNotificationTypeToEmailType(notification.type),
            data: notification.metadata
          });
          break;

        default:
          this.logger.debug(`No email notification configured for type: ${notification.type}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send email notification: ${error.message}`, error.stack);
      // Don't throw error to prevent notification creation failure
    }
  }

  /**
   * Maps notification types to email notification types
   */
  private mapNotificationTypeToEmailType(
    notificationType: NotificationType
  ): 'update' | 'completion' | 'milestone' {
    switch (notificationType) {
      case NotificationType.CAMPAIGN_UPDATED:
        return 'update';
      case NotificationType.CAMPAIGN_COMPLETED:
        return 'completion';
      default:
        return 'milestone';
    }
  }
}