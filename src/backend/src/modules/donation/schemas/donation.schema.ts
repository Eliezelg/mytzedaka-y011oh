// mongoose v6.0.0 - MongoDB ODM for TypeScript
import { Schema, Document } from 'mongoose';
import { PaymentMethodType, PaymentStatus } from '../../../interfaces/payment-gateway.interface';

/**
 * Interface defining the structure of a donation document with strict typing
 * Extends Document for Mongoose integration
 */
export interface IDonation extends Document {
  _id: Schema.Types.ObjectId;
  amount: number;
  currency: 'USD' | 'EUR' | 'ILS';
  paymentMethodType: PaymentMethodType;
  paymentStatus: PaymentStatus;
  transactionId: string;
  userId: Schema.Types.ObjectId;
  associationId: Schema.Types.ObjectId;
  campaignId?: Schema.Types.ObjectId;
  isAnonymous: boolean;
  isRecurring: boolean;
  recurringFrequency?: 'monthly' | 'annual';
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema definition for donations with comprehensive validation rules
 * Implements strict data validation and optimized indexing for efficient querying
 */
export const DonationSchema = new Schema<IDonation>(
  {
    amount: {
      type: Number,
      required: [true, 'Donation amount is required'],
      min: [0, 'Amount must be greater than or equal to 0'],
      max: [1000000000, 'Amount exceeds maximum allowed value'],
      validate: {
        validator: (value: number) => value > 0,
        message: 'Amount must be greater than 0'
      }
    },
    currency: {
      type: String,
      required: [true, 'Currency is required'],
      enum: {
        values: ['USD', 'EUR', 'ILS'],
        message: 'Invalid currency code'
      },
      uppercase: true,
      trim: true
    },
    paymentMethodType: {
      type: String,
      required: [true, 'Payment method type is required'],
      enum: {
        values: Object.values(PaymentMethodType),
        message: 'Invalid payment method type'
      }
    },
    paymentStatus: {
      type: String,
      required: [true, 'Payment status is required'],
      enum: {
        values: Object.values(PaymentStatus),
        message: 'Invalid payment status'
      }
    },
    transactionId: {
      type: String,
      required: [true, 'Transaction ID is required'],
      unique: true,
      trim: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true
    },
    associationId: {
      type: Schema.Types.ObjectId,
      ref: 'Association',
      required: [true, 'Association ID is required'],
      index: true
    },
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: 'Campaign',
      index: true
    },
    isAnonymous: {
      type: Boolean,
      required: true,
      default: false
    },
    isRecurring: {
      type: Boolean,
      required: true,
      default: false
    },
    recurringFrequency: {
      type: String,
      enum: {
        values: ['monthly', 'annual'],
        message: 'Invalid recurring frequency'
      },
      required: function(this: IDonation) {
        return this.isRecurring;
      }
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true,
    collection: 'donations',
    versionKey: '__v',
    toJSON: {
      virtuals: true,
      getters: true,
      transform: function(doc, ret) {
        delete ret.__v;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      getters: true
    }
  }
);

// Compound indexes for optimized querying
DonationSchema.index({ userId: 1, associationId: 1 }, { background: true });
DonationSchema.index({ associationId: 1, campaignId: 1 }, { background: true });
DonationSchema.index({ createdAt: 1 }, { background: true });
DonationSchema.index({ transactionId: 1 }, { unique: true, background: true });

// Pre-save hook for validation
DonationSchema.pre('save', function(next) {
  if (this.isRecurring && !this.recurringFrequency) {
    next(new Error('Recurring frequency is required for recurring donations'));
  }
  next();
});

// Virtual for formatted amount with currency
DonationSchema.virtual('formattedAmount').get(function(this: IDonation) {
  return `${this.amount} ${this.currency}`;
});

// Method to check if donation is refundable
DonationSchema.methods.isRefundable = function(): boolean {
  const refundableStatuses = [PaymentStatus.COMPLETED];
  const maxRefundPeriod = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  const isWithinRefundPeriod = Date.now() - this.createdAt.getTime() <= maxRefundPeriod;
  
  return refundableStatuses.includes(this.paymentStatus) && isWithinRefundPeriod;
};

export default DonationSchema;