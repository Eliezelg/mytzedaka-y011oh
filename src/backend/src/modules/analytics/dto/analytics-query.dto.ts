import { IsDate, IsEnum, IsOptional, IsString } from 'class-validator'; // ^0.14.0
import { ApiProperty } from '@nestjs/swagger'; // ^7.0.0

/**
 * Enum defining types of metrics that can be analyzed in the analytics system
 */
export enum MetricType {
  DONATION = 'donation',
  CAMPAIGN = 'campaign',
  ASSOCIATION = 'association'
}

/**
 * Data transfer object for analytics query parameters
 * Used to validate and structure incoming analytics requests
 */
export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Start date for analytics period',
    example: '2023-01-01'
  })
  @IsDate()
  startDate: Date;

  @ApiProperty({
    description: 'End date for analytics period',
    example: '2023-12-31'
  })
  @IsDate()
  endDate: Date;

  @ApiProperty({
    description: 'Type of metric to analyze',
    enum: MetricType,
    example: MetricType.DONATION,
    enumName: 'MetricType'
  })
  @IsEnum(MetricType)
  metricType: MetricType;

  @ApiProperty({
    description: 'Optional association ID for filtering',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @IsOptional()
  @IsString()
  associationId?: string;

  @ApiProperty({
    description: 'Optional campaign ID for filtering',
    required: false,
    example: '123e4567-e89b-12d3-a456-426614174001'
  })
  @IsOptional()
  @IsString()
  campaignId?: string;
}