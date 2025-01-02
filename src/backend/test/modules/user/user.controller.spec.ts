import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserController } from '../../src/modules/user/user.controller';
import { UserService } from '../../src/modules/user/user.service';
import { mockUsers, mockUserCredentials, mockTwoFactorData } from '../../test/mocks/user.mock';
import { Roles } from '../../src/constants/roles.constant';

describe('UserController', () => {
  let controller: UserController;
  let userService: jest.Mocked<UserService>;

  // Mock UserService implementation
  const mockUserService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    updateLanguage: jest.fn(),
    verifyTwoFactor: jest.fn()
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService
        }
      ]
    }).compile();

    controller = module.get<UserController>(UserController);
    userService = module.get(UserService);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new user successfully', async () => {
      const createUserDto = {
        email: 'test@example.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+1234567890',
        role: Roles.DONOR,
        preferredLanguage: 'en'
      };

      mockUserService.create.mockResolvedValue(mockUsers.donorUser);

      const result = await controller.create(createUserDto);

      expect(result).toBeDefined();
      expect(userService.create).toHaveBeenCalledWith(createUserDto);
      expect(result.email).toBe(mockUsers.donorUser.email);
    });

    it('should throw BadRequestException for invalid input', async () => {
      const invalidDto = {
        email: 'invalid-email',
        password: 'weak',
        firstName: '',
        lastName: ''
      };

      await expect(controller.create(invalidDto)).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAll', () => {
    it('should return paginated users list', async () => {
      const mockResponse = {
        data: [mockUsers.donorUser, mockUsers.associationUser],
        total: 2,
        page: 1,
        limit: 10
      };

      mockUserService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(1, 10, Roles.DONOR);

      expect(result).toBeDefined();
      expect(result.data).toHaveLength(2);
      expect(userService.findAll).toHaveBeenCalledWith(1, 10, Roles.DONOR);
    });

    it('should handle empty result set', async () => {
      const mockResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 10
      };

      mockUserService.findAll.mockResolvedValue(mockResponse);

      const result = await controller.findAll(1, 10);

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return a user by ID', async () => {
      const userId = 'mock-user-id';
      mockUserService.findOne.mockResolvedValue(mockUsers.donorUser);

      const result = await controller.findOne(userId);

      expect(result).toBeDefined();
      expect(userService.findOne).toHaveBeenCalledWith(userId);
      expect(result.email).toBe(mockUsers.donorUser.email);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      const userId = 'non-existent-id';
      mockUserService.findOne.mockResolvedValue(null);

      await expect(controller.findOne(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update user profile successfully', async () => {
      const userId = 'mock-user-id';
      const updateDto = {
        firstName: 'Updated',
        lastName: 'User',
        preferredLanguage: 'fr'
      };

      const updatedUser = { ...mockUsers.donorUser, ...updateDto };
      mockUserService.update.mockResolvedValue(updatedUser);

      const result = await controller.update(userId, updateDto);

      expect(result).toBeDefined();
      expect(userService.update).toHaveBeenCalledWith(userId, updateDto);
      expect(result.firstName).toBe(updateDto.firstName);
      expect(result.preferredLanguage).toBe(updateDto.preferredLanguage);
    });

    it('should throw NotFoundException for non-existent user update', async () => {
      const userId = 'non-existent-id';
      const updateDto = { firstName: 'Test' };
      mockUserService.update.mockResolvedValue(null);

      await expect(controller.update(userId, updateDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should remove user successfully', async () => {
      const userId = 'mock-user-id';
      mockUserService.remove.mockResolvedValue(true);

      await controller.remove(userId);

      expect(userService.remove).toHaveBeenCalledWith(userId);
    });

    it('should throw NotFoundException for non-existent user removal', async () => {
      const userId = 'non-existent-id';
      mockUserService.remove.mockResolvedValue(false);

      await expect(controller.remove(userId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateLanguage', () => {
    it('should update language preference successfully', async () => {
      const userId = 'mock-user-id';
      const language = 'he';

      const updatedUser = { ...mockUsers.donorUser, preferredLanguage: language };
      mockUserService.updateLanguage.mockResolvedValue(updatedUser);

      const result = await controller.updateLanguage(userId, language);

      expect(result).toBeDefined();
      expect(userService.updateLanguage).toHaveBeenCalledWith(userId, language);
      expect(result.preferredLanguage).toBe(language);
    });

    it('should throw BadRequestException for invalid language', async () => {
      const userId = 'mock-user-id';
      const invalidLanguage = 'invalid';

      await expect(controller.updateLanguage(userId, invalidLanguage))
        .rejects.toThrow(BadRequestException);
    });
  });

  describe('security controls', () => {
    it('should handle rate limiting correctly', async () => {
      // Test implementation would depend on actual rate limiting configuration
      // This is a placeholder for rate limiting test
      const createUserDto = {
        email: 'test@example.com',
        password: 'Test123!@#',
        firstName: 'Test',
        lastName: 'User'
      };

      mockUserService.create.mockResolvedValue(mockUsers.donorUser);

      await controller.create(createUserDto);
      expect(userService.create).toHaveBeenCalledTimes(1);
    });

    it('should validate two-factor authentication', async () => {
      const userId = 'mock-user-id';
      const totpCode = mockTwoFactorData.validTOTP;

      mockUserService.verifyTwoFactor.mockResolvedValue(true);

      const result = await controller.validateTwoFactor(userId, totpCode);

      expect(result).toBeTruthy();
      expect(userService.verifyTwoFactor).toHaveBeenCalledWith(userId, totpCode);
    });
  });

  describe('role-based access control', () => {
    it('should allow admin access to protected endpoints', async () => {
      const adminUser = mockUsers.adminUser;
      mockUserService.findAll.mockResolvedValue({
        data: [adminUser],
        total: 1,
        page: 1,
        limit: 10
      });

      const result = await controller.findAll(1, 10, Roles.ADMIN);

      expect(result.data).toContainEqual(expect.objectContaining({
        role: Roles.ADMIN
      }));
    });

    it('should restrict access based on user role', async () => {
      // Implementation would depend on actual guard implementation
      // This is a placeholder for role-based access control test
      const restrictedUserId = 'restricted-user-id';
      mockUserService.findOne.mockImplementation(() => {
        throw new UnauthorizedException('Insufficient permissions');
      });

      await expect(controller.findOne(restrictedUserId))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});