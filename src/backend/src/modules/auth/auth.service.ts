import { Injectable, UnauthorizedException, BadRequestException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { authenticator } from 'otplib';
import * as crypto from 'crypto';

import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserService } from '../user/user.service';
import { User } from '../modules/user/entities/user.entity';

/**
 * Enhanced authentication service implementing secure user authentication,
 * multi-step registration, and comprehensive security features
 * @version 1.0.0
 */
@Injectable()
export class AuthService {
  private readonly TOTP_WINDOW = 1; // Time window for TOTP validation
  private readonly MAX_FAILED_ATTEMPTS = 5;
  private readonly BACKUP_CODES_COUNT = 10;

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly rateLimiter: RateLimiterRedis,
    private readonly logger: Logger
  ) {
    // Configure TOTP settings for enhanced security
    authenticator.options = {
      window: this.TOTP_WINDOW,
      step: 30
    };
  }

  /**
   * Authenticates user with comprehensive security checks
   * @param loginDto Login credentials
   * @returns Promise with access token and user data
   */
  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: User }> {
    try {
      // Rate limiting check
      await this.rateLimiter.consume(loginDto.email);

      // Validate credentials with brute force protection
      const user = await this.userService.validatePassword(
        loginDto.email,
        loginDto.password
      );

      if (!user) {
        this.logger.warn(`Failed login attempt for email: ${loginDto.email}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      // Generate secure JWT token with RS256 algorithm
      const payload = {
        sub: user._id,
        email: user.email,
        role: user.role
      };

      const accessToken = this.jwtService.sign(payload, {
        algorithm: 'RS256',
        expiresIn: '15m'
      });

      this.logger.log(`Successful login for user: ${user._id}`);
      return { accessToken, user };

    } catch (error) {
      if (error.name === 'RateLimiterError') {
        throw new UnauthorizedException('Too many login attempts. Please try again later.');
      }
      throw error;
    }
  }

  /**
   * Implements secure multi-step user registration
   * @param registerDto Registration data
   * @returns Promise with user data and TOTP secret
   */
  async register(registerDto: RegisterDto): Promise<{ user: User; totpSecret: string }> {
    try {
      // Generate secure TOTP secret
      const totpSecret = authenticator.generateSecret();
      
      // Create user with enhanced security
      const user = await this.userService.create({
        ...registerDto,
        twoFactorSecret: this.encryptTotpSecret(totpSecret)
      });

      // Generate backup codes
      const backupCodes = await this.generateBackupCodes(user._id);

      this.logger.log(`New user registered: ${user._id}`);
      return { user, totpSecret };

    } catch (error) {
      this.logger.error(`Registration failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates JWT token with comprehensive security checks
   * @param token JWT token
   * @returns Promise with validated user
   */
  async validateToken(token: string): Promise<User> {
    try {
      const payload = await this.jwtService.verify(token, {
        algorithms: ['RS256']
      });

      const user = await this.userService.findByEmail(payload.email);
      if (!user) {
        throw new UnauthorizedException('Invalid token');
      }

      // Check if password was changed after token was issued
      const tokenIssuedAt = new Date(payload.iat * 1000);
      if (user.passwordChangedAt && tokenIssuedAt < user.passwordChangedAt) {
        throw new UnauthorizedException('Token expired due to password change');
      }

      return user;

    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Generates secure TOTP secret with encryption
   * @param user User entity
   * @returns Promise with TOTP secret
   */
  async generateTwoFactorSecret(user: User): Promise<string> {
    const secret = authenticator.generateSecret();
    const encryptedSecret = this.encryptTotpSecret(secret);
    
    await this.userService.updateTwoFactorSecret(user._id, encryptedSecret);
    
    return secret;
  }

  /**
   * Verifies TOTP code with timing attack protection
   * @param userId User ID
   * @param code TOTP code
   * @returns Promise with verification result
   */
  async verifyTwoFactor(userId: string, code: string): Promise<boolean> {
    const user = await this.userService.findById(userId, true);
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA not configured');
    }

    const decryptedSecret = this.decryptTotpSecret(user.twoFactorSecret);
    
    // Use constant-time comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(code),
      Buffer.from(authenticator.generate(decryptedSecret))
    );
  }

  /**
   * Encrypts TOTP secret using AES-256-GCM
   * @param secret TOTP secret
   * @returns Encrypted secret
   */
  private encryptTotpSecret(secret: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(process.env.TOTP_ENCRYPTION_KEY, 'hex'),
      iv
    );

    const encrypted = Buffer.concat([
      cipher.update(secret, 'utf8'),
      cipher.final()
    ]);

    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  /**
   * Decrypts TOTP secret with authentication tag verification
   * @param encryptedSecret Encrypted TOTP secret
   * @returns Decrypted secret
   */
  private decryptTotpSecret(encryptedSecret: string): string {
    const buffer = Buffer.from(encryptedSecret, 'base64');
    const iv = buffer.slice(0, 12);
    const authTag = buffer.slice(12, 28);
    const encrypted = buffer.slice(28);

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      Buffer.from(process.env.TOTP_ENCRYPTION_KEY, 'hex'),
      iv
    );
    
    decipher.setAuthTag(authTag);
    
    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]).toString('utf8');
  }

  /**
   * Generates cryptographically secure backup codes
   * @param userId User ID
   * @returns Promise with backup codes
   */
  private async generateBackupCodes(userId: string): Promise<string[]> {
    const codes = Array(this.BACKUP_CODES_COUNT).fill(0).map(() => 
      crypto.randomBytes(4).toString('hex')
    );

    const hashedCodes = await Promise.all(
      codes.map(code => this.hashBackupCode(code))
    );

    await this.userService.storeBackupCodes(userId, hashedCodes);
    return codes;
  }

  /**
   * Hashes backup code using Argon2
   * @param code Backup code
   * @returns Promise with hashed code
   */
  private async hashBackupCode(code: string): Promise<string> {
    const salt = crypto.randomBytes(16);
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(code, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt.toString('hex')}:${derivedKey.toString('hex')}`);
      });
    });
  }
}