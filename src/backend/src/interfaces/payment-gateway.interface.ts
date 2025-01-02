// decimal.js v10.4.3 - For precise payment amount calculations
import Decimal from 'decimal.js';

/**
 * Supported payment method types including international and Israeli-specific methods
 */
export enum PaymentMethodType {
    CREDIT_CARD = 'CREDIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
    DIRECT_DEBIT = 'DIRECT_DEBIT',
    ISRAELI_CREDIT_CARD = 'ISRAELI_CREDIT_CARD',
    ISRAELI_DIRECT_DEBIT = 'ISRAELI_DIRECT_DEBIT'
}

/**
 * Extended payment status types with comprehensive transaction states
 */
export enum PaymentStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED',
    PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
    CANCELLED = 'CANCELLED'
}

/**
 * Security configuration for payment gateway initialization
 */
export interface SecurityConfig {
    encryptionKey: string;
    certificatePath?: string;
    pciComplianceLevel: string;
    ipWhitelist?: string[];
    fraudDetectionRules: Record<string, unknown>;
    auditLogEnabled: boolean;
}

/**
 * Payment gateway configuration including provider-specific settings
 */
export interface PaymentGatewayConfig {
    provider: 'STRIPE' | 'TRANZILLA';
    apiKey: string;
    apiSecret: string;
    environment: 'sandbox' | 'production';
    regionalSettings: {
        country: string;
        currency: string;
        locale: string;
    };
    timeout: number;
    retryPolicy: {
        maxAttempts: number;
        backoffMs: number;
    };
}

/**
 * Security context for payment processing
 */
export interface SecurityContext {
    sessionId: string;
    ipAddress: string;
    userAgent: string;
    riskScore?: number;
    fraudChecksPassed: boolean;
    timestamp: Date;
}

/**
 * Payment method details with enhanced security
 */
export interface PaymentMethodDetails {
    type: PaymentMethodType;
    tokenizedData: string;
    billingAddress: {
        country: string;
        postalCode: string;
        city: string;
        addressLine: string;
    };
    securityCode?: string;
    expiryDate?: string;
}

/**
 * Refund reason tracking for audit purposes
 */
export interface RefundReason {
    code: string;
    description: string;
    authorizedBy: string;
    supportingDocuments?: string[];
}

/**
 * Enhanced payment request with regional requirements and risk assessment
 */
export interface PaymentRequest {
    amount: Decimal;
    currency: string;
    paymentMethodType: PaymentMethodType;
    associationId: string;
    donorId: string;
    metadata: Record<string, unknown>;
    regionalRequirements?: {
        israeliId?: string;
        taxInvoiceRequired: boolean;
    };
    riskAssessment?: {
        score: number;
        factors: string[];
        verification: string[];
    };
}

/**
 * Detailed timestamps for payment lifecycle tracking
 */
export interface PaymentTimestamps {
    created: Date;
    processed?: Date;
    completed?: Date;
    refunded?: Date;
    lastUpdated: Date;
}

/**
 * Security check results for payment transactions
 */
export interface SecurityChecks {
    fraudDetectionPassed: boolean;
    pciValidationPassed: boolean;
    riskAssessmentScore: number;
    ipVerificationPassed: boolean;
    threeDSecureStatus?: string;
}

/**
 * Enhanced payment response with detailed error handling and security information
 */
export interface PaymentResponse {
    transactionId: string;
    status: PaymentStatus;
    amount: Decimal;
    currency: string;
    errorMessage?: string;
    errorCode?: string;
    gatewayResponse: Record<string, unknown>;
    timestamps: PaymentTimestamps;
    securityChecks: SecurityChecks;
}

/**
 * Detailed payment status with security information
 */
export interface DetailedPaymentStatus extends PaymentResponse {
    processingDetails: {
        attempts: number;
        lastAttemptTimestamp: Date;
        nextRetryTimestamp?: Date;
    };
    auditTrail: {
        events: Array<{
            timestamp: Date;
            action: string;
            actor: string;
            details: Record<string, unknown>;
        }>;
    };
}

/**
 * Core payment gateway interface with enhanced security and validation
 * Implements PCI DSS Level 1 compliance requirements
 */
export interface PaymentGatewayInterface {
    /**
     * Initialize the payment gateway with configuration and security settings
     * @param config Gateway configuration including API credentials and regional settings
     * @param securityOptions Security configuration for PCI compliance
     */
    initialize(config: PaymentGatewayConfig, securityOptions: SecurityConfig): Promise<void>;

    /**
     * Create a new payment transaction with enhanced validation
     * @param request Payment request details with risk assessment
     */
    createPayment(request: PaymentRequest): Promise<PaymentResponse>;

    /**
     * Process a payment transaction with fraud detection
     * @param transactionId Unique transaction identifier
     * @param paymentMethodDetails Secure payment method information
     * @param securityContext Security context for fraud prevention
     */
    processPayment(
        transactionId: string,
        paymentMethodDetails: PaymentMethodDetails,
        securityContext: SecurityContext
    ): Promise<PaymentResponse>;

    /**
     * Refund a processed payment with validation
     * @param transactionId Transaction to refund
     * @param amount Refund amount
     * @param refundReason Documented reason for refund
     */
    refundPayment(
        transactionId: string,
        amount: Decimal,
        refundReason: RefundReason
    ): Promise<PaymentResponse>;

    /**
     * Get current status of a payment with detailed information
     * @param transactionId Transaction to check
     */
    getPaymentStatus(transactionId: string): Promise<DetailedPaymentStatus>;
}