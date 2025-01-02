// @ts-nocheck
import CryptoJS from 'crypto-js'; // v4.1.1 - Industry-standard encryption library
import * as pako from 'pako'; // v2.1.0 - Data compression library

// Constants
const STORAGE_PREFIX = 'ijap_';
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY;
const CACHE_DURATION = 300000; // 5 minutes in milliseconds
const MAX_STORAGE_SIZE = 5242880; // 5MB in bytes

// Types
type StorageType = 'local' | 'session' | 'secure';
type Result<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

// Cache implementation
const storageCache = new Map<string, { value: any; timestamp: number }>();

// Storage type implementations
const storageImplementations = {
  local: localStorage,
  session: sessionStorage,
  secure: localStorage // Secure storage uses localStorage with encryption
};

/**
 * Namespace containing utility functions for browser storage operations
 */
export namespace StorageUtils {
  /**
   * Stores data in browser storage with optional encryption and compression
   * @param key Storage key
   * @param value Data to store
   * @param type Storage type (local, session, secure)
   * @param encrypt Whether to encrypt the data
   * @returns Result indicating success or failure
   */
  export async function setItem<T>(
    key: string,
    value: T,
    type: StorageType,
    encrypt: boolean = type === 'secure'
  ): Promise<Result<void>> {
    try {
      // Validate inputs
      if (!key || !storageImplementations[type]) {
        throw new Error('Invalid storage parameters');
      }

      let processedValue = JSON.stringify(value);
      const prefixedKey = `${STORAGE_PREFIX}${key}`;

      // Check storage quota
      if (processedValue.length > MAX_STORAGE_SIZE) {
        // Compress data if too large
        const compressed = pako.deflate(processedValue);
        processedValue = String.fromCharCode.apply(null, compressed);
      }

      // Encrypt if required
      if (encrypt) {
        const encryptResult = await encryptData(processedValue);
        if (!encryptResult.success) {
          throw new Error(encryptResult.error);
        }
        processedValue = encryptResult.data;
      }

      // Store data
      storageImplementations[type].setItem(prefixedKey, processedValue);

      // Update cache
      storageCache.set(prefixedKey, {
        value: value,
        timestamp: Date.now()
      });

      return { success: true };
    } catch (error) {
      console.error('Storage setItem error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Retrieves data from browser storage with optional decryption
   * @param key Storage key
   * @param type Storage type (local, session, secure)
   * @param encrypted Whether the data is encrypted
   * @returns Result containing retrieved value or error
   */
  export async function getItem<T>(
    key: string,
    type: StorageType,
    encrypted: boolean = type === 'secure'
  ): Promise<Result<T | null>> {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;

      // Check cache first
      const cached = storageCache.get(prefixedKey);
      if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return { success: true, data: cached.value };
      }

      // Retrieve from storage
      const value = storageImplementations[type].getItem(prefixedKey);
      if (!value) {
        return { success: true, data: null };
      }

      let processedValue = value;

      // Decrypt if encrypted
      if (encrypted) {
        const decryptResult = await decryptData<T>(processedValue);
        if (!decryptResult.success) {
          throw new Error(decryptResult.error);
        }
        processedValue = decryptResult.data;
      }

      // Decompress if compressed
      try {
        const charData = processedValue.split('').map(x => x.charCodeAt(0));
        const decompressed = pako.inflate(new Uint8Array(charData));
        processedValue = new TextDecoder().decode(decompressed);
      } catch {
        // Data wasn't compressed, continue with normal processing
      }

      // Parse JSON
      const parsed = JSON.parse(processedValue);

      // Update cache
      storageCache.set(prefixedKey, {
        value: parsed,
        timestamp: Date.now()
      });

      return { success: true, data: parsed };
    } catch (error) {
      console.error('Storage getItem error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Removes item from browser storage and cache
   * @param key Storage key
   * @param type Storage type (local, session, secure)
   * @returns Result indicating success or failure
   */
  export function removeItem(
    key: string,
    type: StorageType
  ): Result<void> {
    try {
      const prefixedKey = `${STORAGE_PREFIX}${key}`;
      storageImplementations[type].removeItem(prefixedKey);
      storageCache.delete(prefixedKey);
      
      console.info(`Storage item removed: ${prefixedKey}`);
      return { success: true };
    } catch (error) {
      console.error('Storage removeItem error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Clears all items with prefix from storage and cache
   * @param type Storage type (local, session, secure)
   * @returns Result indicating success or failure
   */
  export function clear(type: StorageType): Result<void> {
    try {
      const storage = storageImplementations[type];
      const keys = Object.keys(storage);
      
      keys.forEach(key => {
        if (key.startsWith(STORAGE_PREFIX)) {
          storage.removeItem(key);
          storageCache.delete(key);
        }
      });

      console.info(`Storage cleared for type: ${type}`);
      return { success: true };
    } catch (error) {
      console.error('Storage clear error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Encrypts data using AES-256-GCM encryption
   * @param data Data to encrypt
   * @returns Result containing encrypted string or error
   */
  export async function encryptData<T>(data: T): Promise<Result<string>> {
    try {
      if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not available');
      }

      // Generate random IV
      const iv = CryptoJS.lib.WordArray.random(16);
      const stringData = typeof data === 'string' ? data : JSON.stringify(data);

      // Encrypt data
      const encrypted = CryptoJS.AES.encrypt(stringData, ENCRYPTION_KEY, {
        iv: iv,
        mode: CryptoJS.mode.GCM,
        padding: CryptoJS.pad.Pkcs7
      });

      // Combine IV and encrypted data
      const combined = iv.concat(encrypted.ciphertext).toString(CryptoJS.enc.Base64);
      return { success: true, data: combined };
    } catch (error) {
      console.error('Encryption error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Decrypts encrypted data using AES-256-GCM decryption
   * @param encryptedData Encrypted data string
   * @returns Result containing decrypted data or error
   */
  export async function decryptData<T>(encryptedData: string): Promise<Result<T | null>> {
    try {
      if (!ENCRYPTION_KEY) {
        throw new Error('Encryption key not available');
      }

      // Decode combined string
      const combined = CryptoJS.enc.Base64.parse(encryptedData);
      
      // Extract IV and encrypted content
      const iv = CryptoJS.lib.WordArray.create(combined.words.slice(0, 4));
      const encrypted = CryptoJS.lib.WordArray.create(combined.words.slice(4));

      // Decrypt data
      const decrypted = CryptoJS.AES.decrypt(
        { ciphertext: encrypted },
        ENCRYPTION_KEY,
        {
          iv: iv,
          mode: CryptoJS.mode.GCM,
          padding: CryptoJS.pad.Pkcs7
        }
      );

      const decryptedStr = decrypted.toString(CryptoJS.enc.Utf8);
      
      // Parse JSON if possible
      try {
        return { success: true, data: JSON.parse(decryptedStr) };
      } catch {
        return { success: true, data: decryptedStr as unknown as T };
      }
    } catch (error) {
      console.error('Decryption error:', error);
      return { success: false, error: error.message };
    }
  }
}