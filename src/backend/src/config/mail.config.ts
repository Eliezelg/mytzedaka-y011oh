import { registerAs } from '@nestjs/config'; // ^10.0.0
import { validateOrReject } from 'class-validator'; // ^0.14.0
import { AppConfig } from '../interfaces/config.interface';

// Email template types supported by the system
interface EmailTemplate {
  id: string;
  version: string;
  subject: {
    en: string;
    he: string;
    fr: string;
  };
  dynamicTemplateData?: Record<string, unknown>;
}

// Failover configuration for backup email service
interface FailoverConfig {
  enabled: boolean;
  provider: string;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  maxRetries: number;
  retryDelayMs: number;
}

// Rate limiting configuration for email sending
interface EmailRateLimit {
  daily: number;
  hourly: number;
  burst: number;
  cooldownMs: number;
}

// Analytics tracking configuration
interface EmailAnalytics {
  enabled: boolean;
  clickTracking: boolean;
  openTracking: boolean;
  subscriptionTracking: boolean;
  ganalytics?: {
    enable: boolean;
    utmSource: string;
    utmMedium: string;
    utmCampaign: string;
  };
}

// Queue configuration for bulk emails
interface EmailQueueConfig {
  maxSize: number;
  processingInterval: number;
  retryAttempts: number;
  retryDelay: number;
  priority: {
    high: number;
    normal: number;
    low: number;
  };
}

/**
 * Factory function to generate mail configuration
 * Includes comprehensive settings for SendGrid integration with failover support
 */
export const mailConfigFactory = registerAs('mail', () => {
  // Validate required environment variables
  const requiredEnvVars = [
    'SENDGRID_API_KEY',
    'DEFAULT_SENDER_EMAIL',
    'FAILOVER_SMTP_CONFIG',
    'EMAIL_RATE_LIMIT'
  ];

  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`Missing required environment variable: ${envVar}`);
    }
  }

  // Email templates configuration with localization support
  const templates: Record<string, EmailTemplate> = {
    taxReceipt: {
      id: 'd-tax-receipt-template',
      version: '1.0',
      subject: {
        en: 'Your Tax Receipt for Donation',
        he: 'קבלה למס עבור תרומתך',
        fr: 'Votre reçu fiscal pour votre don'
      }
    },
    donationConfirmation: {
      id: 'd-donation-confirmation',
      version: '1.0',
      subject: {
        en: 'Thank You for Your Donation',
        he: 'תודה על תרומתך',
        fr: 'Merci pour votre don'
      }
    },
    campaignUpdate: {
      id: 'd-campaign-update',
      version: '1.0',
      subject: {
        en: 'Campaign Update',
        he: 'עדכון קמפיין',
        fr: 'Mise à jour de la campagne'
      }
    }
  };

  // Rate limiting configuration based on environment
  const rateLimit: EmailRateLimit = {
    daily: parseInt(process.env.EMAIL_RATE_LIMIT_DAILY || '50000'),
    hourly: parseInt(process.env.EMAIL_RATE_LIMIT_HOURLY || '5000'),
    burst: parseInt(process.env.EMAIL_RATE_LIMIT_BURST || '100'),
    cooldownMs: parseInt(process.env.EMAIL_RATE_LIMIT_COOLDOWN || '60000')
  };

  // Failover email service configuration
  const failover: FailoverConfig = {
    enabled: true,
    provider: 'smtp',
    host: process.env.FAILOVER_SMTP_HOST || 'smtp.mailtrap.io',
    port: parseInt(process.env.FAILOVER_SMTP_PORT || '2525'),
    secure: process.env.FAILOVER_SMTP_SECURE === 'true',
    auth: {
      user: process.env.FAILOVER_SMTP_USER || '',
      pass: process.env.FAILOVER_SMTP_PASS || ''
    },
    maxRetries: 3,
    retryDelayMs: 1000
  };

  // Analytics configuration for email tracking
  const analytics: EmailAnalytics = {
    enabled: true,
    clickTracking: true,
    openTracking: true,
    subscriptionTracking: false,
    ganalytics: {
      enable: true,
      utmSource: 'email',
      utmMedium: 'sendgrid',
      utmCampaign: 'donation_platform'
    }
  };

  // Queue configuration for handling bulk emails
  const queueConfig: EmailQueueConfig = {
    maxSize: 10000,
    processingInterval: 100,
    retryAttempts: 3,
    retryDelay: 1000,
    priority: {
      high: 1,
      normal: 2,
      low: 3
    }
  };

  return {
    provider: 'sendgrid',
    apiKey: process.env.SENDGRID_API_KEY,
    defaultSender: process.env.DEFAULT_SENDER_EMAIL,
    sandboxMode: process.env.NODE_ENV !== 'production',
    templates,
    rateLimit,
    failover,
    analytics,
    queueConfig,
    ipPoolName: process.env.SENDGRID_IP_POOL || 'transactional',
    maxAttachmentSize: 10 * 1024 * 1024, // 10MB
    supportedLanguages: ['en', 'he', 'fr'],
    defaultLanguage: 'en',
    bounceHandling: {
      enabled: true,
      webhook: '/webhooks/sendgrid/bounce',
      maxBounces: 5
    },
    securityOptions: {
      enableSpamCheck: true,
      enableClickTracking: true,
      enableOpenTracking: true,
      bypassListManagement: false,
      bypassSpamManagement: false,
      bypassBounceManagement: false,
      ipFiltering: true
    }
  };
});

// Export the mail configuration
export const mailConfig = mailConfigFactory();