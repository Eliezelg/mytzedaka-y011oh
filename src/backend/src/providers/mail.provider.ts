import { Injectable } from '@nestjs/common'; // ^10.0.0
import { ConfigService } from '@nestjs/config'; // ^10.0.0
import * as SendGrid from '@sendgrid/mail'; // ^7.7.0
import { mailConfig } from '../config/mail.config';

// Types for email security and monitoring
interface EmailSecurityScan {
  hasMaliciousContent: boolean;
  spamScore: number;
  threatLevel: 'low' | 'medium' | 'high';
}

interface EmailDeliveryMetrics {
  timestamp: Date;
  recipient: string;
  templateId: string;
  deliveryStatus: string;
  openTracking?: boolean;
  clickTracking?: boolean;
}

interface RateLimiter {
  remaining: number;
  resetTime: Date;
  checkLimit(email: string): boolean;
}

@Injectable()
export class MailProvider {
  private readonly mailService: typeof SendGrid;
  private readonly templateCache: Map<string, any>;
  private readonly rateLimiter: RateLimiter;
  private readonly deliveryMetrics: EmailDeliveryMetrics[];

  constructor(private readonly configService: ConfigService) {
    // Initialize SendGrid client
    this.mailService = SendGrid;
    this.mailService.setApiKey(mailConfig.apiKey);
    
    // Initialize supporting systems
    this.templateCache = new Map();
    this.deliveryMetrics = [];
    this.rateLimiter = this.initializeRateLimiter();
    
    // Configure security settings
    this.configureSecurity();
  }

  private initializeRateLimiter(): RateLimiter {
    return {
      remaining: mailConfig.rateLimit.daily,
      resetTime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      checkLimit: (email: string): boolean => {
        if (this.remaining <= 0) return false;
        this.remaining--;
        return true;
      }
    };
  }

  private configureSecurity(): void {
    if (mailConfig.securityOptions.enableSpamCheck) {
      this.mailService.setSettings({
        sandboxMode: mailConfig.sandboxMode,
        ipFiltering: mailConfig.securityOptions.ipFiltering
      });
    }
  }

  private async scanEmailSecurity(content: string): Promise<EmailSecurityScan> {
    // Implement email content security scanning
    return {
      hasMaliciousContent: false,
      spamScore: 0,
      threatLevel: 'low'
    };
  }

  private trackDeliveryMetrics(metrics: EmailDeliveryMetrics): void {
    this.deliveryMetrics.push({
      ...metrics,
      timestamp: new Date()
    });
  }

  async sendDonationConfirmation({
    email,
    donorName,
    amount,
    currency,
    associationName,
    metadata = {}
  }: {
    email: string;
    donorName: string;
    amount: number;
    currency: string;
    associationName: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (!this.rateLimiter.checkLimit(email)) {
      throw new Error('Rate limit exceeded for email sending');
    }

    const template = mailConfig.templates.donationConfirmation;
    const securityScan = await this.scanEmailSecurity(donorName + associationName);

    if (securityScan.hasMaliciousContent) {
      throw new Error('Security check failed for email content');
    }

    const msg = {
      to: email,
      from: mailConfig.defaultSender,
      templateId: template.id,
      dynamicTemplateData: {
        donor_name: donorName,
        amount: amount,
        currency: currency,
        association_name: associationName,
        ...metadata
      },
      trackingSettings: {
        clickTracking: { enable: mailConfig.analytics.clickTracking },
        openTracking: { enable: mailConfig.analytics.openTracking }
      }
    };

    try {
      await this.mailService.send(msg);
      this.trackDeliveryMetrics({
        recipient: email,
        templateId: template.id,
        deliveryStatus: 'sent',
        openTracking: mailConfig.analytics.openTracking,
        clickTracking: mailConfig.analytics.clickTracking
      });
    } catch (error) {
      throw new Error(`Failed to send donation confirmation: ${error.message}`);
    }
  }

  async sendTaxReceipt({
    email,
    donorName,
    receiptNumber,
    attachmentBuffer,
    metadata = {}
  }: {
    email: string;
    donorName: string;
    receiptNumber: string;
    attachmentBuffer: Buffer;
    metadata?: Record<string, any>;
  }): Promise<void> {
    if (attachmentBuffer.length > mailConfig.maxAttachmentSize) {
      throw new Error('Tax receipt PDF exceeds maximum allowed size');
    }

    const template = mailConfig.templates.taxReceipt;
    const msg = {
      to: email,
      from: mailConfig.defaultSender,
      templateId: template.id,
      dynamicTemplateData: {
        donor_name: donorName,
        receipt_number: receiptNumber,
        ...metadata
      },
      attachments: [{
        content: attachmentBuffer.toString('base64'),
        filename: `tax_receipt_${receiptNumber}.pdf`,
        type: 'application/pdf',
        disposition: 'attachment'
      }],
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      }
    };

    try {
      await this.mailService.send(msg);
      this.trackDeliveryMetrics({
        recipient: email,
        templateId: template.id,
        deliveryStatus: 'sent'
      });
    } catch (error) {
      throw new Error(`Failed to send tax receipt: ${error.message}`);
    }
  }

  async sendCampaignNotification({
    email,
    campaignName,
    type,
    data = {}
  }: {
    email: string;
    campaignName: string;
    type: 'update' | 'completion' | 'milestone';
    data?: Record<string, any>;
  }): Promise<void> {
    const template = mailConfig.templates.campaignUpdate;
    const securityScan = await this.scanEmailSecurity(campaignName);

    if (securityScan.threatLevel === 'high') {
      throw new Error('Campaign notification failed security check');
    }

    const msg = {
      to: email,
      from: mailConfig.defaultSender,
      templateId: template.id,
      dynamicTemplateData: {
        campaign_name: campaignName,
        notification_type: type,
        ...data
      },
      trackingSettings: {
        clickTracking: { enable: mailConfig.analytics.clickTracking },
        openTracking: { enable: mailConfig.analytics.openTracking },
        subscriptionTracking: { enable: mailConfig.analytics.subscriptionTracking }
      }
    };

    try {
      await this.mailService.send(msg);
      this.trackDeliveryMetrics({
        recipient: email,
        templateId: template.id,
        deliveryStatus: 'sent'
      });
    } catch (error) {
      throw new Error(`Failed to send campaign notification: ${error.message}`);
    }
  }

  async sendVerificationEmail({
    email,
    verificationToken,
    language = 'en',
    ipAddress
  }: {
    email: string;
    verificationToken: string;
    language?: string;
    ipAddress?: string;
  }): Promise<void> {
    if (!mailConfig.supportedLanguages.includes(language)) {
      language = mailConfig.defaultLanguage;
    }

    const securityScan = await this.scanEmailSecurity(email + ipAddress);
    if (securityScan.threatLevel !== 'low') {
      throw new Error('Verification email blocked due to security concerns');
    }

    const msg = {
      to: email,
      from: mailConfig.defaultSender,
      templateId: mailConfig.templates.verificationEmail?.id,
      dynamicTemplateData: {
        verification_link: `${this.configService.get('APP_URL')}/verify?token=${verificationToken}`,
        language: language
      },
      trackingSettings: {
        clickTracking: { enable: true },
        openTracking: { enable: true }
      },
      ipPoolName: mailConfig.ipPoolName
    };

    try {
      await this.mailService.send(msg);
      this.trackDeliveryMetrics({
        recipient: email,
        templateId: mailConfig.templates.verificationEmail?.id,
        deliveryStatus: 'sent'
      });
    } catch (error) {
      throw new Error(`Failed to send verification email: ${error.message}`);
    }
  }
}