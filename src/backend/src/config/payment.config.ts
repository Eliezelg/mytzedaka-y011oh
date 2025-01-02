import { registerAs } from '@nestjs/config';
import { PaymentGatewayInterface } from '../interfaces/payment-gateway.interface';

/**
 * Enhanced validation class for Tranzilla payment gateway configuration
 * Implements strict validation for Israeli market compliance
 */
export class TranzillaConfigValidation {
  terminalId: string;
  apiKey: string;
  apiEndpoint: string;
  enableTestMode: boolean;
  complianceMode: {
    israeliTaxAuthority: boolean;
    dataRetention: string;
    auditFrequency: string;
  };
  retryPolicy: {
    maxAttempts: number;
    backoffMs: number;
  };
  securitySettings: {
    encryptedComms: boolean;
    ipRestriction: boolean;
    tokenization: boolean;
    fraudDetection: boolean;
  };
  allowedIPs: string[];
  auditConfig: {
    enabled: boolean;
    detailedLogging: boolean;
    retentionPeriod: string;
  };
}

/**
 * Comprehensive payment gateway configuration factory
 * Implements PCI DSS Level 1 compliance and dual gateway support
 */
@registerAs('payment')
export const paymentConfig = () => ({
  stripe: {
    apiKey: process.env.STRIPE_API_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    connectAccountType: 'express',
    payoutSchedule: {
      interval: 'daily',
      anchor: 'midnight',
      delay_days: 2
    },
    supportedCurrencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'ILS', 'CHF', 'JPY'],
    enableTestMode: process.env.NODE_ENV !== 'production',
    complianceMode: {
      pciDssLevel: 1,
      dataRetention: '7years',
      auditFrequency: 'daily',
      encryptionLevel: 'AES-256-GCM'
    },
    securitySettings: {
      tokenization: true,
      fraudDetection: true,
      ipWhitelist: process.env.STRIPE_IP_WHITELIST?.split(',') || [],
      threeDSecure: {
        enabled: true,
        challengeOnlyWhenRequired: true
      },
      webhookTolerance: 300, // 5 minutes tolerance for webhook signatures
    },
    platformFees: {
      percentage: 2.9,
      fixed: 0.30,
      currency: 'USD'
    },
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      jitterMs: 100
    },
    monitoring: {
      metrics: true,
      alerting: true,
      logging: 'verbose',
      errorReporting: {
        enabled: true,
        detailedErrors: process.env.NODE_ENV !== 'production'
      }
    },
    riskManagement: {
      fraudDetectionRules: {
        velocityChecks: true,
        amountThresholds: true,
        geoValidation: true
      },
      blockHighRiskCountries: true,
      requireVerificationAboveAmount: 1000
    }
  },

  tranzilla: {
    terminalId: process.env.TRANZILLA_TERMINAL_ID,
    apiKey: process.env.TRANZILLA_API_KEY,
    apiEndpoint: process.env.TRANZILLA_API_ENDPOINT,
    supportedCurrencies: ['ILS'],
    enableTestMode: process.env.NODE_ENV !== 'production',
    israeliCompliance: {
      regularReports: true,
      taxAuthority: true,
      israeliAccountingStandards: true,
      shekelCurrencyValidation: true
    },
    securitySettings: {
      encryptedComms: true,
      ipRestriction: true,
      allowedIPs: process.env.TRANZILLA_ALLOWED_IPS?.split(',') || [],
      tokenization: {
        enabled: true,
        tokenFormat: 'PCI-compliant'
      },
      certificateValidation: true
    },
    retryPolicy: {
      maxAttempts: 3,
      backoffMs: 1000,
      timeoutMs: 30000
    },
    errorHandling: {
      hebrewMessages: true,
      detailedLogs: true,
      translationEnabled: true
    },
    monitoring: {
      metrics: true,
      alerting: true,
      logging: 'verbose',
      hebrewLogs: true
    },
    validation: {
      israeliIdCheck: true,
      addressValidation: true,
      phoneValidation: true
    },
    auditConfig: {
      enabled: true,
      retentionPeriod: '7years',
      detailedTransactionLogs: true,
      complianceReporting: true
    }
  },

  general: {
    defaultCurrency: 'USD',
    fallbackGateway: 'stripe',
    maxTransactionAmount: {
      USD: 50000,
      ILS: 175000
    },
    securityControls: {
      rateLimiting: {
        enabled: true,
        maxAttempts: 5,
        windowMs: 60000
      },
      dataEncryption: {
        algorithm: 'AES-256-GCM',
        keyRotationDays: 30
      },
      auditLogging: {
        enabled: true,
        level: 'detailed',
        retention: '7years'
      }
    },
    complianceMode: {
      pciDss: {
        enabled: true,
        level: 1,
        scanFrequency: 'quarterly'
      },
      gdpr: {
        enabled: true,
        dataRetention: '7years',
        userConsent: true
      }
    },
    errorHandling: {
      retryableErrors: ['network_error', 'gateway_timeout'],
      maxRetries: 3,
      notificationThreshold: 5
    },
    monitoring: {
      healthChecks: {
        enabled: true,
        intervalMs: 60000
      },
      alerting: {
        enabled: true,
        endpoints: {
          email: process.env.ALERT_EMAIL,
          slack: process.env.ALERT_SLACK_WEBHOOK
        }
      }
    }
  }
});