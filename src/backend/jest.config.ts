// ts-jest v29.1.0 - TypeScript preprocessor for Jest testing framework
import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  // File extensions Jest will look for
  moduleFileExtensions: ['js', 'json', 'ts'],

  // Root directory for Jest to scan for tests
  rootDir: '.',

  // Use Node.js as test environment
  testEnvironment: 'node',

  // Pattern to detect test files
  testRegex: '.*\\.spec\\.ts$',

  // Transform TypeScript files using ts-jest
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },

  // Path aliases mapping for clean imports
  moduleNameMapper: {
    '@modules/(.*)': '<rootDir>/src/modules/$1',
    '@config/(.*)': '<rootDir>/src/config/$1',
    '@utils/(.*)': '<rootDir>/src/utils/$1',
    '@interfaces/(.*)': '<rootDir>/src/interfaces/$1',
    '@constants/(.*)': '<rootDir>/src/constants/$1',
    '@providers/(.*)': '<rootDir>/src/providers/$1',
    '@decorators/(.*)': '<rootDir>/src/decorators/$1',
    '@filters/(.*)': '<rootDir>/src/filters/$1',
    '@guards/(.*)': '<rootDir>/src/guards/$1',
    '@interceptors/(.*)': '<rootDir>/src/interceptors/$1',
    '@middlewares/(.*)': '<rootDir>/src/middlewares/$1',
  },

  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/**/*.module.ts',
    '!src/**/*.interface.ts',
    '!src/**/*.dto.ts',
    '!src/**/*.entity.ts',
    '!src/**/*.schema.ts',
  ],

  // Directory where coverage reports will be stored
  coverageDirectory: 'coverage',

  // Enforce minimum coverage thresholds
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },

  // Optimize test execution using 50% of available CPU cores
  maxWorkers: '50%',

  // Test timeout in milliseconds
  testTimeout: 30000,

  // Setup file to run after Jest is loaded
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  // Force exit after all tests complete
  forceExit: true,

  // Detect any open handles (e.g., db connections) after tests
  detectOpenHandles: true,
};

export default config;