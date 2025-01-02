import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { Logger, UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';

import { AuthService } from '../../../src/modules/auth/auth.service';
import { UserService } from '../../../src/modules/user/user.service';
import { mockUsers, mockUserCredentials } from '../../mocks/user.mock';

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;
  let rateLimiter: RateLimiterRedis;
  let logger: Logger;

  const mockJwtToken = 'mock.jwt.token';
  const mockTotpSecret = 'JBSWY3DPEHPK3PXP';
  const mockTotpCode = '123456';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            validatePassword: jest.fn(),
            create: jest.fn(),
            findByEmail: jest.fn(),
            findById: jest.fn(),
            updateTwoFactorSecret: jest.fn(),
            storeBackupCodes: jest.fn()
          }
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue(mockJwtToken),
            verify: jest.fn()
          }
        },
        {
          provide: RateLimiterRedis,
          useValue: {
            consume: jest.fn(),
            delete: jest.fn(),
            get: jest.fn()
          }
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
          }
        }
      ]
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
    rateLimiter = module.get<RateLimiterRedis>(RateLimiterRedis);
    logger = module.get<Logger>(Logger);
  });

  describe('login', () => {
    it('should successfully authenticate user with valid credentials', async () => {
      const { email, password } = mockUserCredentials.validCredentials;
      jest.spyOn(userService, 'validatePassword').mockResolvedValue(mockUsers.donorUser);
      jest.spyOn(rateLimiter, 'consume').mockResolvedValue(null);

      const result = await service.login({ email, password });

      expect(result).toEqual({
        accessToken: mockJwtToken,
        user: mockUsers.donorUser
      });
      expect(userService.validatePassword).toHaveBeenCalledWith(email, password);
      expect(logger.log).toHaveBeenCalledWith(`Successful login for user: ${mockUsers.donorUser._id}`);
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const { email, password } = mockUserCredentials.invalidCredentials;
      jest.spyOn(userService, 'validatePassword').mockResolvedValue(null);
      jest.spyOn(rateLimiter, 'consume').mockResolvedValue(null);

      await expect(service.login({ email, password }))
        .rejects
        .toThrow(UnauthorizedException);
      expect(logger.warn).toHaveBeenCalledWith(`Failed login attempt for email: ${email}`);
    });

    it('should enforce rate limiting on login attempts', async () => {
      const { email, password } = mockUserCredentials.validCredentials;
      jest.spyOn(rateLimiter, 'consume').mockRejectedValue({ name: 'RateLimiterError' });

      await expect(service.login({ email, password }))
        .rejects
        .toThrow(UnauthorizedException);
      expect(rateLimiter.consume).toHaveBeenCalledWith(email);
    });
  });

  describe('register', () => {
    const registerDto = {
      email: 'new@example.com',
      password: 'ValidPass123!',
      firstName: 'New',
      lastName: 'User',
      preferredLanguage: 'en'
    };

    it('should successfully register new user', async () => {
      jest.spyOn(userService, 'create').mockResolvedValue(mockUsers.donorUser);

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('user');
      expect(result).toHaveProperty('totpSecret');
      expect(userService.create).toHaveBeenCalled();
      expect(logger.log).toHaveBeenCalledWith(`New user registered: ${mockUsers.donorUser._id}`);
    });

    it('should handle registration failures', async () => {
      jest.spyOn(userService, 'create').mockRejectedValue(new Error('Registration failed'));

      await expect(service.register(registerDto))
        .rejects
        .toThrow('Registration failed');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('validateToken', () => {
    it('should successfully validate valid JWT token', async () => {
      const payload = {
        sub: mockUsers.donorUser._id,
        email: mockUsers.donorUser.email,
        iat: Math.floor(Date.now() / 1000)
      };

      jest.spyOn(jwtService, 'verify').mockResolvedValue(payload);
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(mockUsers.donorUser);

      const result = await service.validateToken(mockJwtToken);

      expect(result).toEqual(mockUsers.donorUser);
      expect(jwtService.verify).toHaveBeenCalledWith(mockJwtToken, { algorithms: ['RS256'] });
    });

    it('should reject expired tokens', async () => {
      jest.spyOn(jwtService, 'verify').mockRejectedValue(new Error('Token expired'));

      await expect(service.validateToken(mockJwtToken))
        .rejects
        .toThrow(UnauthorizedException);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should reject tokens after password change', async () => {
      const payload = {
        sub: mockUsers.donorUser._id,
        email: mockUsers.donorUser.email,
        iat: Math.floor((Date.now() - 86400000) / 1000) // 1 day ago
      };

      const userWithPasswordChange = {
        ...mockUsers.donorUser,
        passwordChangedAt: new Date()
      };

      jest.spyOn(jwtService, 'verify').mockResolvedValue(payload);
      jest.spyOn(userService, 'findByEmail').mockResolvedValue(userWithPasswordChange);

      await expect(service.validateToken(mockJwtToken))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('two-factor authentication', () => {
    it('should generate secure TOTP secret', async () => {
      jest.spyOn(userService, 'updateTwoFactorSecret').mockResolvedValue(mockUsers.donorUser);

      const result = await service.generateTwoFactorSecret(mockUsers.donorUser);

      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThanOrEqual(16);
      expect(userService.updateTwoFactorSecret).toHaveBeenCalled();
    });

    it('should verify valid TOTP code', async () => {
      const user = {
        ...mockUsers.donorUser,
        twoFactorSecret: service['encryptTotpSecret'](mockTotpSecret)
      };

      jest.spyOn(userService, 'findById').mockResolvedValue(user);
      jest.spyOn(crypto, 'timingSafeEqual').mockReturnValue(true);

      const result = await service.verifyTwoFactor(user._id, mockTotpCode);

      expect(result).toBe(true);
    });

    it('should reject invalid TOTP code', async () => {
      const user = {
        ...mockUsers.donorUser,
        twoFactorSecret: service['encryptTotpSecret'](mockTotpSecret)
      };

      jest.spyOn(userService, 'findById').mockResolvedValue(user);
      jest.spyOn(crypto, 'timingSafeEqual').mockReturnValue(false);

      const result = await service.verifyTwoFactor(user._id, 'invalid');

      expect(result).toBe(false);
    });

    it('should handle missing 2FA configuration', async () => {
      jest.spyOn(userService, 'findById').mockResolvedValue({
        ...mockUsers.donorUser,
        twoFactorSecret: null
      });

      await expect(service.verifyTwoFactor(mockUsers.donorUser._id, mockTotpCode))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('security controls', () => {
    it('should encrypt and decrypt TOTP secret correctly', () => {
      const encrypted = service['encryptTotpSecret'](mockTotpSecret);
      const decrypted = service['decryptTotpSecret'](encrypted);

      expect(decrypted).toBe(mockTotpSecret);
      expect(encrypted).not.toBe(mockTotpSecret);
    });

    it('should generate secure backup codes', async () => {
      jest.spyOn(userService, 'storeBackupCodes').mockResolvedValue(mockUsers.donorUser);

      const codes = await service['generateBackupCodes'](mockUsers.donorUser._id);

      expect(codes).toHaveLength(10);
      expect(userService.storeBackupCodes).toHaveBeenCalled();
      codes.forEach(code => {
        expect(code).toMatch(/^[0-9a-f]{8}$/);
      });
    });

    it('should hash backup codes securely', async () => {
      const code = 'testcode123';
      const hashedCode = await service['hashBackupCode'](code);

      expect(hashedCode).toContain(':');
      const [salt, hash] = hashedCode.split(':');
      expect(salt).toHaveLength(32);
      expect(hash).toHaveLength(128);
    });
  });
});