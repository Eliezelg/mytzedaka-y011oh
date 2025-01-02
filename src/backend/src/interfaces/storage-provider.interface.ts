/**
 * @fileoverview Storage Provider Interface Definition
 * Defines comprehensive interfaces for secure document storage operations
 * with support for encryption, access controls, and compliance features.
 * @version 1.0.0
 */

import { Buffer } from 'buffer'; // Node.js Buffer type for file data handling

/**
 * Comprehensive metadata structure for stored files including security
 * and audit information
 */
export interface StorageFileMetadata {
  /** Original filename with extension */
  fileName: string;
  
  /** MIME type of the file content */
  mimeType: string;
  
  /** File content encoding (e.g., 'utf-8', 'base64') */
  encoding: string;
  
  /** File size in bytes */
  size: number;
  
  /** SHA-256 checksum of file content */
  checksum: string;
  
  /** Timestamp of initial file upload */
  uploadedAt: Date;
  
  /** Timestamp of last file access */
  lastAccessed: Date;
  
  /** Indicates if the file is stored with encryption */
  encryptionStatus: boolean;
}

/**
 * Comprehensive options for file upload operations including
 * security and compliance features
 */
export interface StorageUploadOptions {
  /** Enable/disable file encryption */
  encrypt: boolean;
  
  /** Access control level for the file */
  acl: string;
  
  /** MIME type override for the file */
  contentType: string;
  
  /** Retention period in days (0 for indefinite) */
  retentionPeriod: number;
  
  /** Custom encryption key (optional) */
  encryptionKey?: string;
  
  /** Custom metadata key-value pairs */
  metadata: Record<string, string>;
  
  /** Custom tags for file organization */
  tags: Record<string, string>;
}

/**
 * Comprehensive interface for secure storage operations with
 * advanced security and compliance features
 */
export interface StorageProviderInterface {
  /**
   * Uploads a file to the storage provider with encryption and validation
   * @param fileBuffer - File content as Buffer
   * @param metadata - File metadata
   * @param options - Upload configuration options
   * @returns Promise resolving to file identifier or URL
   * @throws StorageError on upload failure
   */
  uploadFile(
    fileBuffer: Buffer,
    metadata: StorageFileMetadata,
    options: StorageUploadOptions
  ): Promise<string>;

  /**
   * Downloads a file from the storage provider with optional decryption
   * @param fileId - Unique identifier of the file
   * @param validateChecksum - Enable checksum validation
   * @returns Promise resolving to file content as Buffer
   * @throws StorageError on download failure or validation error
   */
  downloadFile(
    fileId: string,
    validateChecksum: boolean
  ): Promise<Buffer>;

  /**
   * Securely deletes a file from the storage provider
   * @param fileId - Unique identifier of the file
   * @returns Promise resolving on successful deletion
   * @throws StorageError on deletion failure
   */
  deleteFile(fileId: string): Promise<void>;

  /**
   * Generates a secure time-limited signed URL for file access
   * @param fileId - Unique identifier of the file
   * @param expirationTime - URL expiration time in seconds
   * @param customHeaders - Custom headers for the signed URL
   * @returns Promise resolving to signed URL
   * @throws StorageError on URL generation failure
   */
  getSignedUrl(
    fileId: string,
    expirationTime: number,
    customHeaders?: Record<string, string>
  ): Promise<string>;

  /**
   * Lists files in the storage provider with filtering
   * @param prefix - Optional prefix for filtering files
   * @param maxResults - Maximum number of results to return
   * @returns Promise resolving to array of file metadata
   * @throws StorageError on listing failure
   */
  listFiles(
    prefix?: string,
    maxResults?: number
  ): Promise<StorageFileMetadata[]>;

  /**
   * Retrieves metadata for a specific file
   * @param fileId - Unique identifier of the file
   * @returns Promise resolving to file metadata
   * @throws StorageError on metadata retrieval failure
   */
  getMetadata(fileId: string): Promise<StorageFileMetadata>;
}