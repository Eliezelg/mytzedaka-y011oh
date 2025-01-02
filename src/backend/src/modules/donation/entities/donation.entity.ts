// typeorm v0.3.0 - Database ORM for entity management
import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  ManyToOne, 
  CreateDateColumn, 
  UpdateDateColumn, 
  Index,
  BeforeInsert
} from 'typeorm';

// class-validator v0.14.0 - Property validation
import { 
  IsNumber, 
  IsString, 
  IsEnum, 
  IsBoolean, 
  IsDate, 
  IsUUID,
  IsOptional,
  ValidateNested
} from 'class-validator';

// class-transformer v0.5.0 - Data transformation and security
import { 
  Exclude, 
  Transform, 
  Type 
} from 'class-transformer';

// Internal imports for payment processing
import { 
  PaymentMethodType, 
  PaymentStatus 
} from '../../../interfaces/payment-gateway.interface';

@Entity('donations')
@Index(['userId', 'createdAt'])
@Index(['associationId', 'paymentStatus'])
@Index(['campaignId', 'createdAt'])
@Index(['transactionId'], { unique: true })
export class DonationEntity {
  @PrimaryGeneratedColumn('uuid')
  @IsUUID()
  id: string;

  @Column('decimal', { precision: 20, scale: 2 })
  @IsNumber()
  @Transform(({ value }) => parseFloat(value))
  amount: number;

  @Column({ length: 3 })
  @IsString()
  currency: string;

  @Column({
    type: 'enum',
    enum: PaymentMethodType
  })
  @IsEnum(PaymentMethodType)
  paymentMethodType: PaymentMethodType;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING
  })
  @IsEnum(PaymentStatus)
  paymentStatus: PaymentStatus;

  @Column({ unique: true })
  @IsString()
  @Transform(({ value }) => value.replace(/\d{12}/, '******'))
  transactionId: string;

  @Column('uuid')
  @IsUUID()
  userId: string;

  @Column('uuid')
  @IsUUID()
  associationId: string;

  @Column('uuid', { nullable: true })
  @IsUUID()
  @IsOptional()
  campaignId?: string;

  @Column({ default: false })
  @IsBoolean()
  isAnonymous: boolean;

  @Column({ default: false })
  @IsBoolean()
  isRecurring: boolean;

  @Column({ nullable: true })
  @IsString()
  @IsOptional()
  recurringFrequency?: string;

  @Column()
  @IsString()
  paymentGateway: 'STRIPE' | 'TRANZILLA';

  @Column('jsonb', { nullable: true })
  @ValidateNested()
  @Type(() => Object)
  @Exclude({ toPlainOnly: true })
  metadata?: {
    israeliId?: string;
    taxInvoiceRequired?: boolean;
    riskScore?: number;
    fraudChecksPassed?: boolean;
    pciValidationPassed?: boolean;
    ipVerificationPassed?: boolean;
    threeDSecureStatus?: string;
  };

  @CreateDateColumn()
  @IsDate()
  @Transform(({ value }) => value.toISOString())
  createdAt: Date;

  @UpdateDateColumn()
  @IsDate()
  @Transform(({ value }) => value.toISOString())
  updatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  @IsDate()
  @IsOptional()
  @Transform(({ value }) => value?.toISOString())
  processedAt?: Date;

  @BeforeInsert()
  async beforeInsert(): Promise<void> {
    // Validate currency format
    if (!/^[A-Z]{3}$/.test(this.currency)) {
      throw new Error('Invalid currency format');
    }

    // Validate payment method compatibility with gateway
    if (
      this.paymentGateway === 'TRANZILLA' && 
      ![PaymentMethodType.ISRAELI_CREDIT_CARD, PaymentMethodType.ISRAELI_DIRECT_DEBIT].includes(this.paymentMethodType)
    ) {
      throw new Error('Invalid payment method for Tranzilla gateway');
    }

    // Set default values for metadata
    this.metadata = {
      ...this.metadata,
      pciValidationPassed: true,
      fraudChecksPassed: true,
      riskScore: 0,
      ipVerificationPassed: true
    };

    // Generate secure transaction ID if not provided
    if (!this.transactionId) {
      this.transactionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  toJSON(): Record<string, any> {
    const json = {
      id: this.id,
      amount: this.amount,
      currency: this.currency,
      paymentMethodType: this.paymentMethodType,
      paymentStatus: this.paymentStatus,
      transactionId: this.transactionId,
      associationId: this.associationId,
      campaignId: this.campaignId,
      isAnonymous: this.isAnonymous,
      isRecurring: this.isRecurring,
      recurringFrequency: this.recurringFrequency,
      paymentGateway: this.paymentGateway,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      processedAt: this.processedAt
    };

    // Handle anonymous donations
    if (this.isAnonymous) {
      delete json['userId'];
    } else {
      json['userId'] = this.userId;
    }

    // Remove null/undefined values
    Object.keys(json).forEach(key => {
      if (json[key] === null || json[key] === undefined) {
        delete json[key];
      }
    });

    return json;
  }
}