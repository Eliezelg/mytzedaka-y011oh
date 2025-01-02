import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn, 
  ManyToOne, 
  JoinColumn, 
  Index 
} from 'typeorm'; // ^0.3.0

import { 
  Exclude, 
  Transform 
} from 'class-transformer'; // ^0.5.1

import {
  IsDate,
  IsNumber,
  IsString,
  IsEnum,
  MinLength,
  MaxLength,
  IsOptional,
  ValidateNested,
  Min,
  Length
} from 'class-validator';

import { Association } from '../association/entities/association.entity';

/**
 * Campaign status enumeration
 */
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * Prize details for lottery campaigns
 */
export class CampaignPrize {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  description: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsNumber()
  @Min(1)
  rank: number;
}

/**
 * Embedded class for campaign lottery information with enhanced validation
 */
export class CampaignLotteryDetails {
  @IsDate()
  @Transform(({ value }) => new Date(value))
  drawDate: Date;

  @IsNumber()
  @Min(0)
  ticketPrice: number;

  @IsString()
  @Length(3, 3)
  currency: string;

  @IsNumber()
  @Min(1)
  maxTickets: number;

  @ValidateNested({ each: true })
  prizes: CampaignPrize[];
}

/**
 * TypeORM entity class for fundraising campaigns with enhanced validation 
 * and performance optimizations
 */
@Entity('campaigns')
@Index(['associationId', 'status'])
@Index(['startDate', 'endDate'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @MinLength(5)
  @MaxLength(100)
  @Transform(({ value }) => value.trim())
  title: string;

  @Column('text')
  @MinLength(20)
  @MaxLength(2000)
  description: string;

  @Column('decimal', { precision: 20, scale: 2 })
  @IsNumber()
  @Min(0)
  goalAmount: number;

  @Column()
  @IsString()
  @Length(3, 3)
  currency: string;

  @Column()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  startDate: Date;

  @Column()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  endDate: Date;

  @Column()
  @Index()
  associationId: string;

  @ManyToOne(() => Association)
  @JoinColumn({ name: 'associationId' })
  association: Association;

  @Column('simple-array')
  @IsOptional()
  images: string[];

  @Column('simple-array')
  @IsOptional()
  tags: string[];

  @Column('decimal', { precision: 20, scale: 2, default: 0 })
  @IsNumber()
  @Min(0)
  currentAmount: number;

  @Column({ default: 0 })
  @IsNumber()
  @Min(0)
  donorCount: number;

  @Column({ default: false })
  isLottery: boolean;

  @Column('jsonb', { nullable: true })
  @ValidateNested()
  @IsOptional()
  lotteryDetails: CampaignLotteryDetails;

  @Column()
  @IsEnum(CampaignStatus)
  status: CampaignStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Calculates campaign progress percentage with decimal precision
   * @returns Progress percentage between 0 and 100 with 2 decimal places
   */
  getProgress(): number {
    if (this.goalAmount === 0) return 0;
    const progress = (this.currentAmount / this.goalAmount) * 100;
    return Math.min(Math.max(Number(progress.toFixed(2)), 0), 100);
  }

  /**
   * Checks if campaign is currently active with timezone consideration
   * @returns True if campaign is within start and end dates and status is active
   */
  isActive(): boolean {
    const now = new Date();
    return (
      this.status === CampaignStatus.ACTIVE &&
      now >= this.startDate &&
      now <= this.endDate
    );
  }

  /**
   * Validates lottery campaign configuration
   * @returns True if lottery configuration is valid
   */
  @Exclude()
  private validateLotteryConfig(): boolean {
    if (!this.isLottery) return true;
    if (!this.lotteryDetails) return false;

    const now = new Date();
    return (
      this.lotteryDetails.drawDate > now &&
      this.lotteryDetails.drawDate <= this.endDate &&
      this.lotteryDetails.ticketPrice > 0 &&
      this.lotteryDetails.maxTickets > 0 &&
      Array.isArray(this.lotteryDetails.prizes) &&
      this.lotteryDetails.prizes.length > 0
    );
  }
}