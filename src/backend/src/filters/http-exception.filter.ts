import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Injectable } from '@nestjs/common'; // v10.0.x
import { Request, Response } from 'express'; // v4.18.x
import { LoggerProvider } from '../providers/logger.provider';
import { ErrorCodes } from '../constants/error-codes.constant';
import * as crypto from 'crypto';

interface ErrorResponse {
  statusCode: number;
  message: string;
  error: string;
  correlationId: string;
  timestamp: string;
  code: number;
  path: string;
  debug?: any;
}

@Injectable()
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly environment: string;

  constructor(
    private readonly logger: LoggerProvider,
    private readonly configService: any
  ) {
    this.environment = this.configService.get('environment');
  }

  catch(exception: HttpException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    
    // Generate unique correlation ID for error tracking
    const correlationId = crypto
      .createHash('sha256')
      .update(`${Date.now()}-${request.ip}-${request.path}`)
      .digest('hex')
      .substring(0, 16);

    const status = exception.getStatus();
    const errorResponse = this.formatErrorResponse(exception, correlationId, request.path);

    // Log error with context
    this.logError(exception, request, correlationId);

    // Add security headers
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('X-XSS-Protection', '1; mode=block');
    response.setHeader('X-Correlation-ID', correlationId);

    // Send error response
    response
      .status(status)
      .json(errorResponse);
  }

  private formatErrorResponse(
    exception: HttpException, 
    correlationId: string,
    path: string
  ): ErrorResponse {
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse() as any;
    
    const baseResponse: ErrorResponse = {
      statusCode: status,
      message: typeof exceptionResponse === 'string' ? exceptionResponse : exceptionResponse.message,
      error: exception.name,
      correlationId,
      timestamp: new Date().toISOString(),
      code: ErrorCodes.INTERNAL_SERVER_ERROR,
      path
    };

    // Add error code if available
    if (exceptionResponse.code) {
      baseResponse.code = exceptionResponse.code;
    }

    // Add debug information in non-production environments
    if (this.environment !== 'production') {
      baseResponse.debug = {
        stack: exception.stack,
        cause: exception.cause,
        details: exceptionResponse.details || null
      };
    }

    return this.sanitizeErrorResponse(baseResponse);
  }

  private sanitizeErrorResponse(response: ErrorResponse): ErrorResponse {
    // Remove sensitive information from error messages
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /key/i,
      /secret/i,
      /credential/i,
      /authorization/i
    ];

    let sanitizedMessage = response.message;
    sensitivePatterns.forEach(pattern => {
      sanitizedMessage = sanitizedMessage.replace(
        pattern,
        '[REDACTED]'
      );
    });

    return {
      ...response,
      message: sanitizedMessage
    };
  }

  private logError(
    exception: HttpException,
    request: Request,
    correlationId: string
  ): void {
    const errorContext = {
      correlationId,
      path: request.path,
      method: request.method,
      ip: request.ip,
      userAgent: request.get('user-agent'),
      statusCode: exception.getStatus(),
      userId: request.user?.id, // If user context is available
      timestamp: new Date().toISOString()
    };

    // Log error with context
    this.logger.error(
      `HTTP Exception: ${exception.message}`,
      exception,
      errorContext
    );
  }
}