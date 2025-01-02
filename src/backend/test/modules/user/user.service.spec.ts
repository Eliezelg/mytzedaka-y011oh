import { Test, TestingModule } from '@nestjs/testing'; // ^10.0.0
import { getModelToken } from '@nestjs/mongoose'; // ^10.0.0
import { Model } from 'mongoose'; // ^7.5.0
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

import { UserService } from '../../src/modules/user/user.service';
import { User } from '../../src/modules/user/entities/user.entity';
import { mockUsers, mockUserCredentials, mockTwoFactorData } from '../../mocks/user.mock';
import { CreateUserDto } from '../../src/modules/user/dto/create-user.dto';
import { Roles } from '../../src/constants/roles.constant';

describe('UserService', () => {
  let service: UserService;
  let mockUserModel: Model<User>;

  const mockModel = {
    new: jest.fn(),
    constructor: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    save: jest.fn(),
    exec: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockModel,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    mockUserModel = module.get<Model<User>>(getModelToken(User.name));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'test@example.com',
      password: 'Test123!@#',
      firstName: 'Test',
      lastName: 'User',
      phoneNumber: '+1234567890',
      role: Roles.DONOR,
      preferredLanguage: 'en'
    };

    it('should create a new user with encrypted PII', async () => {
      mockModel.findOne.mockResolvedValue(null);
      mockModel.create.mockResolvedValue(mockUsers.donorUser);

      const result = await service.create(createUserDto);

      expect(result).toBeDefined();
      expect(result.email).toBe(createUserDto.email.toLowerCase());
      expect(result.password).toBeUndefined();
      expect(mockModel.findOne).toHaveBeenCalledWith({ email: createUserDto.email.toLowerCase() });
    });

    it('should reject weak passwords', async () => {
      const weakPasswordDto = { ...createUserDto, password: 'weak' };
      
      await expect(service.create(weakPasswordDto))
        .rejects
        .toThrow(BadRequestException);
    });

    it('should prevent duplicate email registration', async () => {
      mockModel.findOne.mockResolvedValue(mockUsers.donorUser);
      
      await expect(service.create(createUserDto))
        .rejects
        .toThrow(BadRequestException);
    });
  });

  describe('validatePassword', () => {
    it('should validate correct password and reset failed attempts', async () => {
      const { email, password } = mockUserCredentials.validCredentials;
      mockModel.findOne.mockReturnValue({
        ...mockUsers.donorUser,
        select: () => mockUsers.donorUser,
        save: () => Promise.resolve(mockUsers.donorUser)
      });

      const result = await service.validatePassword(email, password);

      expect(result).toBeDefined();
      expect(result.failedLoginAttempts).toBe(0);
      expect(result.accountLockedUntil).toBeNull();
    });

    it('should increment failed attempts on invalid password', async () => {
      const { email, password } = mockUserCredentials.invalidCredentials;
      const mockUser = {
        ...mockUsers.donorUser,
        failedLoginAttempts: 0,
        save: jest.fn().mockResolvedValue(true),
        select: () => ({
          ...mockUsers.donorUser,
          save: jest.fn().mockResolvedValue(true)
        })
      };
      mockModel.findOne.mockReturnValue(mockUser);

      await service.validatePassword(email, password);

      expect(mockUser.failedLoginAttempts).toBe(1);
    });

    it('should enforce account lockout after multiple failures', async () => {
      const { email, password } = mockUserCredentials.lockedCredentials;
      mockModel.findOne.mockReturnValue({
        ...mockUsers.lockedUser,
        select: () => mockUsers.lockedUser
      });

      await expect(service.validatePassword(email, password))
        .rejects
        .toThrow(UnauthorizedException);
    });
  });

  describe('Language Support', () => {
    it('should handle Hebrew character input correctly', async () => {
      const hebrewUserDto: CreateUserDto = {
        ...createUserDto,
        firstName: 'ישראל',
        lastName: 'כהן',
        preferredLanguage: 'he'
      };
      mockModel.findOne.mockResolvedValue(null);
      mockModel.create.mockResolvedValue({
        ...mockUsers.donorUser,
        ...hebrewUserDto
      });

      const result = await service.create(hebrewUserDto);

      expect(result.firstName).toBe(hebrewUserDto.firstName);
      expect(result.lastName).toBe(hebrewUserDto.lastName);
      expect(result.preferredLanguage).toBe('he');
    });

    it('should handle French character input correctly', async () => {
      const frenchUserDto: CreateUserDto = {
        ...createUserDto,
        firstName: 'François',
        lastName: 'Dubois',
        preferredLanguage: 'fr'
      };
      mockModel.findOne.mockResolvedValue(null);
      mockModel.create.mockResolvedValue({
        ...mockUsers.donorUser,
        ...frenchUserDto
      });

      const result = await service.create(frenchUserDto);

      expect(result.firstName).toBe(frenchUserDto.firstName);
      expect(result.lastName).toBe(frenchUserDto.lastName);
      expect(result.preferredLanguage).toBe('fr');
    });
  });

  describe('Security Features', () => {
    it('should properly encrypt PII fields', async () => {
      mockModel.findOne.mockResolvedValue(null);
      const savedUser = { ...mockUsers.donorUser, save: jest.fn() };
      mockModel.create.mockResolvedValue(savedUser);

      const result = await service.create(createUserDto);

      expect(result.firstName).toBe(createUserDto.firstName);
      expect(result.lastName).toBe(createUserDto.lastName);
      expect(result.phoneNumber).toBe(createUserDto.phoneNumber);
      // Verify the stored values are encrypted (not plain text)
      expect(savedUser.firstName).not.toBe(createUserDto.firstName);
      expect(savedUser.lastName).not.toBe(createUserDto.lastName);
      expect(savedUser.phoneNumber).not.toBe(createUserDto.phoneNumber);
    });

    it('should sanitize sensitive data from response', async () => {
      mockModel.findOne.mockResolvedValue(null);
      mockModel.create.mockResolvedValue({
        ...mockUsers.donorUser,
        password: 'hashedPassword',
        refreshToken: 'token',
        twoFactorSecret: 'secret'
      });

      const result = await service.create(createUserDto);

      expect(result.password).toBeUndefined();
      expect(result.refreshToken).toBeUndefined();
      expect(result.twoFactorSecret).toBeUndefined();
    });

    it('should implement exponential backoff for failed attempts', async () => {
      const { email, password } = mockUserCredentials.invalidCredentials;
      const mockUser = {
        ...mockUsers.donorUser,
        failedLoginAttempts: 4,
        save: jest.fn().mockResolvedValue(true),
        select: () => ({
          ...mockUsers.donorUser,
          failedLoginAttempts: 4,
          save: jest.fn().mockResolvedValue(true)
        })
      };
      mockModel.findOne.mockReturnValue(mockUser);

      await service.validatePassword(email, password);

      expect(mockUser.accountLockedUntil).toBeDefined();
      const lockoutDuration = mockUser.accountLockedUntil.getTime() - Date.now();
      expect(lockoutDuration).toBeGreaterThan(0);
    });
  });
});