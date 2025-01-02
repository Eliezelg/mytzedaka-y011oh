import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TwoFactorAuthenticationModule } from '@nestjs/two-factor-authentication';

import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UserModule } from '../user/user.module';
import { jwtConfig } from '../../config/jwt.config';

/**
 * Authentication module implementing comprehensive security features for the
 * International Jewish Association Donation Platform.
 * 
 * Features:
 * - JWT authentication with RS256 signing
 * - Two-factor authentication (TOTP/SMS)
 * - Role-based access control
 * - Rate limiting protection
 * - Audit logging
 * - Multi-language support
 * 
 * @version 1.0.0
 */
@Module({
  imports: [
    // User module for authentication dependencies
    UserModule,

    // Configure Passport with JWT as default strategy
    PassportModule.register({
      defaultStrategy: 'jwt',
      session: false,
      property: 'user'
    }),

    // Configure JWT with RS256 signing and strict validation
    JwtModule.register({
      privateKey: jwtConfig.accessToken.privateKey,
      publicKey: jwtConfig.accessToken.publicKey,
      signOptions: {
        ...jwtConfig.signOptions,
        expiresIn: jwtConfig.accessToken.expiresIn,
        algorithm: 'RS256',
        issuer: jwtConfig.signOptions.issuer,
        audience: jwtConfig.signOptions.audience
      },
      verifyOptions: {
        ...jwtConfig.validationOptions,
        algorithms: ['RS256']
      }
    }),

    // Configure rate limiting protection
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10, // Maximum requests per window
      ignoreUserAgents: [/^(?!.*(?:curl|postman))/], // Exclude API clients
    }),

    // Configure two-factor authentication
    TwoFactorAuthenticationModule.register({
      encryptionKey: process.env.TOTP_ENCRYPTION_KEY,
      window: 1, // TOTP time window
      verifyOnDisable: true, // Require verification for 2FA disable
      issuer: 'IJAP', // TOTP issuer name
      digits: 6, // TOTP code length
      period: 30 // TOTP period in seconds
    })
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtStrategy,
    LocalStrategy,
    // Additional security providers can be added here
  ],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    JwtModule
  ]
})
export class AuthModule {
  // Module configuration constants
  private static readonly JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY;
  private static readonly JWT_PUBLIC_KEY = process.env.JWT_PUBLIC_KEY;
  private static readonly RATE_LIMIT_TTL = 60; // seconds
  private static readonly RATE_LIMIT_MAX_REQUESTS = 10;

  constructor() {
    // Validate required environment variables
    if (!AuthModule.JWT_PRIVATE_KEY || !AuthModule.JWT_PUBLIC_KEY) {
      throw new Error('JWT keys must be provided in environment variables');
    }

    // Additional module initialization can be added here
  }
}