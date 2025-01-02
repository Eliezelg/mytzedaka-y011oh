import { IsNotEmpty, IsNumber, IsString, IsEnum, IsBoolean, IsOptional, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { PaymentMethodType } from '../../../interfaces/payment-gateway.interface';

/**
 * Data Transfer Object for creating new donations with comprehensive validation rules
 * and support for both international and Israeli market requirements.
 * Implements validation for secure payment processing and campaign attribution.
 */
export class CreateDonationDto {
    @ApiProperty({
        description: 'Donation amount in specified currency',
        example: 100.00,
        minimum: 1
    })
    @IsNotEmpty({ message: 'Donation amount is required' })
    @IsNumber({}, { message: 'Amount must be a valid number' })
    @Min(1, { message: 'Minimum donation amount is 1' })
    amount: number;

    @ApiProperty({
        description: 'Three-letter ISO currency code',
        example: 'USD',
        pattern: '^[A-Z]{3}$'
    })
    @IsNotEmpty({ message: 'Currency code is required' })
    @IsString({ message: 'Currency must be a valid ISO code' })
    currency: string;

    @ApiProperty({
        description: 'Payment method type for processing',
        enum: PaymentMethodType,
        examples: [
            PaymentMethodType.CREDIT_CARD,
            PaymentMethodType.ISRAELI_CREDIT_CARD,
            PaymentMethodType.BANK_TRANSFER,
            PaymentMethodType.DIRECT_DEBIT,
            PaymentMethodType.ISRAELI_DIRECT_DEBIT
        ]
    })
    @IsNotEmpty({ message: 'Payment method is required' })
    @IsEnum(PaymentMethodType, { message: 'Invalid payment method type' })
    paymentMethodType: PaymentMethodType;

    @ApiProperty({
        description: 'Unique identifier of the receiving association'
    })
    @IsNotEmpty({ message: 'Association ID is required' })
    @IsString({ message: 'Association ID must be a valid string' })
    associationId: string;

    @ApiProperty({
        description: 'Optional campaign identifier for donation attribution',
        required: false
    })
    @IsOptional()
    @IsString({ message: 'Campaign ID must be a valid string' })
    campaignId?: string;

    @ApiProperty({
        description: 'Flag for anonymous donation',
        default: false
    })
    @IsOptional()
    @IsBoolean({ message: 'Anonymous flag must be a boolean' })
    isAnonymous?: boolean;

    @ApiProperty({
        description: 'Flag for recurring donation setup',
        default: false
    })
    @IsOptional()
    @IsBoolean({ message: 'Recurring flag must be a boolean' })
    isRecurring?: boolean;

    @ApiProperty({
        description: 'Frequency for recurring donations',
        required: false,
        enum: ['monthly', 'quarterly', 'annual']
    })
    @IsOptional()
    @IsString({ message: 'Recurring frequency must be a valid string' })
    recurringFrequency?: 'monthly' | 'quarterly' | 'annual';
}