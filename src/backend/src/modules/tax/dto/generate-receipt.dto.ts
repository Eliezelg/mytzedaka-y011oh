import { IsNotEmpty, IsEnum, IsUUID } from 'class-validator'; // ^0.14.0
import { ApiProperty } from '@nestjs/swagger'; // ^7.0.0

/**
 * Enumeration of supported tax receipt formats
 * @enum {string}
 */
export enum ReceiptFormat {
  /**
   * Standard PDF format for general tax receipts
   */
  PDF = 'PDF',
  
  /**
   * French-specific CERFA format for tax compliance
   */
  CERFA = 'CERFA'
}

/**
 * Data Transfer Object for tax receipt generation requests
 * Supports multiple formats and languages with comprehensive validation
 */
export class GenerateReceiptDto {
  /**
   * Unique identifier of the donation for which the receipt is being generated
   * Must be a valid UUID v4 format
   */
  @ApiProperty({
    description: 'UUID of the donation for which to generate receipt',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsNotEmpty({ message: 'Donation ID is required' })
  @IsUUID('4', { message: 'Invalid donation ID format' })
  donationId: string;

  /**
   * Format specification for the generated receipt
   * Supports standard PDF and French CERFA formats
   */
  @ApiProperty({
    description: 'Format of the receipt to generate',
    enum: ReceiptFormat,
    example: 'CERFA'
  })
  @IsNotEmpty({ message: 'Receipt format is required' })
  @IsEnum(ReceiptFormat, { message: 'Invalid receipt format' })
  format: ReceiptFormat;

  /**
   * Language code for receipt generation
   * Supports English (en), French (fr), and Hebrew (he)
   */
  @ApiProperty({
    description: 'Language for the receipt',
    enum: ['en', 'fr', 'he'],
    example: 'fr'
  })
  @IsNotEmpty({ message: 'Language selection is required' })
  @IsEnum(['en', 'fr', 'he'], { message: 'Unsupported language code' })
  language: string;
}