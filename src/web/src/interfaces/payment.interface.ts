/**
 * Payment interfaces and types for the International Jewish Association Donation Platform
 * Supporting dual payment gateway integration with Stripe Connect (international) and Tranzilla (Israeli market)
 */

/**
 * Supported payment method types across both payment gateways
 */
export enum PaymentMethodType {
    CREDIT_CARD = 'CREDIT_CARD',
    BANK_TRANSFER = 'BANK_TRANSFER',
    DIRECT_DEBIT = 'DIRECT_DEBIT'
}

/**
 * Payment transaction status types
 */
export enum PaymentStatus {
    PENDING = 'PENDING',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    FAILED = 'FAILED',
    REFUNDED = 'REFUNDED'
}

/**
 * Supported payment gateway providers
 */
export enum PaymentGateway {
    STRIPE = 'STRIPE',    // For international payments
    TRANZILLA = 'TRANZILLA'  // For Israeli market
}

/**
 * Interface for billing address information
 * Required for payment method validation and tax receipt generation
 */
export interface BillingAddress {
    street: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

/**
 * Interface for payment method details
 * Supports both credit card and bank transfer information
 */
export interface PaymentMethod {
    id: string;
    type: PaymentMethodType;
    gateway: PaymentGateway;
    lastFourDigits: string;
    cardBrand: string;
    cardholderName: string;
    expiryMonth: number;
    expiryYear: number;
    isDefault: boolean;
    billingAddress: BillingAddress;
}

/**
 * Interface for payment request data
 * Used when initiating a payment transaction
 */
export interface PaymentRequest {
    amount: number;
    currency: string;
    paymentMethodId: string;
    donorId: string;
    associationId: string;
    campaignId?: string;
    isRecurring: boolean;
}

/**
 * Interface for payment processing response
 * Contains transaction details and status information
 */
export interface PaymentResponse {
    transactionId: string;
    gatewayReference: string;
    status: PaymentStatus;
    amount: number;
    currency: string;
    processingFee: number;
    netAmount: number;
    gateway: PaymentGateway;
    createdAt: Date;
    errorMessage?: string;
    errorCode?: string;
}