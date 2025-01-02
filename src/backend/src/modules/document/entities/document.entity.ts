/**
 * @fileoverview Document Entity Definition
 * Implements secure document storage and management with comprehensive tracking
 * and verification capabilities for the International Jewish Association Donation Platform.
 * @version 1.0.0
 */

import { 
  Entity, 
  Column, 
  ManyToOne, 
  CreateDateColumn, 
  UpdateDateColumn, 
  PrimaryGeneratedColumn 
} from 'typeorm'; // typeorm@^0.3.0
import { StorageFileMetadata } from '../../interfaces/storage-provider.interface';

/**
 * Enum defining all supported document types in the system
 * Maps to specific document handling workflows and verification requirements
 */
export enum DocumentType {
  TAX_RECEIPT = 'TAX_RECEIPT',
  ASSOCIATION_DOCUMENT = 'ASSOCIATION_DOCUMENT',
  FINANCIAL_REPORT = 'FINANCIAL_REPORT',
  VERIFICATION_DOCUMENT = 'VERIFICATION_DOCUMENT'
}

/**
 * Enum defining possible verification states for documents
 * Used for tracking document review and approval status
 */
export enum DocumentStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED'
}

/**
 * Document entity representing secure document storage with comprehensive
 * metadata tracking and verification capabilities
 */
@Entity('documents')
export class Document {
  /**
   * Unique identifier for the document
   * Uses UUID for security and global uniqueness
   */
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Type of document, determining handling and verification requirements
   * Mapped as enum for type safety and validation
   */
  @Column({
    type: 'enum',
    enum: DocumentType,
    comment: 'Type of document determining handling workflow'
  })
  type: DocumentType;

  /**
   * Comprehensive file metadata including security information
   * Stored as JSONB for efficient querying and flexibility
   */
  @Column('jsonb', {
    comment: 'File metadata including security and encryption details'
  })
  metadata: StorageFileMetadata;

  /**
   * Current verification status of the document
   * Tracks review and approval workflow state
   */
  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.PENDING,
    comment: 'Current verification status of document'
  })
  status: DocumentStatus;

  /**
   * Optional description or notes about the document
   * Supports multilingual content
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: 'Optional document description or notes'
  })
  description: string;

  /**
   * ID of the association this document belongs to
   * Required for access control and organization
   */
  @Column('uuid', {
    comment: 'Association ID for ownership and access control'
  })
  associationId: string;

  /**
   * ID of the user who created or uploaded the document
   * Optional for system-generated documents
   */
  @Column('uuid', {
    nullable: true,
    comment: 'User ID of document creator/uploader'
  })
  userId: string;

  /**
   * Timestamp of document creation
   * Automatically managed by TypeORM
   */
  @CreateDateColumn({
    type: 'timestamp with time zone',
    comment: 'Creation timestamp for audit trail'
  })
  createdAt: Date;

  /**
   * Timestamp of last document update
   * Automatically managed by TypeORM
   */
  @UpdateDateColumn({
    type: 'timestamp with time zone',
    comment: 'Last update timestamp for audit trail'
  })
  updatedAt: Date;

  /**
   * Verification timestamp when document status changes to VERIFIED
   * Used for compliance and audit purposes
   */
  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    comment: 'Timestamp of document verification'
  })
  verifiedAt: Date;

  /**
   * ID of the user who verified the document
   * Required for audit trail when document is verified
   */
  @Column('uuid', {
    nullable: true,
    comment: 'User ID of document verifier'
  })
  verifiedBy: string;

  /**
   * Optional notes from document verification process
   * Used for tracking verification decisions
   */
  @Column({
    type: 'text',
    nullable: true,
    comment: 'Notes from document verification process'
  })
  verificationNotes: string;

  /**
   * Document expiration date if applicable
   * Used for managing document lifecycle
   */
  @Column({
    type: 'timestamp with time zone',
    nullable: true,
    comment: 'Document expiration date if applicable'
  })
  expiresAt: Date;
}