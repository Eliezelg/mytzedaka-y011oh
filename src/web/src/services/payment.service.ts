/**
 * Payment Service Implementation
 * Handles payment processing operations through dual payment gateway integration
 * @version 1.0.0
 */

import { loadStripe } from '@stripe/stripe-js'; // v1.54.1
import axiosRetry from 'axios-retry'; // v3.8.0
import {
    PaymentMethod,
    PaymentRequest,
    PaymentResponse,
    PaymentStatus,
    PaymentGateway,
    PaymentMethodType
} from '../interfaces/payment.interface';

// Configuration constants
const STRIPE_PUBLIC_KEY = process.env.REACT_APP_STRIPE_PUBLIC_KEY;
const TRANZILLA_TERMINAL_ID = process.env.REACT_APP_TRANZILLA_TERMINAL_ID;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000;

/**
 * Service class for handling payment processing operations
 * Supports dual payment gateway integration with comprehensive error handling
 */
export class PaymentService {
    private stripe: any;
    private axiosInstance: any;

    constructor() {
        this.initializeStripe();
        this.configureRetryMechanism();
    }

    /**
     * Initializes Stripe payment gateway
     * @private
     */
    private async initializeStripe(): Promise<void> {
        try {
            this.stripe = await loadStripe(STRIPE_PUBLIC_KEY!);
            if (!this.stripe) {
                throw new Error('Failed to initialize Stripe');
            }
        } catch (error) {
            console.error('Stripe initialization error:', error);
            throw new Error('Payment gateway initialization failed');
        }
    }

    /**
     * Configures axios retry mechanism for resilient API calls
     * @private
     */
    private configureRetryMechanism(): void {
        axiosRetry(this.axiosInstance, {
            retries: MAX_RETRY_ATTEMPTS,
            retryDelay: (retryCount) => retryCount * RETRY_DELAY,
            retryCondition: (error) => {
                return axiosRetry.isNetworkOrIdempotentRequestError(error) ||
                    error.response?.status === 429;
            }
        });
    }

    /**
     * Adds a new payment method for the authenticated donor
     * @param paymentMethodData Payment method details to be added
     * @returns Promise resolving to created payment method details
     */
    public async addPaymentMethod(paymentMethodData: Partial<PaymentMethod>): Promise<PaymentMethod> {
        try {
            // Validate payment method data
            this.validatePaymentMethodData(paymentMethodData);

            const gateway = this.determinePaymentGateway(paymentMethodData.type!);
            let paymentMethod: PaymentMethod;

            if (gateway === PaymentGateway.STRIPE) {
                paymentMethod = await this.addStripePaymentMethod(paymentMethodData);
            } else {
                paymentMethod = await this.addTranzillaPaymentMethod(paymentMethodData);
            }

            return paymentMethod;
        } catch (error: any) {
            console.error('Add payment method error:', error);
            throw new Error(`Failed to add payment method: ${error.message}`);
        }
    }

    /**
     * Initiates a recurring payment subscription
     * @param recurringPaymentData Recurring payment setup details
     * @returns Promise resolving to payment response
     */
    public async initiateRecurringPayment(recurringPaymentData: PaymentRequest): Promise<PaymentResponse> {
        try {
            // Validate recurring payment data
            this.validateRecurringPaymentData(recurringPaymentData);

            const paymentMethod = await this.getPaymentMethod(recurringPaymentData.paymentMethodId);
            
            if (!this.isRecurringSupported(paymentMethod)) {
                throw new Error('Payment method does not support recurring payments');
            }

            const response = await this.processRecurringPayment(recurringPaymentData, paymentMethod);
            return this.formatPaymentResponse(response);
        } catch (error: any) {
            console.error('Recurring payment error:', error);
            throw new Error(`Failed to setup recurring payment: ${error.message}`);
        }
    }

    /**
     * Validates currency code and conversion rates
     * @param currencyCode Currency code to validate
     * @returns Promise resolving to validation result
     */
    public async validateCurrency(currencyCode: string): Promise<boolean> {
        try {
            // Validate currency format
            if (!this.isValidCurrencyFormat(currencyCode)) {
                return false;
            }

            // Check if currency is supported by payment gateways
            const isSupported = await this.isCurrencySupported(currencyCode);
            if (!isSupported) {
                return false;
            }

            // Verify conversion rate availability
            const hasConversionRate = await this.checkConversionRate(currencyCode);
            return hasConversionRate;
        } catch (error) {
            console.error('Currency validation error:', error);
            return false;
        }
    }

