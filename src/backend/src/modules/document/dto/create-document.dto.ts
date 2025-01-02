/**
 * @fileoverview Data Transfer Object for document creation with comprehensive validation rules
 * ensuring data integrity, security, and compliance requirements for the document management system.
 * @version 1.0.0
 */

import { IsString, IsEnum, IsUUID, IsOptional, ValidateNested } from 'class-validator'; // v0.14.0
import { Type } from 'class-transformer'; // v0.5.0
import { StorageFileMetadata } from '../../../interfaces/storage-provider.interface';

/**
 * Enum defining valid document types in the system
 */
export enum DocumentType {
  TAX_RECEIPT = 'TAX_RECEIPT',
  ASSOCIATION_DOCUMENT = 'ASSOCIATION_DOCUMENT',
  FINANCIAL_REPORT = 'FINANCIAL_REPORT'
}

/**
 * Data Transfer Object for creating new documents in the system.
 * Implements comprehensive validation rules for document metadata,
 * type classification, and association relationships.
 */
export class CreateDocumentDto {
  /**
   * Type of document being created.
   * Must be one of the predefined document types to ensure proper
   * handling and compliance requirements.
   */
  @IsEnum(DocumentType)
  @IsString()
  type: DocumentType;

  /**
   * Comprehensive metadata about the document file including
   * name, MIME type, size, and storage path.
   * Validated using nested validation rules from StorageFileMetadata.
   */
  @ValidateNested()
  @Type(() => StorageFileMetadata)
  metadata: StorageFileMetadata;

  /**
   * Optional description of the document providing additional context.
   * Can be used for search and organization purposes.
   */
  @IsOptional()
  @IsString()
  description?: string;

  /**
   * UUID of the association this document belongs to.
   * Ensures proper access control and organization of documents
   * within the system.
   */
  @IsUUID()
  associationId: string;
}