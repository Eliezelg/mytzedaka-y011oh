import {
  IsString,
  IsNumber,
  IsDate,
  IsOptional,
  IsBoolean,
  IsArray,
  Min,
  Max,
  Length,
} from 'class-validator'; // ^0.14.0
import { Type } from 'class-transformer'; // ^0.5.1

/**
 * Data Transfer Object for campaign creation requests.
 * Implements comprehensive validation for all campaign properties including
 * support for multi-currency donations and lottery-based campaigns.
 */
export class CreateCampaignDto {
  @IsString({ message: 'Title must be a string' })
  @Length(5, 100, { message: 'Title must be between 5 and 100 characters' })
  title: string;

  @IsString({ message: 'Description must be a string' })
  @Length(20, 2000, { message: 'Description must be between 20 and 2000 characters' })
  description: string;

  @IsNumber({}, { message: 'Goal amount must be a number' })
  @Min(1, { message: 'Goal amount must be greater than 0' })
  goalAmount: number;

  @IsString({ message: 'Currency must be a valid ISO code' })
  @Length(3, 3, { message: 'Currency must be a 3-character ISO code' })
  currency: string;

  @IsDate({ message: 'Start date must be a valid date' })
  @Type(() => Date)
  startDate: Date;

  @IsDate({ message: 'End date must be a valid date' })
  @Type(() => Date)
  endDate: Date;

  @IsString({ message: 'Association ID must be a string' })
  associationId: string;

  @IsOptional()
  @IsArray({ message: 'Images must be an array of strings' })
  @IsString({ each: true, message: 'Each image must be a valid URL' })
  images?: string[];

  @IsOptional()
  @IsArray({ message: 'Tags must be an array of strings' })
  @IsString({ each: true, message: 'Each tag must be a string' })
  tags?: string[];

  @IsOptional()
  @IsBoolean({ message: 'isLottery must be a boolean value' })
  isLottery?: boolean;
}