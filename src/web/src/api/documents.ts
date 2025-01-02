/**
 * @fileoverview Document management API module for secure handling of various document types
 * @version 1.0.0
 */

import apiClient from './apiClient';
import ClamAV from '@djadmin/clamav'; // ^1.0.0
import * as CryptoJS from 'crypto-js'; // ^4.1.1

// Document type and size constraints
const ALLOWED_DOCUMENT_TYPES = ['pdf', 'doc', 'docx', 'jpg', 'png'] as const;
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024; // 10MB
const DOCUMENT_RETENTION_PERIOD = 7 * 365 * 24 * 60 * 60 * 1000; // 7 years in milliseconds

// Initialize virus scanner
const virusScanner = new ClamAV({
  removeInfected: true,
  quarantineInfected: true,
  scanLog: true,
  debugMode: false,
});

/**
 * Document metadata interface
 */
interface DocumentMetadata {
  type: typeof ALLOWED_DOCUMENT_TYPES[number];
  category: 'TAX_RECEIPT' | 'ASSOCIATION_DOC' | 'CAMPAIGN_MEDIA' | 'TEMPLATE';
  description: string;
  tags?: string[];
  expiryDate?: Date;
  retentionPeriod?: number;
}

/**
 * Upload options interface
 */
interface UploadOptions {
  encrypt?: boolean;
  compress?: boolean;
  immediate?: boolean;
  accessLevel?: 'PUBLIC' | 'PRIVATE' | 'RESTRICTED';
}

/**
 * Document response interface
 */
interface DocumentResponse {
  id: string;
  url: string;
  metadata: DocumentMetadata;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  status: 'ACTIVE' | 'ARCHIVED' | 'DELETED';
  accessControl: {
    allowedUsers: string[];
    allowedRoles: string[];
  };
}

/**
 * Search criteria interface
 */
interface SearchCriteria {
  type?: typeof ALLOWED_DOCUMENT_TYPES[number];
  category?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: string;
}

/**
 * Validates document metadata
 */
const validateMetadata = (metadata: DocumentMetadata): boolean => {
  if (!ALLOWED_DOCUMENT_TYPES.includes(metadata.type)) {
    throw new Error('Invalid document type');
  }
  if (metadata.retentionPeriod && metadata.retentionPeriod > DOCUMENT_RETENTION_PERIOD) {
    throw new Error('Retention period exceeds maximum allowed');
  }
  return true;
};

/**
 * Encrypts document content
 */
const encryptDocument = (content: ArrayBuffer): string => {
  const wordArray = CryptoJS.lib.WordArray.create(content);
  return CryptoJS.AES.encrypt(wordArray, process.env.REACT_APP_DOCUMENT_ENCRYPTION_KEY!).toString();
};

/**
 * Uploads a document with security checks and processing
 */
export const uploadDocument = async (
  formData: FormData,
  metadata: DocumentMetadata,
  options: UploadOptions = {}
): Promise<DocumentResponse> => {
  try {
    // Validate metadata
    validateMetadata(metadata);

    // Check file size
    const file = formData.get('file') as File;
    if (file.size > MAX_DOCUMENT_SIZE) {
      throw new Error('File size exceeds maximum allowed');
    }

    // Scan for viruses
    const scanResult = await virusScanner.scanFile(file);
    if (!scanResult.isClean) {
      throw new Error('File failed security scan');
    }

    // Encrypt if requested
    if (options.encrypt) {
      const buffer = await file.arrayBuffer();
      const encrypted = encryptDocument(buffer);
      formData.set('file', new Blob([encrypted]), file.name);
    }

    // Add metadata to form data
    formData.append('metadata', JSON.stringify(metadata));
    formData.append('options', JSON.stringify(options));

    const response = await apiClient.post<DocumentResponse>('/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (error) {
    throw new Error(`Document upload failed: ${error.message}`);
  }
};

/**
 * Retrieves a document with access control
 */
export const getDocument = async (
  documentId: string,
  options: { generateUrl?: boolean; expiryMinutes?: number } = {}
): Promise<DocumentResponse> => {
  try {
    const response = await apiClient.get<DocumentResponse>(`/documents/${documentId}`, {
      params: options,
    });
    return response.data;
  } catch (error) {
    throw new Error(`Document retrieval failed: ${error.message}`);
  }
};

/**
 * Searches documents with filtering
 */
export const searchDocuments = async (
  criteria: SearchCriteria,
  options: { page?: number; limit?: number; sort?: string } = {}
): Promise<{ documents: DocumentResponse[]; total: number; page: number }> => {
  try {
    const response = await apiClient.get('/documents/search', {
      params: {
        ...criteria,
        ...options,
      },
    });
    return response.data;
  } catch (error) {
    throw new Error(`Document search failed: ${error.message}`);
  }
};

/**
 * Updates document with versioning
 */
export const updateDocument = async (
  documentId: string,
  updateData: Partial<DocumentMetadata>,
  options: { createVersion?: boolean } = {}
): Promise<DocumentResponse> => {
  try {
    const response = await apiClient.put<DocumentResponse>(`/documents/${documentId}`, {
      updateData,
      options,
    });
    return response.data;
  } catch (error) {
    throw new Error(`Document update failed: ${error.message}`);
  }
};

/**
 * Archives document with retention policy
 */
export const archiveDocument = async (
  documentId: string,
  options: { retentionPeriod?: number } = {}
): Promise<{ success: boolean; archiveId: string }> => {
  try {
    const response = await apiClient.post(`/documents/${documentId}/archive`, {
      retentionPeriod: options.retentionPeriod || DOCUMENT_RETENTION_PERIOD,
    });
    return response.data;
  } catch (error) {
    throw new Error(`Document archival failed: ${error.message}`);
  }
};

export type {
  DocumentMetadata,
  DocumentResponse,
  SearchCriteria,
  UploadOptions,
};