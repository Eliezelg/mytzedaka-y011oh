import { Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';
import * as retry from 'retry';
import * as winston from 'winston';
import { 
    PaymentGatewayInterface,
    PaymentRequest,
    PaymentResponse,
    PaymentStatus,
    SecurityContext,
    PaymentMethodDetails,
    DetailedPaymentStatus,
    RefundReason
} from '../../../interfaces/payment-gateway.interface';
import { TranzillaConfigValidation } from '../../../config/payment.config';

@Injectable()
export class TranzillaProvider implements PaymentGatewayInterface {
    private config: TranzillaConfigValidation;
    private httpClient: AxiosInstance;
    private logger: winston.Logger;
    private retryOperation: retry.RetryOperation;

    constructor(config: TranzillaConfigValidation) {
        this.config = config;
        this.initializeLogger();
        this.initializeHttpClient();
        this.initializeRetryPolicy();
    }

    private initializeLogger(): void {
        this.logger = winston.createLogger({
            level: 'info',
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json()
            ),
            defaultMeta: { service: 'tranzilla-provider' },
            transports: [
                new winston.transports.File({ filename: 'tranzilla-error.log', level: 'error' }),
                new winston.transports.File({ filename: 'tranzilla-combined.log' })
            ]
        });
    }

    private initializeHttpClient(): void {
        this.httpClient = axios.create({
            baseURL: this.config.apiEndpoint,
            timeout: this.config.retryPolicy.backoffMs,
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json',
                'X-Terminal-Id': this.config.terminalId
            },
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: true,
                minVersion: 'TLSv1.3'
            })
        });
    }

    private initializeRetryPolicy(): void {
        this.retryOperation = retry.operation({
            retries: this.config.retryPolicy.maxAttempts,
            factor: 2,
            minTimeout: this.config.retryPolicy.backoffMs,
            maxTimeout: this.config.retryPolicy.backoffMs * 5,
            randomize: true
        });
    }

    private generateHmacSignature(payload: string): string {
        return crypto
            .createHmac('sha256', this.config.apiKey)
            .update(payload)
            .digest('hex');
    }

    private validateIpAddress(ipAddress: string): boolean {
        return this.config.allowedIPs.includes(ipAddress);
    }

    private async logTransaction(action: string, details: Record<string, unknown>): Promise<void> {
        this.logger.info({
            action,
            timestamp: new Date().toISOString(),
            details,
            terminalId: this.config.terminalId
        });
    }

    public async initialize(config: TranzillaConfigValidation): Promise<void> {
        try {
            this.config = config;
            
            // Validate configuration
            if (!this.config.terminalId || !this.config.apiKey) {
                throw new Error('Invalid Tranzilla configuration: Missing required credentials');
            }

            // Test API connectivity
            const testResponse = await this.httpClient.post('/test_connection', {
                terminal_id: this.config.terminalId
            });

            if (testResponse.status !== 200) {
                throw new Error('Failed to establish connection with Tranzilla API');
            }

            await this.logTransaction('INITIALIZE', { success: true });
        } catch (error) {
            await this.logTransaction('INITIALIZE_ERROR', { error: error.message });
            throw error;
        }
    }

    public async createPayment(request: PaymentRequest): Promise<PaymentResponse> {
        try {
            // Validate request
            if (!request.amount || !request.currency || request.currency !== 'ILS') {
                throw new Error('Invalid payment request: Missing required fields or invalid currency');
            }

            const payload = {
                terminal_id: this.config.terminalId,
                sum: request.amount.toString(),
                currency: request.currency,
                transaction_type: '1', // Regular transaction
                credit_type: '1', // Regular credit
                association_id: request.associationId,
                donor_id: request.donorId
            };

            const signature = this.generateHmacSignature(JSON.stringify(payload));

            return await new Promise((resolve, reject) => {
                this.retryOperation.attempt(async (currentAttempt) => {
                    try {
                        const response = await this.httpClient.post('/transaction', {
                            ...payload,
                            signature
                        });

                        const paymentResponse: PaymentResponse = {
                            transactionId: response.data.transaction_id,
                            status: this.mapTranzillaStatus(response.data.status),
                            amount: request.amount,
                            currency: request.currency,
                            gatewayResponse: response.data,
                            timestamps: {
                                created: new Date(),
                                lastUpdated: new Date()
                            },
                            securityChecks: {
                                fraudDetectionPassed: true,
                                pciValidationPassed: true,
                                riskAssessmentScore: 0,
                                ipVerificationPassed: true
                            }
                        };

                        await this.logTransaction('CREATE_PAYMENT', {
                            transactionId: paymentResponse.transactionId,
                            status: paymentResponse.status
                        });

                        resolve(paymentResponse);
                    } catch (error) {
                        if (this.retryOperation.retry(error)) {
                            return;
                        }
                        await this.logTransaction('CREATE_PAYMENT_ERROR', {
                            error: error.message,
                            attempt: currentAttempt
                        });
                        reject(error);
                    }
                });
            });
        } catch (error) {
            await this.logTransaction('CREATE_PAYMENT_ERROR', { error: error.message });
            throw error;
        }
    }

    public async processPayment(
        transactionId: string,
        paymentMethodDetails: PaymentMethodDetails,
        securityContext: SecurityContext
    ): Promise<PaymentResponse> {
        try {
            // Validate IP address
            if (!this.validateIpAddress(securityContext.ipAddress)) {
                throw new Error('Invalid IP address');
            }

            const payload = {
                terminal_id: this.config.terminalId,
                transaction_id: transactionId,
                token: paymentMethodDetails.tokenizedData,
                session_id: securityContext.sessionId
            };

            const signature = this.generateHmacSignature(JSON.stringify(payload));

            return await new Promise((resolve, reject) => {
                this.retryOperation.attempt(async (currentAttempt) => {
                    try {
                        const response = await this.httpClient.post('/process', {
                            ...payload,
                            signature
                        });

                        const paymentResponse: PaymentResponse = {
                            transactionId,
                            status: this.mapTranzillaStatus(response.data.status),
                            amount: response.data.amount,
                            currency: 'ILS',
                            gatewayResponse: response.data,
                            timestamps: {
                                created: new Date(response.data.created_at),
                                processed: new Date(),
                                lastUpdated: new Date()
                            },
                            securityChecks: {
                                fraudDetectionPassed: response.data.fraud_check_passed,
                                pciValidationPassed: true,
                                riskAssessmentScore: response.data.risk_score,
                                ipVerificationPassed: true
                            }
                        };

                        await this.logTransaction('PROCESS_PAYMENT', {
                            transactionId,
                            status: paymentResponse.status
                        });

                        resolve(paymentResponse);
                    } catch (error) {
                        if (this.retryOperation.retry(error)) {
                            return;
                        }
                        await this.logTransaction('PROCESS_PAYMENT_ERROR', {
                            error: error.message,
                            attempt: currentAttempt
                        });
                        reject(error);
                    }
                });
            });
        } catch (error) {
            await this.logTransaction('PROCESS_PAYMENT_ERROR', { error: error.message });
            throw error;
        }
    }

    public async refundPayment(
        transactionId: string,
        amount: number,
        refundReason: RefundReason
    ): Promise<PaymentResponse> {
        try {
            const payload = {
                terminal_id: this.config.terminalId,
                transaction_id: transactionId,
                refund_amount: amount.toString(),
                reason_code: refundReason.code,
                reason_description: refundReason.description
            };

            const signature = this.generateHmacSignature(JSON.stringify(payload));

            const response = await this.httpClient.post('/refund', {
                ...payload,
                signature
            });

            const paymentResponse: PaymentResponse = {
                transactionId,
                status: PaymentStatus.REFUNDED,
                amount,
                currency: 'ILS',
                gatewayResponse: response.data,
                timestamps: {
                    created: new Date(response.data.created_at),
                    refunded: new Date(),
                    lastUpdated: new Date()
                },
                securityChecks: {
                    fraudDetectionPassed: true,
                    pciValidationPassed: true,
                    riskAssessmentScore: 0,
                    ipVerificationPassed: true
                }
            };

            await this.logTransaction('REFUND_PAYMENT', {
                transactionId,
                amount,
                reason: refundReason
            });

            return paymentResponse;
        } catch (error) {
            await this.logTransaction('REFUND_PAYMENT_ERROR', { error: error.message });
            throw error;
        }
    }

    public async getPaymentStatus(transactionId: string): Promise<DetailedPaymentStatus> {
        try {
            const payload = {
                terminal_id: this.config.terminalId,
                transaction_id: transactionId
            };

            const signature = this.generateHmacSignature(JSON.stringify(payload));

            const response = await this.httpClient.post('/status', {
                ...payload,
                signature
            });

            const detailedStatus: DetailedPaymentStatus = {
                transactionId,
                status: this.mapTranzillaStatus(response.data.status),
                amount: response.data.amount,
                currency: 'ILS',
                gatewayResponse: response.data,
                timestamps: {
                    created: new Date(response.data.created_at),
                    lastUpdated: new Date()
                },
                securityChecks: {
                    fraudDetectionPassed: response.data.fraud_check_passed,
                    pciValidationPassed: true,
                    riskAssessmentScore: response.data.risk_score,
                    ipVerificationPassed: true
                },
                processingDetails: {
                    attempts: response.data.attempts,
                    lastAttemptTimestamp: new Date(response.data.last_attempt),
                    nextRetryTimestamp: response.data.next_retry ? new Date(response.data.next_retry) : undefined
                },
                auditTrail: {
                    events: response.data.audit_trail.map(event => ({
                        timestamp: new Date(event.timestamp),
                        action: event.action,
                        actor: event.actor,
                        details: event.details
                    }))
                }
            };

            await this.logTransaction('GET_PAYMENT_STATUS', {
                transactionId,
                status: detailedStatus.status
            });

            return detailedStatus;
        } catch (error) {
            await this.logTransaction('GET_PAYMENT_STATUS_ERROR', { error: error.message });
            throw error;
        }
    }

    private mapTranzillaStatus(tranzillaStatus: string): PaymentStatus {
        const statusMap: Record<string, PaymentStatus> = {
            '000': PaymentStatus.COMPLETED,
            '001': PaymentStatus.PROCESSING,
            '002': PaymentStatus.FAILED,
            '003': PaymentStatus.REFUNDED,
            '004': PaymentStatus.CANCELLED
        };
        return statusMap[tranzillaStatus] || PaymentStatus.FAILED;
    }
}