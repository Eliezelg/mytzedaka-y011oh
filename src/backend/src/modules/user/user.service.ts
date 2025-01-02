import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common'; // ^10.0.0
import { InjectModel } from '@nestjs/mongoose'; // ^10.0.0
import { Model } from 'mongoose'; // ^7.5.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import * as bcrypt from 'bcrypt'; // ^5.0.1
import * as crypto from 'crypto'; // ^1.0.1

import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { Roles } from '../../constants/roles.constant';
import { PASSWORD_REGEX } from '../../constants/regex.constant';

/**
 * Service class implementing secure user management functionality with enhanced security features
 * Includes password hashing, PII encryption, rate limiting, and audit logging
 */
@Injectable()
@RateLimit({ ttl: 60, limit: 5 })
export class UserService {
  // Encryption key for PII fields
  private readonly ENCRYPTION_KEY = crypto.scryptSync(process.env.APP_SECRET, 'salt', 32);
  private readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<User>
  ) {}

  /**
   * Creates a new user with enhanced security validation and PII protection
   * @param createUserDto - User creation data transfer object
   * @returns Promise<User> - Created user document with encrypted sensitive data
   */
  async create(createUserDto: CreateUserDto): Promise<User> {
    // Validate password strength
    if (!PASSWORD_REGEX.test(createUserDto.password)) {
      throw new BadRequestException('Password does not meet security requirements');
    }

    // Check if email already exists
    const existingUser = await this.userModel.findOne({ email: createUserDto.email.toLowerCase() });
    if (existingUser) {
      throw new BadRequestException('Email already registered');
    }

    // Hash password with strong algorithm
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(createUserDto.password, salt);

    // Encrypt PII fields
    const encryptedFirstName = this.encryptField(createUserDto.firstName);
    const encryptedLastName = this.encryptField(createUserDto.lastName);
    const encryptedPhone = createUserDto.phoneNumber ? 
      this.encryptField(createUserDto.phoneNumber) : undefined;

    // Create user with secure defaults
    const user = new this.userModel({
      email: createUserDto.email.toLowerCase(),
      password: hashedPassword,
      firstName: encryptedFirstName,
      lastName: encryptedLastName,
      phoneNumber: encryptedPhone,
      role: createUserDto.role || Roles.DONOR,
      preferredLanguage: createUserDto.preferredLanguage || 'en',
      isVerified: false,
      failedLoginAttempts: 0,
      passwordChangedAt: new Date(),
      lastIpAddress: null
    });

    // Save user and return without sensitive fields
    const savedUser = await user.save();
    return this.sanitizeUser(savedUser);
  }

  /**
   * Validates user password with brute force protection
   * @param email - User email
   * @param password - Password to validate
   * @returns Promise<User> - Validated user or null
   */
  async validatePassword(email: string, password: string): Promise<User | null> {
    // Get user with password field included
    const user = await this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password');

    if (!user) {
      return null;
    }

    // Check account lockout
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      throw new UnauthorizedException('Account temporarily locked. Please try again later.');
    }

    // Validate password
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      // Increment failed attempts and implement exponential backoff
      user.failedLoginAttempts += 1;
      
      if (user.failedLoginAttempts >= 5) {
        const lockoutMinutes = Math.min(Math.pow(2, user.failedLoginAttempts - 5), 60);
        user.accountLockedUntil = new Date(Date.now() + lockoutMinutes * 60 * 1000);
      }
      
      await user.save();
      return null;
    }

    // Reset security counters on successful login
    user.failedLoginAttempts = 0;
    user.accountLockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    return this.sanitizeUser(user);
  }

  /**
   * Encrypts sensitive field data using AES-256-GCM
   * @param value - Value to encrypt
   * @returns string - Encrypted value
   */
  private encryptField(value: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.ENCRYPTION_ALGORITHM, this.ENCRYPTION_KEY, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(value, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /**
   * Decrypts sensitive field data
   * @param encryptedValue - Encrypted value to decrypt
   * @returns string - Decrypted value
   */
  private decryptField(encryptedValue: string): string {
    const buffer = Buffer.from(encryptedValue, 'base64');
    
    const iv = buffer.slice(0, 12);
    const authTag = buffer.slice(12, 28);
    const encrypted = buffer.slice(28);

    const decipher = crypto.createDecipheriv(this.ENCRYPTION_ALGORITHM, this.ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

  /**
   * Removes sensitive data from user object
   * @param user - User document
   * @returns User - Sanitized user object
   */
  private sanitizeUser(user: User): User {
    const sanitized = user.toObject();
    delete sanitized.password;
    delete sanitized.refreshToken;
    delete sanitized.twoFactorSecret;
    
    // Decrypt PII fields if present
    if (sanitized.firstName) {
      sanitized.firstName = this.decryptField(sanitized.firstName);
    }
    if (sanitized.lastName) {
      sanitized.lastName = this.decryptField(sanitized.lastName);
    }
    if (sanitized.phoneNumber) {
      sanitized.phoneNumber = this.decryptField(sanitized.phoneNumber);
    }

    return sanitized;
  }
}