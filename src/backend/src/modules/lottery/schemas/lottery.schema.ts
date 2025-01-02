// mongoose v6.0.0 - MongoDB schema definition utilities
import { Schema, Document } from 'mongoose';
// crypto native - Secure random number generation
import { randomBytes } from 'crypto';
// Campaign schema reference
import { Campaign } from '../../campaign/schemas/campaign.schema';

/**
 * Embedded schema for lottery audit trail with PCI compliance
 */
const LotteryAuditSchema = new Schema({
  action: {
    type: String,
    required: true,
    enum: ['TICKET_PURCHASE', 'WINNER_SELECTION', 'PRIZE_DISTRIBUTION', 'SECURITY_CHECK']
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true,
    validate: {
      validator: (ip: string) => /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(ip),
      message: 'Invalid IP address format'
    }
  },
  details: {
    type: Schema.Types.Mixed,
    required: true
  },
  timestamp: {
    type: Date,
    default: Date.now,
    required: true
  }
}, { _id: false });

/**
 * Embedded schema for lottery prize information with enhanced validation
 */
const LotteryPrizeSchema = new Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: [3, 'Prize name must be at least 3 characters'],
    maxlength: [100, 'Prize name cannot exceed 100 characters']
  },
  description: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'Prize description cannot exceed 500 characters']
  },
  value: {
    type: Number,
    required: true,
    min: [1, 'Prize value must be positive']
  },
  currency: {
    type: String,
    required: true,
    enum: ['ILS', 'USD', 'EUR', 'GBP'],
    uppercase: true
  },
  distributionStatus: {
    type: String,
    required: true,
    enum: ['PENDING', 'DISTRIBUTED', 'FAILED'],
    default: 'PENDING'
  },
  validationDetails: {
    verifiedBy: String,
    verificationDate: Date,
    verificationDocuments: [String]
  },
  distributionDate: Date
}, { _id: false });

/**
 * Embedded schema for lottery ticket information with security enhancements
 */
const LotteryTicketSchema = new Schema({
  number: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (number: string) => /^[A-Z0-9]{8}$/.test(number),
      message: 'Invalid ticket number format'
    }
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  purchaseDate: {
    type: Date,
    required: true,
    default: Date.now
  },
  transactionId: {
    type: String,
    required: true,
    unique: true
  },
  purchaseIp: {
    type: String,
    required: true
  },
  securityHash: {
    type: String,
    required: true,
    select: false // PCI compliance: Restrict access to security data
  },
  rateLimit: {
    purchases: {
      type: Number,
      default: 0
    },
    lastPurchase: Date
  }
}, { _id: false });

/**
 * Enhanced Mongoose schema for secure lottery management
 */
