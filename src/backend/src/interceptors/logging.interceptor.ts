import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'; // v10.0.x
import { Observable, tap, catchError, throwError, finalize } from 'rxjs'; // v7.8.x
import { LoggerProvider } from '../providers/logger.provider';
import { v4 as uuidv4 } from 'uuid'; // v9.0.x

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly correlationIdHeader = 'X-Correlation-ID';
  private readonly sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-session-id'
  ];

  constructor(private readonly logger: LoggerProvider) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startTime = Date.now();
    const correlationId = this.extractCorrelationId(request);
    const requestId = uuidv4();

    // Add correlation ID to response headers
    response.setHeader(this.correlationIdHeader, correlationId);

    // Create metrics context for request
    const metricsContext = this.createMetricsContext(request, correlationId, requestId);

    // Log sanitized request
    const sanitizedRequest = this.sanitizeRequest(request);
    this.logger.log('Incoming request', {
      ...metricsContext,
      request: sanitizedRequest,
      type: 'REQUEST'
    });

    return next.handle().pipe(
      tap(async (responseBody) => {
        const duration = Date.now() - startTime;
        const sanitizedResponse = this.sanitizeResponse(responseBody);

        await this.logger.log('Request completed successfully', {
          ...metricsContext,
          response: sanitizedResponse,
          statusCode: response.statusCode,
          duration,
          type: 'RESPONSE'
        });
      }),
      catchError(async (error) => {
        const duration = Date.now() - startTime;
        
        await this.logger.error('Request failed', error, {
          ...metricsContext,
          statusCode: error.status || 500,
          duration,
          type: 'ERROR',
          errorCode: error.code,
          errorName: error.name
        });

        return throwError(() => error);
      }),
      finalize(async () => {
        const duration = Date.now() - startTime;
        
        await this.logger.log('Request finalized', {
          ...metricsContext,
          duration,
          type: 'METRICS'
        });
      })
    );
  }

  private extractCorrelationId(request: any): string {
    let correlationId = request.headers[this.correlationIdHeader.toLowerCase()];
    
    if (!correlationId) {
      correlationId = uuidv4();
      request.headers[this.correlationIdHeader.toLowerCase()] = correlationId;
    }

    return correlationId;
  }

  private createMetricsContext(request: any, correlationId: string, requestId: string): any {
    return {
      correlationId,
      requestId,
      method: request.method,
      url: request.url,
      path: request.route?.path,
      userAgent: request.headers['user-agent'],
      ip: this.getClientIp(request),
      timestamp: new Date().toISOString(),
      userId: request.user?.id, // If authenticated
      sessionId: request.session?.id
    };
  }

  private sanitizeRequest(request: any): any {
    const sanitizedRequest = {
      method: request.method,
      url: request.url,
      path: request.route?.path,
      params: { ...request.params },
      query: { ...request.query },
      headers: { ...request.headers }
    };

    // Remove sensitive headers
    this.sensitiveHeaders.forEach(header => {
      if (sanitizedRequest.headers[header]) {
        sanitizedRequest.headers[header] = '[REDACTED]';
      }
    });

    // Sanitize request body if present
    if (request.body) {
      sanitizedRequest['body'] = this.sanitizeData(request.body);
    }

    return sanitizedRequest;
  }

  private sanitizeResponse(response: any): any {
    if (!response) return response;
    return this.sanitizeData(response);
  }

  private sanitizeData(data: any): any {
    if (!data) return data;

    // Handle arrays
    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item));
    }

    // Handle objects
    if (typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        // Skip sensitive fields
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]';
          continue;
        }
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }

    return data;
  }

  private isSensitiveField(field: string): boolean {
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'credit_card',
      'card',
      'cvv',
      'ssn',
      'israeliId',
      'email',
      'phone'
    ];

    return sensitiveFields.some(sensitive => 
      field.toLowerCase().includes(sensitive.toLowerCase())
    );
  }

  private getClientIp(request: any): string {
    return request.ip || 
           request.connection?.remoteAddress || 
           request.headers['x-forwarded-for']?.split(',')[0] || 
           'unknown';
  }
}