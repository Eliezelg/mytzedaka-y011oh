import { 
  Controller, 
  Post, 
  Body, 
  UseGuards, 
  UseInterceptors,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
  Ip,
  Headers
} from '@nestjs/common'; // ^10.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import { AuthGuard } from '@nestjs/passport'; // ^10.0.0

import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';
import { User } from '../user/entities/user.entity';

/**
 * Controller handling secure authentication endpoints with comprehensive validation,
 * rate limiting, and audit logging for the International Jewish Association Donation Platform.
 * 
 * Implements:
 * - JWT-based authentication with RS256 signing
 * - TOTP two-factor authentication
 * - Multi-step registration process
 * - Rate limiting protection
 * - Audit logging
 * 
 * @version 1.0.0
 */
@Controller('auth')
@UseInterceptors(LoggingInterceptor)
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  /**
   * Handles user login with rate limiting and device tracking
   * 
   * @param loginDto - Login credentials DTO
   * @param ip - Client IP address
   * @param userAgent - Client user agent
   * @returns JWT tokens and filtered user data
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ 
    points: 5, 
    duration: 60,
    errorMessage: 'Too many login attempts. Please try again later.'
  })
  async login(
    @Body() loginDto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string
  ): Promise<{ accessToken: string; refreshToken: string; user: User; requiresTwoFactor: boolean }> {
    try {
      this.logger.log(`Login attempt from IP: ${ip}, User-Agent: ${userAgent}`);

      const result = await this.authService.login(loginDto);

      this.logger.log(`Successful login for user: ${result.user._id}`);
      
      return result;
    } catch (error) {
      this.logger.warn(`Failed login attempt - Email: ${loginDto.email}, IP: ${ip}`);
      throw error;
    }
  }

  /**
   * Handles multi-step user registration with comprehensive validation
   * 
   * @param registerDto - Registration data DTO
   * @param ip - Client IP address
   * @returns User data and 2FA setup information
   */
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @RateLimit({ 
    points: 3, 
    duration: 3600,
    errorMessage: 'Too many registration attempts. Please try again later.'
  })
  async register(
    @Body() registerDto: RegisterDto,
    @Ip() ip: string
  ): Promise<{ user: User; totpSecret: string; recoveryCodes: string[] }> {
    try {
      this.logger.log(`Registration attempt from IP: ${ip}`);

      const result = await this.authService.register(registerDto);

      this.logger.log(`Successful registration - User ID: ${result.user._id}`);

      return result;
    } catch (error) {
      this.logger.error(`Registration failed - Email: ${registerDto.email}, IP: ${ip}`);
      throw error;
    }
  }

  /**
   * Verifies two-factor authentication code
   * 
   * @param userId - User ID
   * @param code - TOTP or recovery code
   * @param ip - Client IP address
   * @returns Verification status and new access token
   */
  @Post('verify-2fa')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'))
  @RateLimit({ 
    points: 5, 
    duration: 300,
    errorMessage: 'Too many verification attempts. Please try again later.'
  })
  async verifyTwoFactor(
    @Body('userId') userId: string,
    @Body('code') code: string,
    @Ip() ip: string
  ): Promise<{ verified: boolean; accessToken?: string }> {
    try {
      if (!userId || !code) {
        throw new BadRequestException('User ID and verification code are required');
      }

      this.logger.log(`2FA verification attempt - User ID: ${userId}, IP: ${ip}`);

      const result = await this.authService.verifyTwoFactor(userId, code);

      if (result.verified) {
        this.logger.log(`Successful 2FA verification - User ID: ${userId}`);
      } else {
        this.logger.warn(`Failed 2FA verification - User ID: ${userId}, IP: ${ip}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`2FA verification error - User ID: ${userId}, IP: ${ip}`);
      throw error;
    }
  }

  /**
   * Refreshes JWT access token using refresh token
   * 
   * @param refreshToken - JWT refresh token
   * @param ip - Client IP address
   * @returns New access token
   */
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ 
    points: 10, 
    duration: 60,
    errorMessage: 'Too many token refresh attempts. Please try again later.'
  })
  async refreshToken(
    @Body('refreshToken') refreshToken: string,
    @Ip() ip: string
  ): Promise<{ accessToken: string }> {
    try {
      if (!refreshToken) {
        throw new BadRequestException('Refresh token is required');
      }

      this.logger.log(`Token refresh attempt from IP: ${ip}`);

      const result = await this.authService.refreshToken(refreshToken);

      this.logger.log(`Successful token refresh for user: ${result.userId}`);

      return { accessToken: result.accessToken };
    } catch (error) {
      this.logger.warn(`Token refresh failed - IP: ${ip}`);
      throw error;
    }
  }

  /**
   * Initiates password reset process
   * 
   * @param email - User email address
   * @param ip - Client IP address
   */
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @RateLimit({ 
    points: 3, 
    duration: 3600,
    errorMessage: 'Too many password reset attempts. Please try again later.'
  })
  async forgotPassword(
    @Body('email') email: string,
    @Ip() ip: string
  ): Promise<void> {
    try {
      if (!email) {
        throw new BadRequestException('Email is required');
      }

      this.logger.log(`Password reset requested for email: ${email}, IP: ${ip}`);

      await this.authService.initiatePasswordReset(email);

      this.logger.log(`Password reset email sent to: ${email}`);
    } catch (error) {
      this.logger.error(`Password reset failed - Email: ${email}, IP: ${ip}`);
      throw error;
    }
  }
}