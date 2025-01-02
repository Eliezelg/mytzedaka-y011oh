import type { Config } from '@jest/types'; // v29.0.0

// Create and export the Jest configuration
const config: Config.InitialOptions = {
  // Specify test environment
  testEnvironment: 'jest-environment-jsdom', // v29.0.0

  // Test paths configuration
  roots: ['<rootDir>/src'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}'
  ],

  // Setup files and environment configuration
  setupFilesAfterEnv: ['<rootDir>/src/jest.setup.ts'],
  testEnvironmentOptions: {
    url: 'http://localhost',
    customExportConditions: [''],
    resources: 'usable',
  },

  // Module resolution configuration
  moduleNameMapper: {
    // Handle CSS imports
    '^.+\\.module\\.(css|sass|scss)$': 'identity-obj-proxy',
    '^.+\\.(css|sass|scss)$': '<rootDir>/__mocks__/styleMock.js',
    
    // Handle image imports
    '^.+\\.(jpg|jpeg|png|gif|webp|avif|svg)$': '<rootDir>/__mocks__/fileMock.js',
    
    // Handle path aliases
    '^@/locales/(.*)$': '<rootDir>/src/locales/$1',
    '^@/components/(.*)$': '<rootDir>/src/components/$1',
    '^@/utils/(.*)$': '<rootDir>/src/utils/$1'
  },

  // Module configuration
  modulePaths: ['<rootDir>/src'],
  moduleFileExtensions: ['js', 'ts', 'tsx', 'json', 'jsx'],

  // Code transformation configuration
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: ['next/babel']
    }],
    '^.+\\.m?js$': 'babel-jest'
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(@mui|@babel|lodash-es)/)'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/serviceWorker.ts'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },

  // Watch plugins for better development experience
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],

  // Global configuration for RTL and accessibility testing
  globals: {
    'ts-jest': {
      tsconfig: '<rootDir>/tsconfig.json'
    }
  }
};

export default config;