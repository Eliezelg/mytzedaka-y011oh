import { Catch, ArgumentsHost, ExceptionFilter, HttpStatus, HttpException } from '@nestjs/common'; // v10.0.x
import { Request, Response } from 'express'; // v4.18.x
import { LoggerProvider } from '../providers/logger.provider';
import { ErrorCodes } from '../constants/error-codes.constant';
import * as crypto from 'crypto';

interface ErrorResponse {
  statusCode: number;
  errorCode: number;
  message: string;
  correlationId: string;
  timestamp: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly errorCache: Map<string, { count: number; firstSeen: number }>;
  private readonly ERROR_CACHE_TTL = 300000; // 5 minutes
  private readonly MAX_ERROR_CACHE_SIZE = 1000;
  private readonly PII_PATTERNS = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    israeliId: /\b\d{9}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
  };

  constructor(private readonly logger: LoggerProvider) {
    this.errorCache = new Map();
    this.cleanupErrorCache();
  }

  async catch(exception: Error, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const correlationId = this.generateCorrelationId(request);

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorCode = ErrorCodes.INTERNAL_SERVER_ERROR;
    let message = 'An unexpected error occurred';

    // Handle different types of exceptions
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse() as any;
      message = exceptionResponse.message || exception.message;
      errorCode = this.mapHttpStatusToErrorCode(statusCode);
    }

    // Generate error fingerprint for tracking similar errors
    const errorFingerprint = this.generateErrorFingerprint(exception);
    this.updateErrorCache(errorFingerprint);

    // Sanitize error message and stack trace
    const sanitizedMessage = this.sanitizeSensitiveData(message);
    const sanitizedStack = this.sanitizeSensitiveData(exception.stack || '');

    // Prepare error metadata
    const errorMeta = {
      path: request.path,
      method: request.method,
      correlationId,
      errorFingerprint,
      statusCode,
      errorCode,
      ip: this.getClientIp(request),
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    // Log error with enhanced context
    await this.logger.error(
      `Request failed: ${sanitizedMessage}`,
      exception,
      {
        ...errorMeta,
        stack: sanitizedStack,
        headers: this.sanitizeHeaders(request.headers)
      }
    );

    // Check for rate limiting violations
    if (this.isRateLimitViolation(errorFingerprint)) {
      statusCode = HttpStatus.TOO_MANY_REQUESTS;
      errorCode = ErrorCodes.RATE_LIMIT_EXCEEDED;
      message = 'Too many similar errors detected';
    }

    // Prepare and send response
    const errorResponse: ErrorResponse = {
      statusCode,
      errorCode,
      message: sanitizedMessage,
      correlationId,
      timestamp: new Date().toISOString()
    };

    response
      .status(statusCode)
      .json(errorResponse);
  }

  private generateCorrelationId(request: Request): string {
    return crypto
      .createHash('sha256')
      .update(`${request.ip}-${Date.now()}-${Math.random()}`)
      .digest('hex')
      .substring(0, 16);
  }

  private generateErrorFingerprint(error: Error): string {
    return crypto
      .createHash('sha256')
      .update(`${error.name}-${error.message}-${error.stack || ''}`)
      .digest('hex');
  }

  private sanitizeSensitiveData(data: string): string {
    let sanitized = data;
    Object.entries(this.PII_PATTERNS).forEach(([type, pattern]) => {
      sanitized = sanitized.replace(pattern, `[REDACTED-${type}]`);
    });
    return sanitized;
  }

  private sanitizeHeaders(headers: any): any {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized = { ...headers };
    sensitiveHeaders.forEach(header => {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    });
    return sanitized;
  }

  private getClientIp(request: Request): string {
    return request.ip || 
           request.headers['x-forwarded-for'] as string || 
           request.socket.remoteAddress || 
           'unknown';
  }

  private mapHttpStatusToErrorCode(httpStatus: number): number {
    const statusToErrorCode = {
      400: ErrorCodes.VALIDATION_ERROR,
      401: ErrorCodes.UNAUTHORIZED,
      403: ErrorCodes.FORBIDDEN,
      404: ErrorCodes.NOT_FOUND,
      429: ErrorCodes.RATE_LIMIT_EXCEEDED,
      500: ErrorCodes.INTERNAL_SERVER_ERROR
    };
    return statusToErrorCode[httpStatus] || ErrorCodes.INTERNAL_SERVER_ERROR;
  }

  private updateErrorCache(fingerprint: string): void {
    const existing = this.errorCache.get(fingerprint);
    if (existing) {
      existing.count++;
    } else {
      if (this.errorCache.size >= this.MAX_ERROR_CACHE_SIZE) {
        // Remove oldest entry if cache is full
        const oldestKey = Array.from(this.errorCache.keys())[0];
        this.errorCache.delete(oldestKey);
      }
      this.errorCache.set(fingerprint, { count: 1, firstSeen: Date.now() });
    }
  }

  private isRateLimitViolation(fingerprint: string): boolean {
    const entry = this.errorCache.get(fingerprint);
    if (!entry) return false;
    
    const ERROR_THRESHOLD = 10; // Maximum number of similar errors allowed
    const TIME_WINDOW = 60000; // 1 minute window
    
    return entry.count > ERROR_THRESHOLD && 
           (Date.now() - entry.firstSeen) <= TIME_WINDOW;
  }

  private cleanupErrorCache(): void {
    setInterval(() => {
      const now = Date.now();
      for (const [key, value] of this.errorCache.entries()) {
        if (now - value.firstSeen > this.ERROR_CACHE_TTL) {
          this.errorCache.delete(key);
        }
      }
    }, this.ERROR_CACHE_TTL);
  }
}