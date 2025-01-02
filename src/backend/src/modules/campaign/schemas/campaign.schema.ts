// @nestjs/mongoose v10.0.0 - MongoDB schema decorators
import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
// mongoose v7.5.0 - MongoDB document type
import { Document } from 'mongoose';
// Association schema reference
import { Association } from '../association/schemas/association.schema';

/**
 * Prize details interface for lottery campaigns
 */
interface Prize {
  rank: number;
  description: string;
  value: number;
}

/**
 * Schema class for campaign lottery information with enhanced validation
 */
@Schema({ _id: false })
export class CampaignLotteryDetails {
  @Prop({
    type: Date,
    required: true,
    validate: {
      validator: (date: Date) => date > new Date(),
      message: 'Draw date must be in the future'
    }
  })
  drawDate: Date;

  @Prop({
    type: Number,
    required: true,
    min: [1, 'Ticket price must be at least 1']
  })
  ticketPrice: number;

  @Prop({
    type: String,
    required: true,
    enum: ['ILS', 'USD', 'EUR', 'GBP']
  })
  currency: string;

  @Prop({
    type: Number,
    required: true,
    min: [1, 'Must have at least 1 ticket'],
    max: [100000, 'Maximum 100,000 tickets allowed']
  })
  maxTickets: number;

  @Prop({
    type: [{
      rank: { type: Number, required: true, min: 1 },
      description: { type: String, required: true, maxlength: 200 },
      value: { type: Number, required: true, min: 1 }
    }],
    required: true,
    validate: {
      validator: (prizes: Prize[]) => prizes.length > 0,
      message: 'At least one prize must be defined'
    }
  })
  prizes: Prize[];
}

/**
 * Mongoose schema class for fundraising campaigns with comprehensive validation
 */
@Schema({ timestamps: true, collection: 'campaigns' })
export class Campaign extends Document {
  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'Title must be at least 3 characters'],
    maxlength: [100, 'Title cannot exceed 100 characters'],
    validate: {
      validator: (value: string) => /^[\w\s-]+$/i.test(value),
      message: 'Title must be alphanumeric with spaces and hyphens only'
    }
  })
  title: string;

  @Prop({
    type: String,
    required: true,
    trim: true,
    minlength: [10, 'Description must be at least 10 characters'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  })
  description: string;

  @Prop({
    type: Number,
    required: true,
    min: [1, 'Goal amount must be at least 1']
  })
  goalAmount: number;

  @Prop({
    type: String,
    required: true,
    enum: ['ILS', 'USD', 'EUR', 'GBP'],
    uppercase: true
  })
  currency: string;

  @Prop({
    type: Date,
    required: true,
    validate: {
      validator: (date: Date) => date > new Date(),
      message: 'Start date must be in the future'
    }
  })
  startDate: Date;

  @Prop({
    type: Date,
    required: true,
    validate: {
      validator: function(this: Campaign, endDate: Date) {
        return endDate > this.startDate;
      },
      message: 'End date must be after start date'
    }
  })
  endDate: Date;

  @Prop({
    type: String,
    required: true,
    ref: 'Association'
  })
  associationId: Association['id'];

  @Prop({
    type: [String],
    validate: {
      validator: (urls: string[]) => urls.every(url => /^https:\/\/.+/i.test(url)),
      message: 'All image URLs must be HTTPS'
    },
    maxlength: [10, 'Maximum 10 images allowed']
  })
  images: string[];

  @Prop({
    type: [String],
    validate: {
      validator: (tags: string[]) => {
        return tags.every(tag => tag.length >= 1 && tag.length <= 20);
      },
      message: 'Tags must be between 1 and 20 characters'
    },
    maxlength: [10, 'Maximum 10 tags allowed']
  })
  tags: string[];

  @Prop({
    type: Number,
    default: 0,
    min: 0
  })
  currentAmount: number;

  @Prop({
    type: Number,
    default: 0,
    min: 0
  })
  donorCount: number;

  @Prop({
    type: Boolean,
    required: true,
    default: false
  })
  isLottery: boolean;

  @Prop({
    type: CampaignLotteryDetails,
    required: function(this: Campaign) {
      return this.isLottery;
    },
    validate: {
      validator: function(this: Campaign, details: CampaignLotteryDetails) {
        if (!this.isLottery) return true;
        return details?.currency === this.currency;
      },
      message: 'Lottery currency must match campaign currency'
    }
  })
  lotteryDetails?: CampaignLotteryDetails;

  @Prop({
    type: String,
    required: true,
    enum: ['draft', 'active', 'paused', 'completed', 'cancelled'],
    default: 'draft'
  })
  status: string;

  @Prop()
  createdAt: Date;

  @Prop()
  updatedAt: Date;

  /**
   * Calculates campaign progress percentage
   * @returns number between 0 and 100
   */
  getProgress(): number {
    if (!this.goalAmount || this.goalAmount <= 0) return 0;
    const progress = (this.currentAmount / this.goalAmount) * 100;
    return Math.min(Math.max(progress, 0), 100);
  }

  /**
   * Checks if campaign is currently active
   * @returns boolean indicating if campaign is within active dates
   */
  isActive(): boolean {
    const now = new Date();
    return this.startDate <= now && now <= this.endDate;
  }
}

// Create schema factory
export const CampaignSchema = SchemaFactory.createForClass(Campaign);

// Add text search indexes
CampaignSchema.index({ title: 'text', description: 'text' });

// Add compound indexes for common queries
CampaignSchema.index({ associationId: 1, status: 1 });
CampaignSchema.index({ startDate: 1, endDate: 1 });
CampaignSchema.index({ currency: 1 });

// Pre-save hook for validation
CampaignSchema.pre('save', function(next) {
  // Validate date ranges
  if (this.endDate <= this.startDate) {
    next(new Error('End date must be after start date'));
    return;
  }

  // Normalize currency codes
  if (this.currency) {
    this.currency = this.currency.toUpperCase();
  }

  // Validate lottery details if isLottery
  if (this.isLottery && !this.lotteryDetails) {
    next(new Error('Lottery details required for lottery campaigns'));
    return;
  }

  next();
});