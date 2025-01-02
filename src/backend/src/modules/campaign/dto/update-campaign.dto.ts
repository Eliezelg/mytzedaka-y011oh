import {
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  Min,
  Max,
  Length,
  IsEnum,
  IsISO4217
} from 'class-validator'; // ^0.14.0
import { Type, PartialType, OmitType, ApiProperty } from '@nestjs/swagger'; // ^7.0.0
import { CreateCampaignDto } from './create-campaign.dto';

/**
 * Enum representing possible campaign statuses
 */
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * Data Transfer Object for campaign update requests.
 * Extends CreateCampaignDto to inherit base validations while making all fields optional.
 * Includes additional validation for campaign status and enhanced currency validation.
 */
@PartialType(CreateCampaignDto)
export class UpdateCampaignDto {
  @ApiProperty({ required: false, description: 'Campaign title', minLength: 5, maxLength: 100 })
  @IsOptional()
  @IsString({ message: 'Title must be a string' })
  @Length(5, 100, { message: 'Title must be between 5 and 100 characters' })
  title?: string;

  @ApiProperty({ required: false, description: 'Campaign description', minLength: 20, maxLength: 2000 })
  @IsOptional()
  @IsString({ message: 'Description must be a string' })
  @Length(20, 2000, { message: 'Description must be between 20 and 2000 characters' })
  description?: string;

  @ApiProperty({ required: false, description: 'Campaign goal amount', minimum: 1 })
  @IsOptional()
  @IsNumber({}, { message: 'Goal amount must be a number' })
  @Min(1, { message: 'Goal amount must be greater than 0' })
  goalAmount?: number;

  @ApiProperty({ required: false, description: 'Campaign currency in ISO 4217 format' })
  @IsOptional()
  @IsString({ message: 'Currency must be a valid ISO code' })
  @IsISO4217({ message: 'Currency must be a valid ISO 4217 currency code' })
  currency?: string;

  @ApiProperty({ required: false, description: 'Campaign start date' })
  @IsOptional()
  @IsDate({ message: 'Start date must be a valid date' })
  @Type(() => Date)
  startDate?: Date;

  @ApiProperty({ required: false, description: 'Campaign end date' })
  @IsOptional()
  @IsDate({ message: 'End date must be a valid date' })
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({ required: false, description: 'Campaign image URLs', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Images must be an array of strings' })
  @IsString({ each: true, message: 'Each image must be a valid URL' })
  images?: string[];

  @ApiProperty({ required: false, description: 'Campaign tags', type: [String] })
  @IsOptional()
  @IsArray({ message: 'Tags must be an array of strings' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  @Length(1, 30, { each: true, message: 'Each tag must be between 1 and 30 characters' })
  tags?: string[];

  @ApiProperty({ required: false, description: 'Indicates if campaign includes lottery functionality' })
  @IsOptional()
  @IsBoolean({ message: 'isLottery must be a boolean value' })
  isLottery?: boolean;

  @ApiProperty({ required: false, enum: CampaignStatus, description: 'Campaign status' })
  @IsOptional()
  @IsEnum(CampaignStatus, { message: 'Status must be a valid campaign status' })
  status?: CampaignStatus;
}