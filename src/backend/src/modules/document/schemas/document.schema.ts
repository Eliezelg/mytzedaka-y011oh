/**
 * @fileoverview Enhanced Document Schema Definition
 * Defines a comprehensive Mongoose schema for secure document management
 * with advanced security features, metadata tracking, and compliance support.
 * @version 1.0.0
 */

import { Schema, Document } from 'mongoose'; // @version ^6.0.0
import { StorageFileMetadata } from '../../../interfaces/storage-provider.interface';

/**
 * Enum defining possible document types with security classifications
 */
export enum DocumentType {
  TAX_RECEIPT = 'TAX_RECEIPT',
  ASSOCIATION_DOCUMENT = 'ASSOCIATION_DOCUMENT',
  FINANCIAL_REPORT = 'FINANCIAL_REPORT',
  VERIFICATION_DOCUMENT = 'VERIFICATION_DOCUMENT'
}

/**
 * Enum defining document verification statuses
 */
enum DocumentStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

/**
 * Interface for document security attributes
 */
interface SecurityAttributes {
  encryptionLevel: string;
  accessControl: {
    roles: string[];
    permissions: string[];
    ipRestrictions?: string[];
  };
  dataClassification: string;
  geographicRestrictions: string[];
}

/**
 * Interface for audit trail entries
 */
interface AuditEntry {
  action: string;
  timestamp: Date;
  userId: Schema.Types.ObjectId;
  details: Record<string, any>;
}

/**
 * Enhanced document schema with comprehensive security features
 */
export const DocumentSchema = new Schema({
  type: {
    type: String,
    enum: Object.values(DocumentType),
    required: true,
    index: true
  },

  metadata: {
    fileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    path: { type: String, required: true },
    checksum: { type: String, required: true },
    encryptionStatus: { type: String, required: true },
    retentionPeriod: { type: Date, required: true }
  },

  status: {
    type: String,
    enum: Object.values(DocumentStatus),
    default: DocumentStatus.PENDING,
    required: true,
    index: true
  },

  securityAttributes: {
    encryptionLevel: {
      type: String,
      required: true,
      enum: ['AES-256-GCM', 'AES-256-CBC']
    },
    accessControl: {
      roles: [{ type: String }],
      permissions: [{ type: String }],
      ipRestrictions: [{ type: String }]
    },
    dataClassification: {
      type: String,
      required: true,
      enum: ['PUBLIC', 'INTERNAL', 'SENSITIVE', 'CRITICAL']
    },
    geographicRestrictions: [{ type: String }]
  },

  auditTrail: [{
    action: { type: String, required: true },
    timestamp: { type: Date, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    details: { type: Schema.Types.Mixed }
  }],

  associationId: {
    type: Schema.Types.ObjectId,
    ref: 'Association',
    required: true,
    index: true
  },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },

  createdAt: {
    type: Date,
    default: Date.now,
    required: true
  },

  updatedAt: {
    type: Date,
    default: Date.now,
    required: true
  },

  lastAccessedAt: {
    type: Date,
    required: true,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'documents'
});

/**
 * Index definitions for optimized queries
 */
DocumentSchema.index({ 'metadata.fileName': 1 });
DocumentSchema.index({ createdAt: -1 });
DocumentSchema.index({ updatedAt: -1 });
DocumentSchema.index({ 'securityAttributes.dataClassification': 1 });

/**
 * Pre-save middleware for security and audit
 */
DocumentSchema.pre('save', function(next) {
  const document = this as any;
  
  // Update timestamps
  document.updatedAt = new Date();
  
  // Add audit trail entry for document modification
  document.auditTrail.push({
    action: document.isNew ? 'DOCUMENT_CREATED' : 'DOCUMENT_UPDATED',
    timestamp: new Date(),
    userId: document.userId,
    details: {
      modificationType: document.isNew ? 'CREATE' : 'UPDATE',
      modifiedFields: document.modifiedPaths()
    }
  });

  // Verify document checksum if modified
  if (document.isModified('metadata.checksum')) {
    // Checksum verification logic would go here
  }

  // Update encryption status if content modified
  if (document.isModified('metadata.path')) {
    document.metadata.encryptionStatus = 'ENCRYPTED';
  }

  next();
});

/**
 * Pre-remove middleware for audit logging
 */
DocumentSchema.pre('remove', function(next) {
  const document = this as any;
  
  // Add audit trail entry for document deletion
  document.auditTrail.push({
    action: 'DOCUMENT_DELETED',
    timestamp: new Date(),
    userId: document.userId,
    details: {
      modificationType: 'DELETE'
    }
  });

  next();
});

/**
 * Virtual for remaining retention period
 */
DocumentSchema.virtual('retentionRemaining').get(function() {
  const document = this as any;
  const now = new Date();
  return document.metadata.retentionPeriod.getTime() - now.getTime();
});

/**
 * Method to check if document is accessible
 */
DocumentSchema.methods.isAccessible = function(userId: Schema.Types.ObjectId, userRoles: string[]): boolean {
  const document = this as any;
  
  // Check retention period
  if (document.retentionRemaining <= 0) {
    return false;
  }

  // Check access control
  const hasRole = document.securityAttributes.accessControl.roles
    .some((role: string) => userRoles.includes(role));

  return hasRole;
};

export interface IDocument extends Document {
  type: DocumentType;
  metadata: StorageFileMetadata;
  status: DocumentStatus;
  securityAttributes: SecurityAttributes;
  auditTrail: AuditEntry[];
  associationId: Schema.Types.ObjectId;
  userId?: Schema.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  lastAccessedAt: Date;
  retentionRemaining: number;
  isAccessible(userId: Schema.Types.ObjectId, userRoles: string[]): boolean;
}