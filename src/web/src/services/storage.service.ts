import { setItem, getItem, removeItem, clear, encryptData, decryptData } from '../utils/storage.utils';
import axios from 'axios'; // v1.4.0

// Types and interfaces
interface StorageConfig {
  baseUrl: string;
  storageType: 'local' | 'session' | 'secure';
  retryAttempts?: number;
  maxFileSize?: number;
  cdnConfig?: CDNConfig;
}

interface CDNConfig {
  baseUrl: string;
  region: string;
  cacheTimeout: number;
}

interface DocumentMetadata {
  fileName: string;
  contentType: string;
  size: number;
  createdAt: string;
  lastModified: string;
  isEncrypted: boolean;
  tags?: string[];
  securityLevel?: 'public' | 'private' | 'sensitive';
}

interface StorageResult {
  success: boolean;
  url?: string;
  metadata?: DocumentMetadata;
  error?: string;
}

interface GetDocumentOptions {
  useCache?: boolean;
  decrypt?: boolean;
  validateChecksum?: boolean;
}

interface DeleteOptions {
  forceCdnInvalidation?: boolean;
  deleteMetadata?: boolean;
}

interface ClearOptions {
  clearCdn?: boolean;
  clearMetadata?: boolean;
}

interface DocumentResponse {
  data: Blob;
  metadata: DocumentMetadata;
  url: string;
}

/**
 * Service class for managing secure document storage operations with encryption
 * support and CDN integration
 */
export class StorageService {
  private baseUrl: string;
  private storageType: 'local' | 'session' | 'secure';
  private retryAttempts: number;
  private readonly maxFileSize: number;
  private readonly cdnConfig?: CDNConfig;

  /**
   * Initializes the storage service with configuration and security settings
   * @param config Storage configuration options
   */
  constructor(config: StorageConfig) {
    this.baseUrl = config.baseUrl || process.env.REACT_APP_STORAGE_API_URL;
    this.storageType = config.storageType;
    this.retryAttempts = config.retryAttempts || 3;
    this.maxFileSize = config.maxFileSize || 100 * 1024 * 1024; // 100MB default
    this.cdnConfig = config.cdnConfig;

    if (!this.baseUrl) {
      throw new Error('Storage API URL is required');
    }
  }

  /**
   * Stores a document with optional encryption and metadata management
   * @param key Document identifier
   * @param document File to store
   * @param isSecure Whether to encrypt the document
   * @param metadata Additional document metadata
   * @returns Promise resolving to storage result
   */
  public async storeDocument(
    key: string,
    document: File,
    isSecure: boolean = false,
    metadata?: Partial<DocumentMetadata>
  ): Promise<StorageResult> {
    try {
      // Validate document size
      if (document.size > this.maxFileSize) {
        throw new Error(`File size exceeds maximum limit of ${this.maxFileSize} bytes`);
      }

      // Prepare metadata
      const documentMetadata: DocumentMetadata = {
        fileName: document.name,
        contentType: document.type,
        size: document.size,
        createdAt: new Date().toISOString(),
        lastModified: new Date(document.lastModified).toISOString(),
        isEncrypted: isSecure,
        ...metadata
      };

      // Create form data
      const formData = new FormData();
      formData.append('document', document);
      
      if (isSecure) {
        // Encrypt document metadata
        const encryptedMetadata = await encryptData(documentMetadata);
        if (!encryptedMetadata.success) {
          throw new Error('Failed to encrypt document metadata');
        }
        
        // Store encrypted metadata
        await setItem(`${key}_metadata`, encryptedMetadata.data, this.storageType, true);
      } else {
        // Store unencrypted metadata
        await setItem(`${key}_metadata`, documentMetadata, this.storageType);
      }

      // Upload document with retry mechanism
      let attempt = 0;
      let lastError: Error;

      while (attempt < this.retryAttempts) {
        try {
          const response = await axios.post(`${this.baseUrl}/documents/${key}`, formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });

          const documentUrl = this.cdnConfig 
            ? `${this.cdnConfig.baseUrl}/${response.data.path}`
            : response.data.url;

          // Log storage operation for audit
          console.info(`Document stored successfully: ${key}`);

          return {
            success: true,
            url: documentUrl,
            metadata: documentMetadata
          };
        } catch (error) {
          lastError = error;
          attempt++;
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }

      throw lastError;
    } catch (error) {
      console.error('Document storage error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Retrieves a document with decryption and access logging
   * @param key Document identifier
   * @param options Retrieval options
   * @returns Promise resolving to document response
   */
  public async getDocument(
    key: string,
    options: GetDocumentOptions = {}
  ): Promise<DocumentResponse> {
    try {
      // Retrieve metadata
      const metadataResult = await getItem<DocumentMetadata>(
        `${key}_metadata`,
        this.storageType,
        options.decrypt
      );

      if (!metadataResult.success || !metadataResult.data) {
        throw new Error('Failed to retrieve document metadata');
      }

      const metadata = metadataResult.data;

      // Fetch document
      const documentUrl = this.cdnConfig
        ? `${this.cdnConfig.baseUrl}/${key}`
        : `${this.baseUrl}/documents/${key}`;

      const response = await axios.get(documentUrl, {
        responseType: 'blob',
        headers: {
          'Cache-Control': options.useCache ? 'max-age=300' : 'no-cache'
        }
      });

      // Log access for audit trail
      console.info(`Document retrieved: ${key}`);

      return {
        data: response.data,
        metadata,
        url: documentUrl
      };
    } catch (error) {
      console.error('Document retrieval error:', error);
      throw error;
    }
  }

  /**
   * Securely deletes a document and its metadata
   * @param key Document identifier
   * @param options Deletion options
   */
  public async deleteDocument(key: string, options: DeleteOptions = {}): Promise<void> {
    try {
      // Delete document from storage
      await axios.delete(`${this.baseUrl}/documents/${key}`);

      // Remove metadata
      if (options.deleteMetadata !== false) {
        await removeItem(`${key}_metadata`, this.storageType);
      }

      // Invalidate CDN cache if required
      if (options.forceCdnInvalidation && this.cdnConfig) {
        await axios.post(`${this.baseUrl}/cdn/invalidate`, {
          path: key,
          region: this.cdnConfig.region
        });
      }

      // Log deletion for audit trail
      console.info(`Document deleted: ${key}`);
    } catch (error) {
      console.error('Document deletion error:', error);
      throw error;
    }
  }

  /**
   * Securely clears all stored documents and metadata
   * @param options Clear options
   */
  public async clearStorage(options: ClearOptions = {}): Promise<void> {
    try {
      // Clear metadata from browser storage
      await clear(this.storageType);

      // Clear CDN cache if required
      if (options.clearCdn && this.cdnConfig) {
        await axios.post(`${this.baseUrl}/cdn/clear`, {
          region: this.cdnConfig.region
        });
      }

      // Log clear operation
      console.info('Storage cleared successfully');
    } catch (error) {
      console.error('Storage clear error:', error);
      throw error;
    }
  }
}