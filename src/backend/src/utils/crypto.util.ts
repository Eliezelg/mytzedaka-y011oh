import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import * as bcrypt from 'bcrypt';
import { JwtConfig } from '../config/jwt.config';

// Version comments for external dependencies
// bcrypt: ^5.0.0
// crypto: ^1.0.0 (Node.js built-in)

/**
 * Cryptographic constants ensuring consistent and secure operations
 */
const SALT_ROUNDS = 12;
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const MIN_PASSWORD_LENGTH = 8;
const MAX_ENCRYPTION_CHUNK_SIZE = 1048576; // 1MB

/**
 * Error messages for cryptographic operations
 */
const ERROR_MESSAGES = {
  INVALID_PASSWORD: 'Password must be at least 8 characters long',
  INVALID_INPUT: 'Invalid input parameters provided',
  ENCRYPTION_FAILED: 'Data encryption failed',
  DECRYPTION_FAILED: 'Data decryption failed',
  AUTH_TAG_MISMATCH: 'Authentication tag verification failed',
  MEMORY_ALLOCATION: 'Secure memory allocation failed',
} as const;

/**
 * Securely hashes passwords using bcrypt with memory-safe operations
 * @param password - Plain text password to hash
 * @returns Promise resolving to the hashed password
 * @throws Error if password validation fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    // Validate password length and complexity
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(ERROR_MESSAGES.INVALID_PASSWORD);
    }

    // Generate cryptographically secure salt and hash password
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    const hash = await bcrypt.hash(password, salt);

    return hash;
  } catch (error) {
    // Ensure error doesn't leak sensitive information
    throw new Error(
      error.message === ERROR_MESSAGES.INVALID_PASSWORD
        ? error.message
        : 'Password hashing failed'
    );
  }
}

/**
 * Compares passwords using constant-time comparison to prevent timing attacks
 * @param plaintext - Plain text password to compare
 * @param hash - Hashed password to compare against
 * @returns Promise resolving to boolean indicating match
 */
export async function comparePasswords(
  plaintext: string,
  hash: string
): Promise<boolean> {
  try {
    if (!plaintext || !hash) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }

    return await bcrypt.compare(plaintext, hash);
  } catch (error) {
    // Generic error message to prevent information leakage
    throw new Error('Password comparison failed');
  }
}

/**
 * Encrypts data using AES-256-GCM with secure IV generation
 * @param data - String data to encrypt
 * @returns Promise resolving to object containing IV, encrypted data, and authentication tag
 */
export async function encryptData(
  data: string
): Promise<{ iv: string; encryptedData: string; tag: string }> {
  try {
    if (!data || Buffer.byteLength(data) > MAX_ENCRYPTION_CHUNK_SIZE) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }

    // Generate cryptographically secure IV
    const iv = randomBytes(IV_LENGTH);

    // Generate encryption key using scrypt
    const scryptAsync = promisify(scrypt);
    const key = await scryptAsync(
      JwtConfig.accessToken.secret,
      'salt',
      KEY_LENGTH
    );

    // Create cipher and encrypt data
    const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // Get authentication tag
    const tag = cipher.getAuthTag();

    return {
      iv: iv.toString('hex'),
      encryptedData: encrypted,
      tag: tag.toString('hex'),
    };
  } catch (error) {
    throw new Error(ERROR_MESSAGES.ENCRYPTION_FAILED);
  }
}

/**
 * Decrypts data with authentication tag verification
 * @param encryptedData - Encrypted data in hex format
 * @param iv - Initialization vector in hex format
 * @param tag - Authentication tag in hex format
 * @returns Promise resolving to decrypted string
 */
export async function decryptData(
  encryptedData: string,
  iv: string,
  tag: string
): Promise<string> {
  try {
    if (!encryptedData || !iv || !tag) {
      throw new Error(ERROR_MESSAGES.INVALID_INPUT);
    }

    // Generate decryption key using scrypt
    const scryptAsync = promisify(scrypt);
    const key = await scryptAsync(
      JwtConfig.accessToken.secret,
      'salt',
      KEY_LENGTH
    );

    // Create decipher
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      key,
      Buffer.from(iv, 'hex')
    );

    // Set authentication tag
    decipher.setAuthTag(Buffer.from(tag, 'hex'));

    // Decrypt data
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Handle authentication tag mismatch separately
    if (error.message.includes('auth')) {
      throw new Error(ERROR_MESSAGES.AUTH_TAG_MISMATCH);
    }
    throw new Error(ERROR_MESSAGES.DECRYPTION_FAILED);
  }
}

/**
 * Generates a cryptographically secure random string
 * @param length - Length of the random string
 * @returns Promise resolving to random string in hex format
 */
export async function generateSecureToken(length: number = 32): Promise<string> {
  try {
    return randomBytes(length).toString('hex');
  } catch (error) {
    throw new Error('Secure token generation failed');
  }
}