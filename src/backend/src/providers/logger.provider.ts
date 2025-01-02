import { Injectable } from '@nestjs/common'; // v10.0.x
import { Logger, createLogger, format, transports } from 'winston'; // v3.10.x
import { ElasticsearchTransport } from 'winston-elasticsearch'; // v0.17.x
import { AsyncLocalStorage } from 'async_hooks';
import { AppConfig } from '../interfaces/config.interface';
import { Client } from '@elastic/elasticsearch'; // v8.10.x
import * as crypto from 'crypto';

@Injectable()
export class LoggerProvider {
  private readonly logger: Logger;
  private readonly environment: string;
  private readonly correlationStorage: AsyncLocalStorage<string>;
  private readonly logSanitizer: LogSanitizer;
  private readonly elasticsearchCircuitBreaker: CircuitBreaker;

  constructor(config: AppConfig) {
    this.environment = config.environment;
    this.correlationStorage = new AsyncLocalStorage<string>();
    this.logSanitizer = new LogSanitizer();
    this.elasticsearchCircuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      resetTimeoutMs: 30000
    });

    const logFormat = format.combine(
      format.timestamp(),
      format.json(),
      format.errors({ stack: true }),
      this.createCustomFormat()
    );

    const esTransport = new ElasticsearchTransport({
      level: 'info',
      client: new Client(config.elasticsearchConfig),
      bufferLimit: 100,
      flushInterval: 2000,
      handleExceptions: true,
      pipeline: 'log-pipeline',
      transformer: this.transformLogForElasticsearch.bind(this)
    });

    this.logger = createLogger({
      level: config.logLevel,
      format: logFormat,
      defaultMeta: {
        environment: this.environment,
        service: 'donation-platform'
      },
      transports: [
        new transports.Console({
          format: this.environment === 'development' 
            ? format.combine(format.colorize(), format.simple())
            : format.json()
        }),
        esTransport
      ],
      exitOnError: false
    });
  }

  private createCustomFormat() {
    return format((info) => {
      const correlationId = this.correlationStorage.getStore();
      if (correlationId) {
        info.correlationId = correlationId;
      }
      info.timestamp = new Date().toISOString();
      return info;
    })();
  }

  private transformLogForElasticsearch(logData: any) {
    const transformed = {
      ...logData,
      '@timestamp': new Date().toISOString(),
      fingerprint: crypto.createHash('sha256')
        .update(JSON.stringify(logData))
        .digest('hex')
    };
    return transformed;
  }

  private sanitizeMetadata(meta: any): any {
    if (!meta) return {};
    return this.logSanitizer.sanitize(meta);
  }

  async log(message: string, meta: any = {}): Promise<void> {
    const sanitizedMeta = this.sanitizeMetadata(meta);
    
    await this.elasticsearchCircuitBreaker.execute(() => {
      this.logger.info(message, {
        ...sanitizedMeta,
        timestamp: new Date().toISOString(),
        correlationId: this.correlationStorage.getStore(),
        level: 'info'
      });
    });
  }

  async error(message: string, error: Error, meta: any = {}): Promise<void> {
    const errorMeta = {
      ...this.sanitizeMetadata(meta),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        fingerprint: crypto.createHash('sha256')
          .update(error.stack || error.message)
          .digest('hex')
      }
    };

    await this.elasticsearchCircuitBreaker.execute(() => {
      this.logger.error(message, {
        ...errorMeta,
        timestamp: new Date().toISOString(),
        correlationId: this.correlationStorage.getStore(),
        level: 'error'
      });
    });
  }

  async warn(message: string, meta: any = {}): Promise<void> {
    const sanitizedMeta = this.sanitizeMetadata(meta);

    await this.elasticsearchCircuitBreaker.execute(() => {
      this.logger.warn(message, {
        ...sanitizedMeta,
        timestamp: new Date().toISOString(),
        correlationId: this.correlationStorage.getStore(),
        level: 'warn'
      });
    });
  }

  async debug(message: string, meta: any = {}): Promise<void> {
    if (this.environment === 'production') return;

    const sanitizedMeta = this.sanitizeMetadata(meta);

    await this.elasticsearchCircuitBreaker.execute(() => {
      this.logger.debug(message, {
        ...sanitizedMeta,
        timestamp: new Date().toISOString(),
        correlationId: this.correlationStorage.getStore(),
        level: 'debug'
      });
    });
  }
}

class LogSanitizer {
  private readonly piiPatterns = {
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    creditCard: /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b/g,
    israeliId: /\b\d{9}\b/g,
    phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g
  };

  sanitize(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      return this.redactPII(data);
    }
    
    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }
    
    if (typeof data === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitize(value);
      }
      return sanitized;
    }
    
    return data;
  }

  private redactPII(text: string): string {
    let redacted = text;
    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      redacted = redacted.replace(pattern, `[REDACTED-${type}]`);
    }
    return redacted;
  }
}

class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private readonly config: { failureThreshold: number; resetTimeoutMs: number };

  constructor(config: { failureThreshold: number; resetTimeoutMs: number }) {
    this.config = config;
  }

  async execute(fn: () => Promise<void>): Promise<void> {
    if (this.isOpen()) {
      if (this.shouldReset()) {
        this.reset();
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      await fn();
      this.reset();
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    return this.failures >= this.config.failureThreshold;
  }

  private shouldReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
  }
}