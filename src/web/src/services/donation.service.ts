import axios, { AxiosInstance } from 'axios'; // ^1.5.0
import { createLogger, Logger, format } from 'winston'; // ^3.10.0
import { PDFDocument, StandardFonts } from 'pdf-lib'; // ^1.17.1
import { IDonation, IDonationForm } from '../interfaces/donation.interface';
import { 
    PaymentMethodType, 
    PaymentStatus, 
    PaymentGateway,
    PaymentRequest,
    PaymentResponse 
} from '../interfaces/payment.interface';

/**
 * Service class for managing donation operations with comprehensive error handling,
 * caching, and metrics collection
 */
export class DonationService {
    private readonly logger: Logger;
    private readonly metrics: Map<string, number>;
    private readonly axiosInstance: AxiosInstance;
    private readonly rateLimiter: Map<string, number>;
    private readonly API_BASE_URL: string = process.env.API_BASE_URL || '';
    private readonly STRIPE_PUBLIC_KEY: string = process.env.STRIPE_PUBLIC_KEY || '';
    private readonly TRANZILLA_TERMINAL_ID: string = process.env.TRANZILLA_TERMINAL_ID || '';

    constructor() {
        // Initialize logger
        this.logger = createLogger({
            level: 'info',
            format: format.combine(
                format.timestamp(),
                format.json()
            ),
            transports: [
                new winston.transports.File({ filename: 'donation-service.log' })
            ]
        });

        // Initialize metrics collection
        this.metrics = new Map<string, number>();

        // Initialize rate limiter
        this.rateLimiter = new Map<string, number>();

        // Initialize axios instance with retry mechanism
        this.axiosInstance = axios.create({
            baseURL: this.API_BASE_URL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    /**
     * Creates a new donation with enhanced validation and error handling
     * @param donationData Validated donation form data
     * @returns Promise resolving to created donation with comprehensive status
     */
    public async createDonation(donationData: IDonationForm): Promise<IDonation> {
        try {
            // Validate minimum donation amount based on currency
            this.validateDonationAmount(donationData);

            // Check rate limiting for user
            this.checkRateLimit(donationData.userId);

            // Determine optimal payment gateway
            const gateway = this.determinePaymentGateway(donationData);

            // Prepare payment request
            const paymentRequest: PaymentRequest = this.preparePaymentRequest(donationData);

            // Process payment through selected gateway
            const paymentResponse = await this.processPayment(paymentRequest, gateway);

            // Create donation record
            const donation: IDonation = await this.createDonationRecord(donationData, paymentResponse);

            // Generate tax receipt if required
            if (donationData.taxReceiptRequired) {
                await this.generateTaxReceipt(donation);
            }

            // Update campaign progress if donation is part of a campaign
            if (donationData.campaignId) {
                await this.updateCampaignProgress(donationData.campaignId, donationData.amount);
            }

            // Update metrics
            this.updateMetrics('successful_donations', 1);
            this.updateMetrics('total_amount', donationData.amount);

            return donation;

        } catch (error) {
            this.handleDonationError(error);
            throw error;
        }
    }

    /**
     * Retrieves donation by ID with comprehensive error handling
     * @param donationId Unique identifier of the donation
     * @returns Promise resolving to donation details
     */
    public async getDonationById(donationId: string): Promise<IDonation> {
        try {
            const response = await this.axiosInstance.get(`/donations/${donationId}`);
            return response.data;
        } catch (error) {
            this.logger.error('Error retrieving donation', { donationId, error });
            throw new Error('Failed to retrieve donation');
        }
    }

    /**
     * Retrieves all donations for a specific user
     * @param userId User identifier
     * @param page Page number for pagination
     * @param limit Items per page
     * @returns Promise resolving to paginated list of donations
     */
    public async getUserDonations(userId: string, page = 1, limit = 10): Promise<{
        donations: IDonation[];
        total: number;
    }> {
        try {
            const response = await this.axiosInstance.get('/donations/user', {
                params: { userId, page, limit }
            });
            return response.data;
        } catch (error) {
            this.logger.error('Error retrieving user donations', { userId, error });
            throw new Error('Failed to retrieve user donations');
        }
    }

    /**
     * Generates PDF tax receipt for a donation
     * @param donation Donation details
     * @returns Promise resolving to PDF buffer
     */
    private async generateTaxReceipt(donation: IDonation): Promise<Buffer> {
        try {
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage();
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

            // Add receipt content
            page.drawText(`Tax Receipt for Donation #${donation.id}`, {
                x: 50,
                y: 750,
                font,
                size: 20
            });

            // Add donation details
            const details = [
                `Amount: ${donation.amount} ${donation.currency}`,
                `Date: ${donation.createdAt.toLocaleDateString()}`,
                `Association: ${donation.associationId}`,
                `Transaction ID: ${donation.transactionId}`
            ];

            details.forEach((detail, index) => {
                page.drawText(detail, {
                    x: 50,
                    y: 700 - (index * 30),
                    font,
                    size: 12
                });
            });

            const pdfBytes = await pdfDoc.save();
            return Buffer.from(pdfBytes);

        } catch (error) {
            this.logger.error('Error generating tax receipt', { donationId: donation.id, error });
            throw new Error('Failed to generate tax receipt');
        }
    }

    /**
     * Validates donation amount based on currency and minimum limits
     * @param donationData Donation form data
     */
    private validateDonationAmount(donationData: IDonationForm): void {
        const minimumAmounts = {
            USD: 5,
            EUR: 5,
            ILS: 18,
            GBP: 5
        };

        if (donationData.amount < minimumAmounts[donationData.currency]) {
            throw new Error(`Minimum donation amount for ${donationData.currency} is ${minimumAmounts[donationData.currency]}`);
        }
    }

    /**
     * Determines optimal payment gateway based on currency and region
     * @param donationData Donation form data
     * @returns Selected payment gateway
     */
    private determinePaymentGateway(donationData: IDonationForm): PaymentGateway {
        if (donationData.currency === 'ILS') {
            return PaymentGateway.TRANZILLA;
        }
        return PaymentGateway.STRIPE;
    }

    /**
     * Processes payment through selected gateway with retry mechanism
     * @param paymentRequest Payment request details
     * @param gateway Selected payment gateway
     * @returns Promise resolving to payment response
     */
    private async processPayment(
        paymentRequest: PaymentRequest,
        gateway: PaymentGateway
    ): Promise<PaymentResponse> {
        const maxRetries = 3;
        let attempt = 0;

        while (attempt < maxRetries) {
            try {
                const response = await this.axiosInstance.post(
                    `/payments/${gateway.toLowerCase()}`,
                    paymentRequest
                );
                return response.data;
            } catch (error) {
                attempt++;
                if (attempt === maxRetries) {
                    throw error;
                }
                await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
        }
        throw new Error('Payment processing failed after maximum retries');
    }

    /**
     * Updates metrics for monitoring and analytics
     * @param metric Metric name
     * @param value Metric value
     */
    private updateMetrics(metric: string, value: number): void {
        const currentValue = this.metrics.get(metric) || 0;
        this.metrics.set(metric, currentValue + value);
    }

    /**
     * Handles donation-related errors with logging and metrics
     * @param error Error object
     */
    private handleDonationError(error: any): void {
        this.logger.error('Donation error', { error });
        this.updateMetrics('failed_donations', 1);
        
        if (error.response?.status === 429) {
            throw new Error('Rate limit exceeded. Please try again later.');
        }
        
        throw new Error(error.message || 'An error occurred while processing the donation');
    }

    /**
     * Checks rate limiting for user
     * @param userId User identifier
     */
    private checkRateLimit(userId: string): void {
        const now = Date.now();
        const lastAttempt = this.rateLimiter.get(userId) || 0;
        
        if (now - lastAttempt < 1000) { // 1 second cooldown
            throw new Error('Rate limit exceeded');
        }
        
        this.rateLimiter.set(userId, now);
    }
}