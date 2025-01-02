import { Injectable, NestMiddleware } from '@nestjs/common'; // v10.0.x
import { Request, Response, NextFunction } from 'express'; // v4.18.x
import { hrtime } from 'process'; // built-in
import { LoggerProvider } from '../providers/logger.provider';

// Constants for request logging
const REQUEST_START_TIME = 'X-Request-Start-Time';
const CORRELATION_ID_HEADER = 'X-Correlation-ID';
const MAX_BODY_LOG_SIZE = 10000;

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: LoggerProvider) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Record request start time with nanosecond precision
      const startTime = hrtime();
      req[REQUEST_START_TIME] = startTime;

      // Ensure correlation ID exists or generate one
      const correlationId = req.headers[CORRELATION_ID_HEADER.toLowerCase()] || 
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      req.headers[CORRELATION_ID_HEADER.toLowerCase()] = correlationId;
      res.setHeader(CORRELATION_ID_HEADER, correlationId);

      // Log incoming request
      await this.logger.log('Incoming request', await this.formatRequestLog(req));

      // Handle response completion
      res.on('finish', async () => {
        const endTime = hrtime(startTime);
        const duration = (endTime[0] * 1e9 + endTime[1]) / 1e6; // Convert to milliseconds

        await this.logger.log('Request completed', {
          ...await this.formatResponseLog(res, duration),
          correlationId
        });
      });

      // Handle response errors
      res.on('error', async (error: Error) => {
        await this.logger.error('Response error', error, {
          correlationId,
          request: await this.formatRequestLog(req)
        });
      });

      next();
    } catch (error) {
      // Ensure logging errors don't break the application
      console.error('Logging middleware error:', error);
      next();
    }
  }

  private async formatRequestLog(req: Request): Promise<object> {
    try {
      const requestSize = req.headers['content-length'] ? 
        parseInt(req.headers['content-length']) : 0;

      // Extract and format request body while respecting size limits
      let body = undefined;
      if (req.body && requestSize > 0 && requestSize <= MAX_BODY_LOG_SIZE) {
        body = JSON.stringify(req.body);
      }

      // Format request metadata with security context
      return {
        method: req.method,
        url: req.url,
        path: req.path,
        params: req.params,
        query: req.query,
        body,
        headers: this.filterSensitiveHeaders(req.headers),
        ip: req.ip,
        ips: req.ips,
        protocol: req.protocol,
        secure: req.secure,
        xhr: req.xhr,
        requestSize,
        userAgent: req.headers['user-agent'],
        referer: req.headers.referer,
        correlationId: req.headers[CORRELATION_ID_HEADER.toLowerCase()],
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      await this.logger.error('Error formatting request log', error);
      return {
        error: 'Error formatting request log',
        method: req.method,
        url: req.url
      };
    }
  }

  private async formatResponseLog(res: Response, duration: number): Promise<object> {
    try {
      const responseSize = res.get('content-length') ? 
        parseInt(res.get('content-length')) : 0;

      return {
        statusCode: res.statusCode,
        statusMessage: res.statusMessage,
        headers: this.filterSensitiveHeaders(res.getHeaders()),
        responseSize,
        duration,
        timestamp: new Date().toISOString(),
        performanceMetrics: {
          timeToFirstByte: duration,
          totalProcessingTime: duration,
          responseSize
        },
        securityHeaders: {
          'x-frame-options': res.get('x-frame-options'),
          'x-xss-protection': res.get('x-xss-protection'),
          'x-content-type-options': res.get('x-content-type-options'),
          'strict-transport-security': res.get('strict-transport-security')
        }
      };
    } catch (error) {
      await this.logger.error('Error formatting response log', error);
      return {
        error: 'Error formatting response log',
        statusCode: res.statusCode
      };
    }
  }

  private filterSensitiveHeaders(headers: any): object {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'set-cookie',
      'x-api-key',
      'x-auth-token',
      'x-csrf-token'
    ];

    const filteredHeaders = {};
    for (const [key, value] of Object.entries(headers)) {
      if (!sensitiveHeaders.includes(key.toLowerCase())) {
        filteredHeaders[key] = value;
      } else {
        filteredHeaders[key] = '[REDACTED]';
      }
    }

    return filteredHeaders;
  }
}