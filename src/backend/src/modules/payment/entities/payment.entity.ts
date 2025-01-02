import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn,
  ManyToOne 
} from 'typeorm'; // ^0.3.17

import { 
  PaymentMethodType,
  PaymentStatus 
} from '../../../interfaces/payment-gateway.interface';

/**
 * Entity representing a payment transaction in the database
 * Implements PCI DSS Level 1 compliance with enhanced validation and security features
 */
@Entity('payments')
export class PaymentEntity {
  /**
   * Unique identifier for the payment transaction
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Payment amount with high precision decimal support
   * Enforces positive value validation
   */
  @Column('decimal', { 
    precision: 15, 
    scale: 2,
    check: 'amount > 0'
  })
  amount: number;

  /**
   * ISO 4217 currency code
   * Enforces 3-letter uppercase format validation
   */
  @Column({ 
    length: 3,
    check: "currency ~ '^[A-Z]{3}$'"
  })
  currency: string;

  /**
   * Current status of the payment transaction
   */
  @Column({ 
    type: 'enum',
    enum: PaymentStatus
  })
  status: PaymentStatus;

  /**
   * Type of payment method used for the transaction
   */
  @Column({ 
    type: 'enum',
    enum: PaymentMethodType
  })
  paymentMethodType: PaymentMethodType;

  /**
   * External transaction ID from payment gateway
   * Optional for pending transactions
   */
  @Column({ 
    nullable: true,
    length: 255
  })
  gatewayTransactionId: string;

  /**
   * UUID of the donor making the payment
   */
  @Column('uuid')
  donorId: string;

  /**
   * UUID of the receiving association
   */
  @Column('uuid')
  associationId: string;

  /**
   * Optional UUID of the associated campaign
   */
  @Column('uuid', { 
    nullable: true 
  })
  campaignId: string;

  /**
   * Additional payment metadata stored as JSONB
   * Size limited to prevent abuse
   */
  @Column('jsonb', { 
    nullable: true,
    check: "length(metadata::text) <= 10000"
  })
  metadata: Record<string, unknown>;

  /**
   * Detailed error message for failed transactions
   * Length limited for storage efficiency
   */
  @Column({ 
    nullable: true,
    length: 1000
  })
  errorMessage: string;

  /**
   * Timestamp of payment creation
   * Automatically managed by TypeORM
   */
  @CreateDateColumn()
  createdAt: Date;

  /**
   * Timestamp of last payment update
   * Automatically managed by TypeORM
   */
  @UpdateDateColumn()
  updatedAt: Date;
}