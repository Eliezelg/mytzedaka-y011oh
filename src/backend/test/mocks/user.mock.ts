import { Roles } from '../../src/constants/roles.constant';
import { User } from '../../src/modules/user/entities/user.entity';

/**
 * Helper function to create a mock user with default values and optional overrides
 * @param overrides - Partial user object to override default values
 * @returns User object with merged default and override values
 */
const createMockUser = (overrides: Partial<User> = {}): User => {
  const defaultUser: Partial<User> = {
    email: 'default@example.com',
    password: '$2b$10$mockHashedPassword',
    firstName: 'Default',
    lastName: 'User',
    role: Roles.DONOR,
    preferredLanguage: 'en',
    isVerified: true,
    twoFactorEnabled: false,
    lastLoginAt: new Date(),
    phoneNumber: '+1234567890',
    failedLoginAttempts: 0,
    passwordChangedAt: new Date(),
    accountLockedUntil: null,
    lastIpAddress: '127.0.0.1'
  };

  return {
    ...defaultUser,
    ...overrides
  } as User;
};

/**
 * Collection of mock user objects for different test scenarios
 * Includes various roles, verification states, and security configurations
 */
export const mockUsers = {
  // Platform administrator with full system access and 2FA enabled
  adminUser: createMockUser({
    email: 'admin@ijap.org',
    firstName: 'Admin',
    lastName: 'User',
    role: Roles.ADMIN,
    twoFactorEnabled: true,
    phoneNumber: '+1234567890',
    lastIpAddress: '192.168.1.1'
  }),

  // Association manager with organization-scoped access
  associationUser: createMockUser({
    email: 'association@example.org',
    firstName: 'Association',
    lastName: 'Manager',
    role: Roles.ASSOCIATION,
    preferredLanguage: 'he',
    phoneNumber: '+9725551234',
    lastIpAddress: '192.168.1.2'
  }),

  // Regular donor with standard access
  donorUser: createMockUser({
    email: 'donor@example.com',
    firstName: 'Regular',
    lastName: 'Donor',
    role: Roles.DONOR,
    preferredLanguage: 'fr',
    phoneNumber: '+33123456789',
    lastIpAddress: '192.168.1.3'
  }),

  // Unverified user pending email confirmation
  unverifiedUser: createMockUser({
    email: 'unverified@example.com',
    firstName: 'Unverified',
    lastName: 'User',
    isVerified: false,
    lastLoginAt: null,
    phoneNumber: '+1987654321',
    lastIpAddress: '192.168.1.4'
  }),

  // Locked user due to multiple failed login attempts
  lockedUser: createMockUser({
    email: 'locked@example.com',
    firstName: 'Locked',
    lastName: 'User',
    failedLoginAttempts: 5,
    accountLockedUntil: new Date(Date.now() + 3600000), // Locked for 1 hour
    phoneNumber: '+1555999888',
    lastIpAddress: '192.168.1.5'
  }),

  // User with expired password requiring reset
  expiredPasswordUser: createMockUser({
    email: 'expired@example.com',
    firstName: 'Expired',
    lastName: 'Password',
    passwordChangedAt: new Date(Date.now() - 7776000000), // 90 days ago
    phoneNumber: '+1555777666',
    lastIpAddress: '192.168.1.6'
  })
};

/**
 * Mock credentials for authentication testing scenarios
 * Includes valid and invalid test cases
 */
export const mockUserCredentials = {
  validCredentials: {
    email: 'donor@example.com',
    password: 'mockPassword123'
  },
  invalidCredentials: {
    email: 'nonexistent@example.com',
    password: 'wrongPassword'
  },
  expiredCredentials: {
    email: 'expired@example.com',
    password: 'expiredPassword123'
  },
  lockedCredentials: {
    email: 'locked@example.com',
    password: 'lockedPassword123'
  }
};

/**
 * Mock two-factor authentication data for security testing
 * Includes valid and invalid TOTP codes
 */
export const mockTwoFactorData = {
  validTOTP: '123456',
  invalidTOTP: '999999',
  backupCodes: [
    'MOCK-BACKUP-1',
    'MOCK-BACKUP-2',
    'MOCK-BACKUP-3'
  ],
  secret: 'MOCK2FASECRET',
  qrCodeUrl: 'otpauth://totp/IJAP:admin@ijap.org?secret=MOCK2FASECRET&issuer=IJAP'
};

/**
 * Mock user session data for testing authentication flows
 */
export const mockSessionData = {
  validSession: {
    userId: mockUsers.donorUser.email,
    expiresAt: new Date(Date.now() + 86400000), // 24 hours from now
    lastActivity: new Date()
  },
  expiredSession: {
    userId: mockUsers.donorUser.email,
    expiresAt: new Date(Date.now() - 3600000), // 1 hour ago
    lastActivity: new Date(Date.now() - 7200000) // 2 hours ago
  }
};