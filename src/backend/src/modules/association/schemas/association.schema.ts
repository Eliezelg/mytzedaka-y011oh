// mongoose v7.5.0 - MongoDB ODM
import { Schema, model, Document } from 'mongoose';
// validator v13.11.0 - Field validation
import validator from 'validator';
import { PaymentMethodType, PaymentStatus } from '../../interfaces/payment-gateway.interface';

/**
 * Interface for association physical address with enhanced validation
 */
interface IAssociationAddress {
  street: string;
  city: string;
  state?: string;
  country: string;
  postalCode: string;
}

/**
 * Interface for association legal information with Israeli-specific validation
 */
interface IAssociationLegalInfo {
  registrationNumber: string;
  taxId: string;
  registrationDate: Date;
  legalStatus: string;
  lastAuditDate: Date;
  taxExemptionStatus: boolean;
}

/**
 * Interface for association bank information with PCI compliance
 */
interface IAssociationBankInfo {
  bankName: string;
  accountNumber: string;
  branchNumber: string;
  swiftCode?: string;
  iban?: string;
}

/**
 * Interface for association payment gateway configurations
 */
interface IAssociationPaymentGateways {
  stripe?: {
    accountId: string;
    enabled: boolean;
    supportedMethods: PaymentMethodType[];
    status: PaymentStatus;
  };
  tranzilla?: {
    terminalId: string;
    enabled: boolean;
    supportedMethods: PaymentMethodType[];
    status: PaymentStatus;
  };
}

/**
 * Interface for Association document with all required fields
 */
export interface IAssociation extends Document {
  name: string;
  email: string;
  description: string;
  logo?: string;
  website?: string;
  phone: string;
  address: IAssociationAddress;
  legalInfo: IAssociationLegalInfo;
  bankInfo: IAssociationBankInfo;
  paymentGateways: IAssociationPaymentGateways;
  supportedCurrencies: string[];
  status: 'active' | 'pending' | 'suspended';
  verificationStatus: 'verified' | 'pending' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Mongoose schema for Jewish charitable associations with comprehensive validation
 */
const AssociationSchema = new Schema<IAssociation>({
  name: {
    type: String,
    required: [true, 'Association name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters long'],
    maxlength: [100, 'Name cannot exceed 100 characters'],
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email address is required'],
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: (value: string) => validator.isEmail(value),
      message: 'Invalid email address format'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    minlength: [10, 'Description must be at least 10 characters long'],
    maxlength: [5000, 'Description cannot exceed 5000 characters']
  },
  logo: {
    type: String,
    validate: {
      validator: (value: string) => validator.isURL(value),
      message: 'Invalid logo URL format'
    }
  },
  website: {
    type: String,
    validate: {
      validator: (value: string) => validator.isURL(value),
      message: 'Invalid website URL format'
    }
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    validate: {
      validator: (value: string) => validator.isMobilePhone(value, 'any'),
      message: 'Invalid phone number format'
    }
  },
  address: {
    street: {
      type: String,
      required: [true, 'Street address is required'],
      trim: true
    },
    city: {
      type: String,
      required: [true, 'City is required'],
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      required: [true, 'Country is required'],
      enum: {
        values: ['Israel', 'United States', 'France', 'United Kingdom'],
        message: 'Unsupported country'
      }
    },
    postalCode: {
      type: String,
      required: [true, 'Postal code is required'],
      validate: {
        validator: (value: string) => validator.isPostalCode(value, 'any'),
        message: 'Invalid postal code format'
      }
    }
  },
  legalInfo: {
    registrationNumber: {
      type: String,
      required: [true, 'Registration number is required'],
      validate: {
        validator: (value: string) => /^\d{9}$/.test(value),
        message: 'Invalid registration number format'
      }
    },
    taxId: {
      type: String,
      required: [true, 'Tax ID is required'],
      validate: {
        validator: (value: string) => /^\d{9}$/.test(value),
        message: 'Invalid tax ID format'
      }
    },
    registrationDate: {
      type: Date,
      required: [true, 'Registration date is required']
    },
    legalStatus: {
      type: String,
      required: [true, 'Legal status is required'],
      enum: {
        values: ['registered_nonprofit', 'public_benefit_organization', 'charitable_company'],
        message: 'Invalid legal status'
      }
    },
    lastAuditDate: {
      type: Date,
      required: [true, 'Last audit date is required']
    },
    taxExemptionStatus: {
      type: Boolean,
      required: [true, 'Tax exemption status is required']
    }
  },
  bankInfo: {
    type: {
      bankName: String,
      accountNumber: String,
      branchNumber: String,
      swiftCode: String,
      iban: String
    },
    required: [true, 'Bank information is required'],
    select: false // PCI DSS requirement: Restrict access to sensitive data
  },
  paymentGateways: {
    stripe: {
      accountId: String,
      enabled: Boolean,
      supportedMethods: [{
        type: String,
        enum: Object.values(PaymentMethodType)
      }],
      status: {
        type: String,
        enum: Object.values(PaymentStatus)
      }
    },
    tranzilla: {
      terminalId: String,
      enabled: Boolean,
      supportedMethods: [{
        type: String,
        enum: Object.values(PaymentMethodType)
      }],
      status: {
        type: String,
        enum: Object.values(PaymentStatus)
      }
    }
  },
  supportedCurrencies: [{
    type: String,
    enum: {
      values: ['ILS', 'USD', 'EUR', 'GBP'],
      message: 'Unsupported currency'
    }
  }],
  status: {
    type: String,
    required: true,
    enum: ['active', 'pending', 'suspended'],
    default: 'pending'
  },
  verificationStatus: {
    type: String,
    required: true,
    enum: ['verified', 'pending', 'rejected'],
    default: 'pending'
  }
}, {
  timestamps: true,
  collection: 'associations'
});

// Indexes for optimized queries
AssociationSchema.index({ name: 'text', description: 'text' });
AssociationSchema.index({ email: 1 }, { unique: true });
AssociationSchema.index({ createdAt: 1 });
AssociationSchema.index({ 'address.country': 1 });
AssociationSchema.index({ status: 1, verificationStatus: 1 });

// Pre-save hook for data validation and encryption
AssociationSchema.pre('save', async function(next) {
  if (this.isModified('bankInfo')) {
    // Implement encryption for sensitive bank information
    // This would be handled by a separate encryption service
  }
  next();
});

// Post-find hook for decryption of sensitive data
AssociationSchema.post('find', async function(docs) {
  // Implement decryption for sensitive bank information when explicitly requested
  // This would be handled by a separate encryption service
});

export const Association = model<IAssociation>('Association', AssociationSchema);