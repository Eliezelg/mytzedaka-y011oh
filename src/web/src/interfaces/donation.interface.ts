/**
 * Donation interfaces for the International Jewish Association Donation Platform
 * Supports international and Israeli market transactions with multi-currency functionality
 * @version 1.0.0
 */

import { 
    PaymentMethodType, 
    PaymentStatus, 
    PaymentGateway 
} from './payment.interface';

/**
 * Comprehensive interface for donation data
 * Supports international transactions, tax receipts, and recurring donations
 */
export interface IDonation {
    /** Unique identifier for the donation */
    readonly id: string;

    /** Donation amount (must be positive and within allowed limits per currency) */
    amount: number;

    /** Supported currency codes for donation */
    currency: 'USD' | 'EUR' | 'ILS' | 'GBP';

    /** Type of payment method used for donation */
    paymentMethodType: PaymentMethodType;

    /** Payment gateway used (Stripe for international, Tranzilla for Israeli market) */
    paymentGateway: PaymentGateway;

    /** Current status of the payment processing */
    readonly paymentStatus: PaymentStatus;

    /** Payment gateway transaction identifier */
    readonly transactionId: string;

    /** Identifier of the donor making the donation */
    readonly userId: string;

    /** Identifier of the receiving charitable association */
    readonly associationId: string;

    /** Optional identifier of associated fundraising campaign */
    campaignId: string | null;

    /** Flag indicating if donation should be anonymous */
    isAnonymous: boolean;

    /** Flag indicating if this is a recurring donation */
    isRecurring: boolean;

    /** Frequency for recurring donations */
    recurringFrequency: 'monthly' | 'annual' | null;

    /** Flag indicating if tax receipt should be generated */
    taxReceiptRequired: boolean;

    /** Timestamp of donation creation (UTC) */
    readonly createdAt: Date;

    /** Timestamp of last donation update (UTC) */
    readonly updatedAt: Date;

    /** Additional metadata for future extensibility */
    metadata: Record<string, unknown>;
}

/**
 * Interface for donation form data with validation rules
 * Used for collecting and validating donation information before processing
 */
export interface IDonationForm {
    /** Donation amount (minimum 5 units in any currency) */
    amount: number;

    /** Selected currency for donation */
    currency: 'USD' | 'EUR' | 'ILS' | 'GBP';

    /** Selected payment method type */
    paymentMethodType: PaymentMethodType;

    /** Selected payment gateway based on currency and region */
    paymentGateway: PaymentGateway;

    /** Selected receiving association */
    associationId: string;

    /** Optional campaign identifier */
    campaignId: string | null;

    /** Anonymous donation preference */
    isAnonymous: boolean;

    /** Recurring donation preference */
    isRecurring: boolean;

    /** Selected frequency for recurring donations */
    recurringFrequency: 'monthly' | 'annual' | null;

    /** Tax receipt generation preference */
    taxReceiptRequired: boolean;

    /** Additional form metadata */
    metadata: Record<string, unknown>;
}