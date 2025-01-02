/**
 * @fileoverview Advanced File Utility Functions
 * Provides comprehensive file operations with security, validation and international support
 * @version 1.0.0
 */

import { StorageFileMetadata } from '../interfaces/storage-provider.interface';
import * as path from 'path'; // Version: Node built-in
import * as mime from 'mime-types'; // Version: ^2.1.35
import * as crypto from 'crypto'; // Version: Node built-in

// Configuration constants
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const MIN_FILE_SIZE = 1; // 1 byte
const MAX_FILENAME_LENGTH = 255;
const CHUNK_SIZE = 64 * 1024; // 64KB chunks for streaming
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

const DANGEROUS_PATTERNS = /[\\/:"*?<>|]/g;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;

/**
 * Validates file metadata against security policies and business rules
 * @param metadata - File metadata to validate
 * @returns Promise resolving to validation result
 */
export async function validateFileMetadata(
  metadata: StorageFileMetadata
): Promise<boolean> {
  try {
    // Validate file size
    if (!metadata.size || 
        metadata.size < MIN_FILE_SIZE || 
        metadata.size > MAX_FILE_SIZE) {
      return false;
    }

    // Validate filename
    if (!metadata.fileName || 
        metadata.fileName.length > MAX_FILENAME_LENGTH || 
        DANGEROUS_PATTERNS.test(metadata.fileName) || 
        CONTROL_CHARS.test(metadata.fileName)) {
      return false;
    }

    // Validate MIME type
    if (!metadata.mimeType || 
        !ALLOWED_MIME_TYPES.has(metadata.mimeType.toLowerCase())) {
      return false;
    }

    // Validate encoding
    if (!metadata.encoding || 
        !['utf-8', 'ascii', 'base64', 'binary'].includes(metadata.encoding)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('File metadata validation error:', error);
    return false;
  }
}

/**
 * Extracts and validates comprehensive metadata from file buffer
 * @param fileBuffer - File content buffer
 * @param fileName - Original file name
 * @returns Promise resolving to validated file metadata
 */
export async function extractFileMetadata(
  fileBuffer: Buffer,
  fileName: string
): Promise<StorageFileMetadata> {
  try {
    const sanitizedName = await sanitizeFileName(fileName);
    const mimeType = mime.lookup(sanitizedName) || 'application/octet-stream';
    const hash = await generateFileHash(fileBuffer);

    const metadata: StorageFileMetadata = {
      fileName: sanitizedName,
      mimeType: mimeType,
      encoding: 'binary',
      size: fileBuffer.length,
      checksum: hash,
      uploadedAt: new Date(),
      lastAccessed: new Date(),
      encryptionStatus: false
    };

    if (!await validateFileMetadata(metadata)) {
      throw new Error('Invalid file metadata');
    }

    return metadata;
  } catch (error) {
    console.error('Metadata extraction error:', error);
    throw error;
  }
}

/**
 * Generates cryptographically secure hash for file content
 * @param fileBuffer - File content buffer
 * @returns Promise resolving to SHA-256 hash
 */
export async function generateFileHash(fileBuffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const hash = crypto.createHash('sha256');
      
      // Process large files in chunks
      let offset = 0;
      while (offset < fileBuffer.length) {
        const chunk = fileBuffer.slice(offset, offset + CHUNK_SIZE);
        hash.update(chunk);
        offset += CHUNK_SIZE;
      }

      resolve(hash.digest('hex'));
    } catch (error) {
      console.error('Hash generation error:', error);
      reject(error);
    }
  });
}

/**
 * Sanitizes file names with support for international characters
 * @param fileName - Original file name
 * @returns Promise resolving to sanitized file name
 */
export async function sanitizeFileName(fileName: string): Promise<string> {
  try {
    // Normalize Unicode characters
    let sanitized = fileName.normalize('NFKC');

    // Remove dangerous characters and patterns
    sanitized = sanitized.replace(DANGEROUS_PATTERNS, '_');
    sanitized = sanitized.replace(CONTROL_CHARS, '_');

    // Ensure file extension is preserved
    const ext = path.extname(sanitized);
    const base = path.basename(sanitized, ext);
    
    // Truncate base name if needed while preserving extension
    const maxBaseLength = MAX_FILENAME_LENGTH - ext.length;
    const truncatedBase = base.slice(0, maxBaseLength);

    // Add entropy to prevent collisions
    const timestamp = Date.now().toString(36);
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    
    return `${truncatedBase}_${timestamp}_${randomSuffix}${ext}`.toLowerCase();
  } catch (error) {
    console.error('File name sanitization error:', error);
    throw error;
  }
}

/**
 * Performs comprehensive file type validation with content verification
 * @param mimeType - MIME type to validate
 * @param fileContent - File content buffer for verification
 * @returns Promise resolving to validation result
 */
export async function isAllowedFileType(
  mimeType: string,
  fileContent: Buffer
): Promise<boolean> {
  try {
    // Basic MIME type validation
    if (!ALLOWED_MIME_TYPES.has(mimeType.toLowerCase())) {
      return false;
    }

    // Validate file signatures/magic numbers
    const fileSignature = fileContent.slice(0, 4).toString('hex');
    
    // Map of file signatures for common file types
    const signatures: Record<string, string[]> = {
      'application/pdf': ['25504446'],
      'image/jpeg': ['ffd8ffe0', 'ffd8ffe1', 'ffd8ffe2'],
      'image/png': ['89504e47'],
      'image/heic': ['00000020'],
    };

    // Check if file content matches declared MIME type
    const expectedSignatures = signatures[mimeType];
    if (expectedSignatures && !expectedSignatures.includes(fileSignature)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('File type validation error:', error);
    return false;
  }
}