const LotterySchema = new Schema({
  campaignId: {
    type: String,
    required: true,
    ref: 'Campaign',
    index: true
  },
  drawDate: {
    type: Date,
    required: true,
    validate: {
      validator: (date: Date) => date > new Date(),
      message: 'Draw date must be in the future'
    }
  },
  ticketPrice: {
    type: Number,
    required: true,
    min: [1, 'Ticket price must be at least 1']
  },
  currency: {
    type: String,
    required: true,
    enum: ['ILS', 'USD', 'EUR', 'GBP'],
    uppercase: true
  },
  maxTickets: {
    type: Number,
    required: true,
    min: [10, 'Minimum 10 tickets required'],
    max: [100000, 'Maximum 100,000 tickets allowed']
  },
  soldTickets: {
    type: Number,
    default: 0,
    min: 0
  },
  prizes: {
    type: [LotteryPrizeSchema],
    required: true,
    validate: {
      validator: (prizes: any[]) => prizes.length > 0,
      message: 'At least one prize must be defined'
    }
  },
  tickets: {
    type: [LotteryTicketSchema],
    select: false // PCI compliance: Restrict access to ticket data
  },
  winners: [{
    ticketNumber: String,
    userId: String,
    prizeId: Schema.Types.ObjectId,
    selectionDate: Date,
    verified: Boolean
  }],
  status: {
    type: String,
    required: true,
    enum: ['PENDING', 'ACTIVE', 'DRAWING', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING'
  },
  auditTrail: {
    type: [LotteryAuditSchema],
    select: false // PCI compliance: Restrict access to audit data
  },
  securitySettings: {
    maxTicketsPerUser: {
      type: Number,
      required: true,
      default: 10
    },
    purchaseRateLimit: {
      windowMs: {
        type: Number,
        default: 3600000 // 1 hour
      },
      maxPurchases: {
        type: Number,
        default: 5
      }
    }
  }
}, {
  timestamps: true,
  collection: 'lotteries'
});

// Indexes for optimized queries and security
LotterySchema.index({ campaignId: 1, status: 1 });
LotterySchema.index({ drawDate: 1 });
LotterySchema.index({ 'tickets.userId': 1 });
LotterySchema.index({ 'tickets.number': 1 }, { unique: true });

/**
 * Securely selects lottery winners using cryptographic randomness
 */
LotterySchema.methods.selectWinner = async function(): Promise<any> {
  if (this.status !== 'ACTIVE' || this.soldTickets < 1) {
    throw new Error('Lottery is not eligible for drawing');
  }

  const randomBuffer = randomBytes(32);
  const randomValue = randomBuffer.readUInt32BE(0) / 0xffffffff;
  const winningIndex = Math.floor(randomValue * this.soldTickets);

  const winner = this.tickets[winningIndex];
  if (!winner) {
    throw new Error('Winner selection failed');
  }

  // Record winner selection in audit trail
  this.auditTrail.push({
    action: 'WINNER_SELECTION',
    userId: 'SYSTEM',
    ipAddress: '0.0.0.0',
    details: {
      ticketNumber: winner.number,
      selectionMethod: 'CRYPTOGRAPHIC_RANDOM',
      timestamp: new Date()
    }
  });

  return winner;
};

/**
 * Validates lottery integrity and security compliance
 */
LotterySchema.methods.validateLotteryIntegrity = async function(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const issues: string[] = [];

  // Validate ticket sequence integrity
  const ticketNumbers = new Set(this.tickets.map(t => t.number));
  if (ticketNumbers.size !== this.tickets.length) {
    issues.push('Duplicate ticket numbers detected');
  }

  // Validate prize distribution
  const totalPrizeValue = this.prizes.reduce((sum, prize) => sum + prize.value, 0);
  const totalTicketValue = this.ticketPrice * this.maxTickets;
  if (totalPrizeValue > totalTicketValue) {
    issues.push('Total prize value exceeds potential ticket sales');
  }

  // Validate security settings
  if (!this.securitySettings.maxTicketsPerUser || !this.securitySettings.purchaseRateLimit) {
    issues.push('Invalid security settings configuration');
  }

  return {
    valid: issues.length === 0,
    issues
  };
};

// Pre-save middleware for validation and security checks
LotterySchema.pre('save', async function(next) {
  if (this.isModified('currency')) {
    this.currency = this.currency.toUpperCase();
  }

  // Validate currency matches campaign currency
  const campaign = await this.model('Campaign').findById(this.campaignId);
  if (campaign && campaign.currency !== this.currency) {
    next(new Error('Lottery currency must match campaign currency'));
    return;
  }

  // Validate draw date is within campaign dates
  if (campaign && (this.drawDate < campaign.startDate || this.drawDate > campaign.endDate)) {
    next(new Error('Draw date must be within campaign dates'));
    return;
  }

  next();
});

export interface ILottery extends Document {
  campaignId: string;
  drawDate: Date;
  ticketPrice: number;
  currency: string;
  maxTickets: number;
  soldTickets: number;
  prizes: any[];
  tickets: any[];
  winners: any[];
  status: string;
  auditTrail: any[];
  securitySettings: {
    maxTicketsPerUser: number;
    purchaseRateLimit: {
      windowMs: number;
      maxPurchases: number;
    };
  };
  selectWinner(): Promise<any>;
  validateLotteryIntegrity(): Promise<{ valid: boolean; issues: string[] }>;
}

export const LotterySchema = Schema;