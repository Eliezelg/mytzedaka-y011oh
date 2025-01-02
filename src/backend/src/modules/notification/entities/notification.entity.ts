import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, Index } from 'typeorm'; // typeorm ^0.3.0
import { User } from '../../user/entities/user.entity';

/**
 * Enumeration of all supported notification types in the system.
 * Used for categorizing and filtering notifications.
 */
export enum NotificationType {
    DONATION_RECEIVED = 'DONATION_RECEIVED',
    CAMPAIGN_CREATED = 'CAMPAIGN_CREATED',
    CAMPAIGN_UPDATED = 'CAMPAIGN_UPDATED',
    CAMPAIGN_COMPLETED = 'CAMPAIGN_COMPLETED',
    DOCUMENT_VERIFIED = 'DOCUMENT_VERIFIED',
    PAYMENT_PROCESSED = 'PAYMENT_PROCESSED',
    SYSTEM_ALERT = 'SYSTEM_ALERT'
}

/**
 * Entity representing a notification in the system.
 * Supports multi-language content, real-time status tracking, and user relationships.
 * Implements comprehensive indexing for optimized query performance.
 */
@Entity('notifications')
@Index(['userId', 'isRead'])
@Index(['createdAt'])
export class NotificationEntity {
    /**
     * Unique identifier for the notification
     */
    @PrimaryGeneratedColumn('uuid')
    id: string;

    /**
     * Direct reference to recipient user's ID
     * Indexed for efficient querying
     */
    @Column()
    userId: string;

    /**
     * Type of notification for categorization and handling
     */
    @Column({ 
        type: 'enum', 
        enum: NotificationType 
    })
    type: NotificationType;

    /**
     * Notification title with length constraint
     */
    @Column({ length: 255 })
    title: string;

    /**
     * Detailed notification message content
     */
    @Column({ type: 'text' })
    message: string;

    /**
     * ISO 639-1 language code for content localization
     * Supports: en (English), fr (French), he (Hebrew)
     */
    @Column({ length: 2 })
    language: string;

    /**
     * Optional URL for additional context
     * Maximum length set to accommodate complex URLs
     */
    @Column({ 
        nullable: true, 
        length: 2048 
    })
    link: string;

    /**
     * Flag for tracking notification read status
     * Indexed for filtering read/unread notifications
     */
    @Column({ default: false })
    isRead: boolean;

    /**
     * Automatic timestamp for notification creation
     * Indexed for chronological querying
     */
    @CreateDateColumn()
    createdAt: Date;

    /**
     * Automatic timestamp for notification updates
     * Used for audit tracking
     */
    @UpdateDateColumn()
    updatedAt: Date;

    /**
     * Bidirectional relationship to recipient user
     * Enables efficient user notification queries
     */
    @ManyToOne(() => User, user => user.notifications)
    user: User;
}