import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { appConfig } from './config/app.config';
import { AllExceptionsFilter } from './filters/all-exceptions.filter';
import { INestApplication } from '@nestjs/common';

/**
 * Bootstrap the NestJS application with comprehensive security and performance configurations
 * Implements PCI DSS Level 1 compliance and support for 10,000 concurrent users
 */
async function bootstrap() {
  // Create NestJS application instance with security options
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: appConfig().allowedOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
      exposedHeaders: ['Content-Disposition'],
      maxAge: 3600
    },
    logger: ['error', 'warn', 'log', 'debug', 'verbose']
  });

  // Configure security headers with strict CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        sandbox: ['allow-forms', 'allow-scripts', 'allow-same-origin'],
        reportUri: '/api/v1/csp-report'
      }
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
    dnsPrefetchControl: true,
    frameguard: { action: 'deny' },
    hidePoweredBy: true,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
  }));

  // Enable gzip compression for responses
  app.use(compression({
    threshold: 0,
    level: 6,
    memLevel: 8
  }));

  // Configure request logging
  app.use(morgan('combined', {
    skip: (req) => req.url === '/health'
  }));

  // Configure rate limiting for DDoS protection
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // Support for 10,000 concurrent users
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
  }));

  // Set global API prefix
  app.setGlobalPrefix(appConfig().apiPrefix);

  // Configure global validation pipe with strict settings
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: false
    },
    validateCustomDecorators: true,
    stopAtFirstError: false,
    validationError: {
      target: false,
      value: false
    }
  }));

  // Configure global exception filter
  app.useGlobalFilters(new AllExceptionsFilter());

  // Configure graceful shutdown
  setupGracefulShutdown(app);

  // Start the application
  const port = process.env.PORT || appConfig().port || 3000;
  await app.listen(port);

  console.log(`Application is running on: http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
}

/**
 * Configure graceful shutdown handlers
 * @param app NestJS application instance
 */
function setupGracefulShutdown(app: INestApplication) {
  const signals = ['SIGTERM', 'SIGINT'];

  for (const signal of signals) {
    process.on(signal, async () => {
      console.log(`Received ${signal}, starting graceful shutdown`);

      // Stop accepting new requests
      app.close().then(() => {
        console.log('HTTP server closed');
        process.exit(0);
      }).catch((err) => {
        console.error('Error during shutdown:', err);
        process.exit(1);
      });

      // Force shutdown after timeout
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    });
  }
}

// Bootstrap the application
bootstrap().catch(err => {
  console.error('Application failed to start:', err);
  process.exit(1);
});