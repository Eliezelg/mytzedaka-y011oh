import { Injectable, NestMiddleware } from '@nestjs/common'; // v10.0.x
import { Request, Response, NextFunction } from 'express'; // v4.18.x
import { v4 as uuidv4 } from 'uuid'; // v9.0.x
import { LoggerProvider } from '../providers/logger.provider';

// Constants for correlation ID handling
const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const CORRELATION_ID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_HEADER_LENGTH = 128;

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  private readonly startTime: number;

  constructor(private readonly logger: LoggerProvider) {
    this.startTime = Date.now();
  }

  /**
   * Validates the correlation ID format and security constraints
   * @param correlationId - The correlation ID to validate
   * @returns boolean indicating if the correlation ID is valid
   */
  private validateCorrelationId(correlationId: string): boolean {
    // Check if correlation ID exists and meets length constraints
    if (!correlationId || correlationId.length > MAX_HEADER_LENGTH) {
      return false;
    }

    // Validate UUID v4 format
    if (!CORRELATION_ID_REGEX.test(correlationId)) {
      return false;
    }

    // Additional security checks for header injection
    if (correlationId.includes('\n') || correlationId.includes('\r')) {
      return false;
    }

    return true;
  }

  /**
   * Middleware implementation for correlation ID handling
   */
  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const requestStartTime = Date.now();
      let correlationId: string = req.header(CORRELATION_ID_HEADER);

      // Validate existing correlation ID or generate new one
      if (!correlationId || !this.validateCorrelationId(correlationId)) {
        correlationId = uuidv4();
      }

      // Set correlation ID in request context
      req[CORRELATION_ID_HEADER] = correlationId;

      // Set secure response header
      res.setHeader(CORRELATION_ID_HEADER, correlationId);

      // Enhanced request context for logging
      const requestContext = {
        method: req.method,
        path: req.path,
        correlationId,
        userAgent: req.get('user-agent'),
        clientIp: req.ip,
        timestamp: new Date().toISOString()
      };

      // Log request with context
      await this.logger.debug('Request received', requestContext);

      // Handle response completion
      res.on('finish', async () => {
        const responseTime = Date.now() - requestStartTime;
        
        const responseContext = {
          ...requestContext,
          statusCode: res.statusCode,
          responseTime,
          timestamp: new Date().toISOString()
        };

        // Log response metrics
        if (res.statusCode >= 400) {
          await this.logger.error(
            'Request error',
            new Error(`HTTP ${res.statusCode}`),
            responseContext
          );
        } else {
          await this.logger.debug('Request completed', responseContext);
        }
      });

      // Error handling for response errors
      res.on('error', async (error: Error) => {
        await this.logger.error('Response error', error, {
          correlationId,
          error: error.message,
          stack: error.stack
        });
      });

      next();
    } catch (error) {
      // Handle middleware errors
      await this.logger.error('Correlation ID middleware error', error as Error, {
        timestamp: new Date().toISOString(),
        error: error.message,
        stack: error.stack
      });
      next(error);
    }
  }
}