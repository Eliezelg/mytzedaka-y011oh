import { IsString, IsEnum, IsUUID, IsOptional, Matches, IsIn } from 'class-validator'; // class-validator ^0.14.0
import { NotificationType } from '../entities/notification.entity';
import { LATIN_TEXT_REGEX, HEBREW_TEXT_REGEX } from '../../../constants/regex.constant';

/**
 * Data Transfer Object for creating notifications in the system.
 * Implements comprehensive validation rules for multi-language notifications
 * with support for real-time delivery and strict content validation.
 *
 * Features:
 * - UUID validation for user targeting
 * - Multi-language content validation (Hebrew, English, French)
 * - Strict notification type enforcement
 * - Optional link validation
 */
export class CreateNotificationDto {
    /**
     * UUID v4 of the target user receiving the notification
     * Must be a valid UUID to ensure proper user targeting
     */
    @IsUUID(4, { message: 'User ID must be a valid UUID v4' })
    @IsString()
    userId: string;

    /**
     * Type of notification being created
     * Must match one of the predefined system notification types
     * Used for proper notification handling and display
     */
    @IsEnum(NotificationType, { 
        message: 'Invalid notification type. Must be one of: DONATION_RECEIVED, CAMPAIGN_CREATED, CAMPAIGN_UPDATED, CAMPAIGN_COMPLETED, DOCUMENT_VERIFIED, PAYMENT_PROCESSED, SYSTEM_ALERT'
    })
    type: NotificationType;

    /**
     * Notification title with multi-language support
     * Validates content against language-specific character sets
     * Maximum length enforced by entity configuration (255 chars)
     */
    @IsString()
    @Matches(LATIN_TEXT_REGEX, { 
        message: 'Title must contain only valid Latin characters when using English or French'
    })
    @Matches(HEBREW_TEXT_REGEX, { 
        message: 'Title must contain only valid Hebrew characters when using Hebrew'
    })
    title: string;

    /**
     * Detailed notification message with multi-language support
     * Validates content against language-specific character sets
     * Stored as text type for extended length support
     */
    @IsString()
    @Matches(LATIN_TEXT_REGEX, { 
        message: 'Message must contain only valid Latin characters when using English or French'
    })
    @Matches(HEBREW_TEXT_REGEX, { 
        message: 'Message must contain only valid Hebrew characters when using Hebrew'
    })
    message: string;

    /**
     * ISO 639-1 language code for the notification content
     * Strictly limited to supported platform languages:
     * en (English), fr (French), he (Hebrew)
     */
    @IsString()
    @IsIn(['en', 'fr', 'he'], { 
        message: 'Language must be one of: en (English), fr (French), he (Hebrew)'
    })
    language: string;

    /**
     * Optional URL associated with the notification
     * Provides additional context or navigation target
     * Maximum length enforced by entity configuration (2048 chars)
     */
    @IsOptional()
    @IsString()
    link?: string;
}