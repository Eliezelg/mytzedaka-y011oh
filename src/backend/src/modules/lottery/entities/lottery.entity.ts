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
  IsUUID,
  MinLength,
  MaxLength,
  ValidateNested,
  Min,
  Length,
  Matches
} from 'class-validator';

import { AuditLog } from 'nestjs-audit-log'; // ^1.0.0
import { Campaign } from '../../campaign/entities/campaign.entity';

/**
 * Lottery status enumeration
 */
export enum LotteryStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  DRAWING = 'DRAWING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

/**
 * Prize details for lottery with validation
 */
@ValidateNested()
export class LotteryPrize {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsNumber()
  @Min(0)
  value: number;

  @IsString()
  @Length(3, 3)
  currency: string;
}

/**
 * Lottery ticket information with validation
 */
@ValidateNested()
export class LotteryTicket {
  @IsString()
  @Matches(/^[A-Z0-9]{8}$/)
  number: string;

  @IsString()
  @IsUUID()
  userId: string;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  purchaseDate: Date;

  @IsString()
  @IsUUID()
  transactionId: string;
}

/**
 * Lottery winner information with validation
 */
@ValidateNested()
export class LotteryWinner {
  @IsString()
  @IsUUID()
  userId: string;

  @IsString()
  @Matches(/^[A-Z0-9]{8}$/)
  ticketNumber: string;

  @ValidateNested()
  prize: LotteryPrize;

  @IsDate()
  @Transform(({ value }) => new Date(value))
  drawDate: Date;
}

/**
 * TypeORM entity class for lottery management with enhanced validation and auditing
 */
@Entity('lotteries')
@Index(['campaignId'])
@Index(['status'])
@AuditLog()
export class Lottery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsUUID()
  campaignId: string;

  @ManyToOne(() => Campaign)
  @JoinColumn({ name: 'campaignId' })
  campaign: Campaign;

  @Column()
  @IsDate()
  @Transform(({ value }) => new Date(value))
  drawDate: Date;

  @Column('decimal')
  @IsNumber()
  @Min(0)
  ticketPrice: number;

  @Column()
  @IsString()
  @Length(3, 3)
  currency: string;

  @Column()
  @IsNumber()
  @Min(1)
  maxTickets: number;

  @Column()
  @IsNumber()
  @Min(0)
  soldTickets: number;

  @Column('jsonb')
  @ValidateNested({ each: true })
  prizes: LotteryPrize[];

  @Column('jsonb')
  @ValidateNested({ each: true })
  tickets: LotteryTicket[];

  @Column('jsonb')
  @ValidateNested({ each: true })
  winners: LotteryWinner[];

  @Column()
  @IsEnum(LotteryStatus)
  status: LotteryStatus;

  @Column()
  @IsString()
  lastModifiedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  /**
   * Checks if lottery drawing can be performed with enhanced validation
   * @returns True if drawing conditions are met
   */
  isDrawingAvailable(): boolean {
    const now = new Date();
    const minimumTicketThreshold = this.maxTickets * 0.25; // 25% minimum threshold

    return (
      this.status === LotteryStatus.ACTIVE &&
      now >= this.drawDate &&
      this.soldTickets >= minimumTicketThreshold &&
      this.winners.length === 0 &&
      Array.isArray(this.prizes) &&
      this.prizes.length > 0
    );
  }

  /**
   * Checks if lottery has available tickets with rate limiting check
   * @returns True if tickets are available and rate limit not exceeded
   */
  hasAvailableTickets(): boolean {
    const purchaseWindow = new Date();
    purchaseWindow.setMinutes(purchaseWindow.getMinutes() - 5);

    // Check rate limiting - max 100 tickets per 5 minutes
    const recentTickets = this.tickets.filter(
      ticket => new Date(ticket.purchaseDate) >= purchaseWindow
    ).length;

    return (
      this.status === LotteryStatus.ACTIVE &&
      this.soldTickets < this.maxTickets &&
      recentTickets < 100 &&
      new Date() < this.drawDate
    );
  }
}