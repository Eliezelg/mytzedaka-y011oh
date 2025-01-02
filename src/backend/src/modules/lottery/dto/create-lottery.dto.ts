import { 
  IsString, 
  IsDate, 
  IsNumber, 
  IsArray, 
  ValidateNested, 
  Min, 
  Max, 
  IsEnum,
  ArrayMinSize,
  ArrayMaxSize,
  MinLength,
  MaxLength
} from 'class-validator'; // ^0.14.0

import { Type } from 'class-transformer'; // ^0.5.1
import { LotteryPrize } from '../entities/lottery.entity';

/**
 * Supported currencies for lottery operations
 */
enum SupportedCurrencies {
  USD = 'USD',
  EUR = 'EUR',
  ILS = 'ILS',
  GBP = 'GBP'
}

/**
 * DTO for validating lottery prize information with comprehensive validation rules
 */
export class CreateLotteryPrizeDto implements LotteryPrize {
  @IsString({ message: 'Prize name must be a valid string' })
  @MinLength(3, { message: 'Prize name must be at least 3 characters long' })
  @MaxLength(100, { message: 'Prize name cannot exceed 100 characters' })
  name: string;

  @IsString({ message: 'Prize description must be a valid string' })
  @MinLength(10, { message: 'Prize description must be at least 10 characters long' })
  @MaxLength(1000, { message: 'Prize description cannot exceed 1000 characters' })
  description: string;

  @IsNumber({}, { message: 'Prize value must be a valid positive number' })
  @Min(0, { message: 'Prize value must be greater than or equal to 0' })
  @Max(1000000, { message: 'Prize value cannot exceed maximum allowed value' })
  value: number;

  @IsString({ message: 'Prize currency must be a valid ISO currency code' })
  @IsEnum(SupportedCurrencies, { message: 'Prize currency must be one of the supported currencies' })
  currency: string;
}

/**
 * DTO for creating and validating a new lottery in a campaign with comprehensive validation rules
 */
export class CreateLotteryDto {
  @IsString({ message: 'Campaign ID must be a valid string' })
  campaignId: string;

  @IsDate({ message: 'Draw date must be a valid future date' })
  @Type(() => Date)
  drawDate: Date;

  @IsNumber({}, { message: 'Ticket price must be a valid positive number' })
  @Min(1, { message: 'Ticket price must be greater than 0' })
  @Max(1000000, { message: 'Ticket price cannot exceed maximum allowed value' })
  ticketPrice: number;

  @IsString({ message: 'Currency must be a valid ISO currency code' })
  @IsEnum(SupportedCurrencies, { message: 'Currency must be one of the supported currencies' })
  currency: string;

  @IsNumber({}, { message: 'Maximum tickets must be a valid positive number' })
  @Min(1, { message: 'Maximum tickets must be greater than 0' })
  @Max(100000, { message: 'Maximum tickets cannot exceed platform limit' })
  maxTickets: number;

  @IsArray({ message: 'Prizes must be an array of valid prize objects' })
  @ValidateNested({ each: true })
  @ArrayMinSize(1, { message: 'At least one prize must be specified' })
  @ArrayMaxSize(100, { message: 'Cannot exceed maximum number of prizes' })
  @Type(() => CreateLotteryPrizeDto)
  prizes: LotteryPrize[];
}