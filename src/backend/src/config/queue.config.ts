// @nestjs/config v10.0.0
import { registerAs } from '@nestjs/config';

// Default configuration values
const DEFAULT_RETRY_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY = 1000;
const DEFAULT_HEARTBEAT = 60;
const DEFAULT_CONNECTION_TIMEOUT = 30000;
const DEFAULT_SSL_ENABLED = true;

/**
 * Interface defining comprehensive RabbitMQ configuration options
 * including connection, security, and operational parameters
 */
export interface QueueConfig {
  /** RabbitMQ server hostname */
  host: string;
  
  /** RabbitMQ server port */
  port: number;
  
  /** RabbitMQ authentication username */
  username: string;
  
  /** RabbitMQ authentication password */
  password: string;
  
  /** RabbitMQ virtual host */
  vhost: string;
  
  /** Number of retry attempts for failed operations */
  retryAttempts: number;
  
  /** Delay between retry attempts in milliseconds */
  retryDelay: number;
  
  /** Whether SSL/TLS is enabled for connections */
  ssl: boolean;
  
  /** Heartbeat interval in seconds */
  heartbeat: number;
  
  /** Connection timeout in milliseconds */
  connectionTimeout: number;
}

/**
 * Factory function providing validated and secured RabbitMQ configuration
 * Implements robust error handling and secure defaults
 * @returns {QueueConfig} Validated queue configuration object
 */
export default registerAs('queue', (): QueueConfig => {
  // Validate and sanitize environment variables
  const host = process.env.RABBITMQ_HOST;
  if (!host) {
    throw new Error('RABBITMQ_HOST environment variable is required');
  }

  const port = parseInt(process.env.RABBITMQ_PORT || '5672', 10);
  if (isNaN(port)) {
    throw new Error('RABBITMQ_PORT must be a valid number');
  }

  const username = process.env.RABBITMQ_USERNAME;
  if (!username) {
    throw new Error('RABBITMQ_USERNAME environment variable is required');
  }

  const password = process.env.RABBITMQ_PASSWORD;
  if (!password) {
    throw new Error('RABBITMQ_PASSWORD environment variable is required');
  }

  // Configure secure defaults and optional parameters
  return {
    host,
    port,
    username,
    password,
    vhost: process.env.RABBITMQ_VHOST || '/',
    retryAttempts: parseInt(process.env.RABBITMQ_RETRY_ATTEMPTS || String(DEFAULT_RETRY_ATTEMPTS), 10),
    retryDelay: parseInt(process.env.RABBITMQ_RETRY_DELAY || String(DEFAULT_RETRY_DELAY), 10),
    ssl: process.env.RABBITMQ_SSL === 'false' ? false : DEFAULT_SSL_ENABLED,
    heartbeat: parseInt(process.env.RABBITMQ_HEARTBEAT || String(DEFAULT_HEARTBEAT), 10),
    connectionTimeout: parseInt(
      process.env.RABBITMQ_CONNECTION_TIMEOUT || String(DEFAULT_CONNECTION_TIMEOUT),
      10
    ),
  };
});