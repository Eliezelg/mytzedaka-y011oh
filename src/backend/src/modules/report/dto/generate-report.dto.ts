import { IsString, IsEnum, IsDateString, IsNotEmpty } from 'class-validator'; // ^0.14.0
import { ApiProperty } from '@nestjs/swagger'; // ^5.0.0

/**
 * Enum defining the types of reports available in the system
 */
export enum ReportType {
  DONATION = 'donation',
  FINANCIAL = 'financial',
  TAX = 'tax',
  CAMPAIGN = 'campaign'
}

/**
 * Enum defining the supported export formats for reports
 */
export enum ReportFormat {
  PDF = 'pdf',
  EXCEL = 'excel',
  CSV = 'csv'
}

/**
 * Array of supported language codes for report generation
 */
const SUPPORTED_LANGUAGES = ['he', 'en', 'fr'] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

/**
 * Data Transfer Object for validating report generation request parameters
 * Implements comprehensive validation rules for generating various types of reports
 * including donation reports, financial statements, tax receipts and campaign reports
 */
export class GenerateReportDto {
  @ApiProperty({
    enum: ReportType,
    description: 'Type of report to generate',
    example: ReportType.DONATION,
    required: true
  })
  @IsEnum(ReportType)
  @IsNotEmpty()
  reportType: ReportType;

  @ApiProperty({
    description: 'Start date for the report period (ISO format)',
    example: '2023-01-01',
    required: true
  })
  @IsDateString()
  @IsNotEmpty()
  startDate: Date;

  @ApiProperty({
    description: 'End date for the report period (ISO format)',
    example: '2023-12-31',
    required: true
  })
  @IsDateString()
  @IsNotEmpty()
  endDate: Date;

  @ApiProperty({
    enum: ReportFormat,
    description: 'Desired output format for the report',
    example: ReportFormat.PDF,
    required: true
  })
  @IsEnum(ReportFormat)
  @IsNotEmpty()
  format: ReportFormat;

  @ApiProperty({
    description: 'ID of the association for which to generate the report',
    example: '123e4567-e89b-12d3-a456-426614174000',
    required: true
  })
  @IsString()
  @IsNotEmpty()
  associationId: string;

  @ApiProperty({
    description: 'Language code for report generation',
    enum: SUPPORTED_LANGUAGES,
    example: 'en',
    required: true
  })
  @IsEnum(SUPPORTED_LANGUAGES)
  @IsNotEmpty()
  language: SupportedLanguage;
}