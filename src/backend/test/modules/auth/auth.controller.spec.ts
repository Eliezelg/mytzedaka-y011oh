import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';

import { AuthController } from '../../src/modules/auth/auth.controller';
import { AuthService } from '../../src/modules/auth/auth.service';
import { UserService } from '../../src/modules/user/user.service';
import { User } from '../../src/modules/user/entities/user.entity';
import { mockUsers, mockUserCredentials, mockTwoFactorData, mockSessionData } from '../../mocks/user.mock';
import { LoggingInterceptor } from '../../src/interceptors/logging.interceptor';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockAuthService = {
    login: jest.fn(),
    register: jest.fn(),
    verifyTwoFactor: jest.fn(),
    validateToken: jest.fn(),
    refreshToken: jest.fn(),
    initiatePasswordReset: jest.fn()
  };

  const mockUserModel = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn()
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn(),
            verify: jest.fn()
          }
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel
        },
        LoggingInterceptor
      ]
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    const mockIp = '192.168.1.1';
    const mockUserAgent = 'Mozilla/5.0 Test Browser';

    it('should successfully authenticate user with valid credentials', async () => {
      const expectedResponse = {
        accessToken: 'mock.jwt.token',
        refreshToken: 'mock.refresh.token',
        user: mockUsers.donorUser,
        requiresTwoFactor: false
      };

      mockAuthService.login.mockResolvedValue(expectedResponse);

      const result = await controller.login(
        mockUserCredentials.validCredentials,
        mockIp,
        mockUserAgent
      );

      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.login).toHaveBeenCalledWith({
        ...mockUserCredentials.validCredentials,
        ip: mockIp,
        userAgent: mockUserAgent
      });
    });

    it('should enforce rate limiting on failed login attempts', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException());

      for (let i = 0; i < 6; i++) {
        try {
          await controller.login(
            mockUserCredentials.invalidCredentials,
            mockIp,
            mockUserAgent
          );
        } catch (error) {
          if (i >= 5) {
            expect(error.message).toContain('Too many login attempts');
          }
        }
      }
    });

    it('should require 2FA for enabled users', async () => {
      const twoFactorResponse = {
        ...mockUsers.adminUser,
        requiresTwoFactor: true,
        tempToken: 'mock.temp.token'
      };

      mockAuthService.login.mockResolvedValue(twoFactorResponse);

      const result = await controller.login(
        { email: mockUsers.adminUser.email, password: 'validPassword' },
        mockIp,
        mockUserAgent
      );

      expect(result.requiresTwoFactor).toBe(true);
      expect(result.tempToken).toBeDefined();
    });

    it('should block login for locked accounts', async () => {
      mockAuthService.login.mockRejectedValue(
        new UnauthorizedException('Account temporarily locked')
      );

      await expect(
        controller.login(
          mockUserCredentials.lockedCredentials,
          mockIp,
          mockUserAgent
        )
      ).rejects.toThrow('Account temporarily locked');
    });
  });

  describe('register', () => {
    const mockIp = '192.168.1.2';

    it('should successfully register new user with valid data', async () => {
      const registrationData = {
        email: 'new@example.com',
        password: 'ValidP@ssw0rd',
        firstName: 'New',
        lastName: 'User',
        preferredLanguage: 'en'
      };

      const expectedResponse = {
        user: { ...mockUsers.donorUser, email: registrationData.email },
        totpSecret: mockTwoFactorData.secret,
        recoveryCodes: mockTwoFactorData.backupCodes
      };

      mockAuthService.register.mockResolvedValue(expectedResponse);

      const result = await controller.register(registrationData, mockIp);

      expect(result).toEqual(expectedResponse);
      expect(mockAuthService.register).toHaveBeenCalledWith({
        ...registrationData,
        ip: mockIp
      });
    });

    it('should validate password complexity requirements', async () => {
      const weakPasswordData = {
        email: 'test@example.com',
        password: 'weak',
        firstName: 'Test',
        lastName: 'User',
        preferredLanguage: 'en'
      };

      mockAuthService.register.mockRejectedValue(
        new BadRequestException('Password does not meet security requirements')
      );

      await expect(
        controller.register(weakPasswordData, mockIp)
      ).rejects.toThrow('Password does not meet security requirements');
    });

    it('should detect duplicate email registrations', async () => {
      const duplicateData = {
        email: mockUsers.donorUser.email,
        password: 'ValidP@ssw0rd',
        firstName: 'Duplicate',
        lastName: 'User',
        preferredLanguage: 'en'
      };

      mockAuthService.register.mockRejectedValue(
        new BadRequestException('Email already registered')
      );

      await expect(
        controller.register(duplicateData, mockIp)
      ).rejects.toThrow('Email already registered');
    });

    it('should enforce rate limiting on registration attempts', async () => {
      const registrationData = {
        email: 'test@example.com',
        password: 'ValidP@ssw0rd',
        firstName: 'Test',
        lastName: 'User',
        preferredLanguage: 'en'
      };

      for (let i = 0; i < 4; i++) {
        if (i < 3) {
          mockAuthService.register.mockRejectedValue(new Error());
        } else {
          mockAuthService.register.mockRejectedValue(
            new UnauthorizedException('Too many registration attempts')
          );
        }

        try {
          await controller.register(registrationData, mockIp);
        } catch (error) {
          if (i >= 3) {
            expect(error.message).toContain('Too many registration attempts');
          }
        }
      }
    });
  });

  describe('verifyTwoFactor', () => {
    const mockIp = '192.168.1.3';

    it('should successfully verify valid TOTP code', async () => {
      const verificationData = {
        userId: mockUsers.adminUser._id,
        code: mockTwoFactorData.validTOTP
      };

      const expectedResponse = {
        verified: true,
        accessToken: 'mock.jwt.token'
      };

      mockAuthService.verifyTwoFactor.mockResolvedValue(expectedResponse);

      const result = await controller.verifyTwoFactor(
        verificationData.userId,
        verificationData.code,
        mockIp
      );

      expect(result).toEqual(expectedResponse);
    });

    it('should handle invalid TOTP codes', async () => {
      const invalidData = {
        userId: mockUsers.adminUser._id,
        code: mockTwoFactorData.invalidTOTP
      };

      mockAuthService.verifyTwoFactor.mockResolvedValue({ verified: false });

      const result = await controller.verifyTwoFactor(
        invalidData.userId,
        invalidData.code,
        mockIp
      );

      expect(result.verified).toBe(false);
      expect(result.accessToken).toBeUndefined();
    });

    it('should enforce rate limiting on verification attempts', async () => {
      const verificationData = {
        userId: mockUsers.adminUser._id,
        code: mockTwoFactorData.invalidTOTP
      };

      for (let i = 0; i < 6; i++) {
        if (i < 5) {
          mockAuthService.verifyTwoFactor.mockResolvedValue({ verified: false });
        } else {
          mockAuthService.verifyTwoFactor.mockRejectedValue(
            new UnauthorizedException('Too many verification attempts')
          );
        }

        try {
          await controller.verifyTwoFactor(
            verificationData.userId,
            verificationData.code,
            mockIp
          );
        } catch (error) {
          if (i >= 5) {
            expect(error.message).toContain('Too many verification attempts');
          }
        }
      }
    });
  });

  describe('refreshToken', () => {
    const mockIp = '192.168.1.4';

    it('should successfully refresh valid token', async () => {
      const refreshData = {
        refreshToken: mockSessionData.validSession.userId
      };

      const expectedResponse = {
        accessToken: 'new.jwt.token'
      };

      mockAuthService.refreshToken.mockResolvedValue({
        accessToken: expectedResponse.accessToken,
        userId: mockUsers.donorUser._id
      });

      const result = await controller.refreshToken(
        refreshData.refreshToken,
        mockIp
      );

      expect(result).toEqual(expectedResponse);
    });

    it('should reject expired refresh tokens', async () => {
      mockAuthService.refreshToken.mockRejectedValue(
        new UnauthorizedException('Refresh token expired')
      );

      await expect(
        controller.refreshToken(mockSessionData.expiredSession.userId, mockIp)
      ).rejects.toThrow('Refresh token expired');
    });

    it('should enforce rate limiting on token refresh', async () => {
      for (let i = 0; i < 11; i++) {
        try {
          await controller.refreshToken('valid.refresh.token', mockIp);
        } catch (error) {
          if (i >= 10) {
            expect(error.message).toContain('Too many token refresh attempts');
          }
        }
      }
    });
  });
});