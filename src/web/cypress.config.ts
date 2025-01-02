import { defineConfig } from 'cypress'; // ^13.0.0
import codeCoverageTask from '@cypress/code-coverage/task'; // ^3.12.0

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    supportFile: 'cypress/support/e2e.ts',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    
    // Viewport configuration
    viewportWidth: 1280,
    viewportHeight: 720,
    
    // Timeouts
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 30000,
    
    // Recording settings
    video: false,
    screenshotOnRunFailure: true,
    
    // Security settings
    chromeWebSecurity: false,
    experimentalSessionAndOrigin: true,
    experimentalModifyObstructiveThirdPartyCode: true,
    
    // Retry configuration
    retries: {
      runMode: 2,
      openMode: 0,
    },

    setupNodeEvents(on, config) {
      // Register code coverage plugin
      codeCoverageTask(on, config);

      // Language switching plugin
      on('task', {
        setLanguage: (language: string) => {
          config.env.currentLanguage = language;
          return null;
        }
      });

      // Network throttling configuration
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome' && config.env.networkThrottling.enabled) {
          launchOptions.args.push(
            `--force-effective-connection-type=${config.env.networkThrottling.presets['4g']}`
          );
        }
        return launchOptions;
      });

      // Authentication plugin
      on('task', {
        getAuthToken: (userType: 'donor' | 'association') => {
          const credentials = config.env.securitySettings.testUserCredentials[userType];
          return Buffer.from(`${credentials.email}:${credentials.password}`).toString('base64');
        }
      });

      // Payment gateway mock handlers
      on('task', {
        mockStripePayment: (success: boolean) => {
          return success ? { status: 'succeeded' } : { status: 'failed' };
        },
        mockTranzillaPayment: (success: boolean) => {
          return success ? { Response: 'Success' } : { Response: 'Failure' };
        }
      });

      return config;
    }
  },

  env: {
    // API Configuration
    apiUrl: 'http://localhost:8000',
    
    // Code Coverage
    coverage: true,
    codeCoverage: {
      url: '/api/__coverage__'
    },

    // Language Support
    languageSupport: {
      default: 'en',
      available: ['en', 'he', 'fr'],
      rtlLanguages: ['he']
    },

    // Security Settings
    securitySettings: {
      authTokenSecret: 'TEST_AUTH_TOKEN_SECRET',
      cookieSettings: {
        secure: true,
        sameSite: 'strict'
      },
      testUserCredentials: {
        donor: {
          email: 'test.donor@example.com',
          password: 'TEST_DONOR_PASSWORD'
        },
        association: {
          email: 'test.association@example.com',
          password: 'TEST_ASSOCIATION_PASSWORD'
        }
      }
    },

    // Payment Gateway Settings
    paymentGateways: {
      stripe: {
        testPublishableKey: 'TEST_STRIPE_PUBLISHABLE_KEY',
        testMode: true
      },
      tranzilla: {
        testTerminalId: 'TEST_TRANZILLA_TERMINAL',
        testMode: true
      }
    },

    // Network Throttling
    networkThrottling: {
      enabled: true,
      presets: {
        '3g': {
          downloadSpeed: 750000,
          uploadSpeed: 250000,
          latency: 100
        },
        '4g': {
          downloadSpeed: 4000000,
          uploadSpeed: 3000000,
          latency: 20
        }
      }
    }
  },

  // Project identification
  projectId: 'ijap-web-testing',

  // Reporter configuration
  reporter: 'cypress-multi-reporters',
  reporterOptions: {
    reporterEnabled: 'spec, mocha-junit-reporter',
    mochaJunitReporterReporterOptions: {
      mochaFile: 'cypress/results/junit/results-[hash].xml'
    }
  }
});