    /**
     * Processes a payment through Stripe gateway
     * @private
     * @param paymentData Payment request data
     * @returns Promise resolving to payment response
     */
    private async processStripePayment(paymentData: PaymentRequest): Promise<any> {
        try {
            const paymentIntent = await this.stripe.paymentIntents.create({
                amount: this.convertToSmallestUnit(paymentData.amount, paymentData.currency),
                currency: paymentData.currency.toLowerCase(),
                payment_method: paymentData.paymentMethodId,
                confirm: true,
                return_url: `${window.location.origin}/payment/confirm`
            });

            return paymentIntent;
        } catch (error) {
            throw new Error('Stripe payment processing failed');
        }
    }

    /**
     * Processes a payment through Tranzilla gateway
     * @private
     * @param paymentData Payment request data
     * @returns Promise resolving to payment response
     */
    private async processTranzillaPayment(paymentData: PaymentRequest): Promise<any> {
        try {
            // Implement Tranzilla payment processing
            // This is a placeholder for the actual implementation
            return {
                status: PaymentStatus.COMPLETED,
                transactionId: 'TRZ' + Date.now()
            };
        } catch (error) {
            throw new Error('Tranzilla payment processing failed');
        }
    }

    /**
     * Validates payment method data
     * @private
     * @param data Payment method data to validate
     */
    private validatePaymentMethodData(data: Partial<PaymentMethod>): void {
        if (!data.type || !Object.values(PaymentMethodType).includes(data.type)) {
            throw new Error('Invalid payment method type');
        }

        if (data.type === PaymentMethodType.CREDIT_CARD) {
            if (!data.cardholderName || !data.expiryMonth || !data.expiryYear) {
                throw new Error('Invalid credit card details');
            }
        }
    }

    /**
     * Determines appropriate payment gateway based on payment method type
     * @private
     * @param type Payment method type
     * @returns Selected payment gateway
     */
    private determinePaymentGateway(type: PaymentMethodType): PaymentGateway {
        // Implementation based on business rules
        return PaymentGateway.STRIPE; // Default to Stripe for this example
    }

    /**
     * Formats payment response according to interface specification
     * @private
     * @param rawResponse Raw payment gateway response
     * @returns Formatted payment response
     */
    private formatPaymentResponse(rawResponse: any): PaymentResponse {
        return {
            transactionId: rawResponse.id || rawResponse.transactionId,
            status: this.mapPaymentStatus(rawResponse.status),
            amount: rawResponse.amount,
            currency: rawResponse.currency,
            gateway: rawResponse.gateway,
            errorCode: rawResponse.error?.code,
            createdAt: new Date(),
            gatewayReference: rawResponse.reference,
            processingFee: this.calculateProcessingFee(rawResponse),
            netAmount: this.calculateNetAmount(rawResponse)
        };
    }

    /**
     * Maps payment gateway status to internal payment status
     * @private
     * @param gatewayStatus Status from payment gateway
     * @returns Internal payment status
     */
    private mapPaymentStatus(gatewayStatus: string): PaymentStatus {
        const statusMap: { [key: string]: PaymentStatus } = {
            'succeeded': PaymentStatus.COMPLETED,
            'processing': PaymentStatus.PROCESSING,
            'failed': PaymentStatus.FAILED
        };
        return statusMap[gatewayStatus] || PaymentStatus.PENDING;
    }

    /**
     * Checks if currency format is valid
     * @private
     * @param currencyCode Currency code to validate
     * @returns Validation result
     */
    private isValidCurrencyFormat(currencyCode: string): boolean {
        return /^[A-Z]{3}$/.test(currencyCode);
    }

    /**
     * Checks if currency is supported by payment gateways
     * @private
     * @param currencyCode Currency code to check
     * @returns Promise resolving to support status
     */
    private async isCurrencySupported(currencyCode: string): Promise<boolean> {
        const supportedCurrencies = ['USD', 'EUR', 'ILS', 'GBP'];
        return supportedCurrencies.includes(currencyCode);
    }

    /**
     * Converts amount to smallest currency unit
     * @private
     * @param amount Amount to convert
     * @param currency Currency of amount
     * @returns Converted amount
     */
    private convertToSmallestUnit(amount: number, currency: string): number {
        const multipliers: { [key: string]: number } = {
            'USD': 100,
            'EUR': 100,
            'ILS': 100,
            'GBP': 100
        };
        return Math.round(amount * (multipliers[currency] || 100));
    }
}