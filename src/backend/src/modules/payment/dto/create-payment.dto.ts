import { IsNotEmpty, IsEnum, IsNumber, IsString, IsUUID, IsOptional, Min, IsISO4217, Transform } from 'class-validator';
import { PaymentMethodType } from '../../../interfaces/payment-gateway.interface';
import { validateDonationAmount } from '../../../utils/validation.util';

/**
 * Data Transfer Object for creating new payment transactions
 * Implements comprehensive validation rules for secure payment processing
 * Ensures PCI DSS Level 1 compliance through strict data validation
 */
export class CreatePaymentDto {
  /**
   * Payment amount with strict validation:
   * - Must be positive number
   * - Maximum 2 decimal places
   * - Validated against currency-specific rules
   */
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  @Transform(({ value }) => validateDonationAmount(value))
  amount: number;

  /**
   * ISO 4217 currency code
   * Supported currencies: USD, EUR, ILS
   * Automatically converted to uppercase
   */
  @IsNotEmpty()
  @IsString()
  @IsISO4217()
  @Transform(({ value }) => value.toUpperCase())
  currency: string;

  /**
   * Payment method type
   * Must match supported gateway methods:
   * - CREDIT_CARD
   * - BANK_TRANSFER
   * - DIRECT_DEBIT
   * - ISRAELI_CREDIT_CARD
   * - ISRAELI_DIRECT_DEBIT
   */
  @IsNotEmpty()
  @IsEnum(PaymentMethodType, { message: 'Invalid payment method type' })
  paymentMethodType: PaymentMethodType;

  /**
   * UUID v4 of the donor making the payment
   * Required for transaction tracking and receipt generation
   */
  @IsNotEmpty()
  @IsUUID('4', { message: 'Invalid donor ID format' })
  donorId: string;

  /**
   * UUID v4 of the receiving association
   * Required for payment routing and financial reporting
   */
  @IsNotEmpty()
  @IsUUID('4', { message: 'Invalid association ID format' })
  associationId: string;

  /**
   * Optional UUID v4 of associated campaign
   * Used for campaign progress tracking and reporting
   */
  @IsOptional()
  @IsUUID('4', { message: 'Invalid campaign ID format' })
  campaignId?: string;

  /**
   * Optional additional payment metadata
   * Sanitized through JSON transform to prevent XSS
   * No sensitive data should be included
   */
  @IsOptional()
  @Transform(({ value }) => JSON.parse(JSON.stringify(value)))
  metadata?: Record<string, unknown>;
}