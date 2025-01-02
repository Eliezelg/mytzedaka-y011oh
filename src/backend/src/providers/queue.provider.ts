// @nestjs/common v10.0.0
import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
// @nestjs/config v10.0.0
import { ConfigService } from '@nestjs/config';
// amqplib v0.10.0
import { Channel, Connection, connect, Options, Replies } from 'amqplib';
import { QueueConfig } from '../config/queue.config';

@Injectable()
export class QueueProvider implements OnModuleDestroy {
  private readonly logger = new Logger(QueueProvider.name);
  private connections: Connection[] = [];
  private channels: Channel[] = [];
  private readonly config: QueueConfig;
  private isConnected: boolean = false;
  private lastHeartbeat: number = Date.now();
  private readonly consumers: Map<string, Function> = new Map();
  private reconnectTimeout: NodeJS.Timeout | null = null;

  constructor(private readonly configService: ConfigService) {
    this.config = this.configService.get<QueueConfig>('queue')!;
    this.setupReconnection();
  }

  async onModuleDestroy() {
    await this.closeConnections();
  }

  private async closeConnections() {
    try {
      for (const channel of this.channels) {
        if (channel) await channel.close();
      }
      for (const connection of this.connections) {
        if (connection) await connection.close();
      }
      this.channels = [];
      this.connections = [];
      this.isConnected = false;
    } catch (error) {
      this.logger.error('Error closing connections:', error);
    }
  }

  private setupReconnection() {
    setInterval(() => {
      const heartbeatAge = Date.now() - this.lastHeartbeat;
      if (this.isConnected && heartbeatAge > this.config.heartbeat * 1000) {
        this.logger.warn('Heartbeat timeout detected, initiating reconnection');
        this.reconnect();
      }
    }, this.config.heartbeat * 500); // Check twice per heartbeat interval
  }

  private async reconnect() {
    if (this.reconnectTimeout) return;

    this.isConnected = false;
    await this.closeConnections();

    this.reconnectTimeout = setTimeout(async () => {
      try {
        await this.connect();
        // Restore consumers after reconnection
        for (const [queue, callback] of this.consumers.entries()) {
          await this.consumeMessage(queue, callback);
        }
        this.reconnectTimeout = null;
      } catch (error) {
        this.logger.error('Reconnection failed:', error);
        this.reconnect();
      }
    }, this.config.retryDelay);
  }

  async connect(): Promise<void> {
    try {
      const connectionOptions: Options.Connect = {
        hostname: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        vhost: this.config.vhost,
        heartbeat: this.config.heartbeat,
        ssl: this.config.ssl ? {
          rejectUnauthorized: true,
        } : false,
      };

      // Create connection pool
      for (let i = 0; i < this.config.connectionPoolSize; i++) {
        const connection = await connect(connectionOptions);
        
        connection.on('error', (error) => {
          this.logger.error(`Connection ${i} error:`, error);
          this.reconnect();
        });

        connection.on('close', () => {
          this.logger.warn(`Connection ${i} closed`);
          this.reconnect();
        });

        const channel = await connection.createChannel();
        await channel.prefetch(10); // Configure prefetch for better load distribution

        channel.on('error', (error) => {
          this.logger.error(`Channel ${i} error:`, error);
        });

        this.connections.push(connection);
        this.channels.push(channel);
      }

      // Setup dead letter exchange
      const deadLetterExchange = 'dlx';
      await this.channels[0].assertExchange(deadLetterExchange, 'direct', { durable: true });

      this.isConnected = true;
      this.lastHeartbeat = Date.now();
      this.logger.log('Successfully connected to RabbitMQ');
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  async publishMessage(
    exchange: string,
    routingKey: string,
    message: Buffer,
    options: Options.Publish = {}
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to RabbitMQ');
    }

    const retryPublish = async (attempts: number): Promise<void> => {
      try {
        const channel = this.getAvailableChannel();
        await channel.assertExchange(exchange, 'direct', { durable: true });
        
        const publishOptions: Options.Publish = {
          persistent: true,
          ...options,
          timestamp: Date.now(),
          headers: {
            ...options.headers,
            'x-retry-count': attempts,
          },
        };

        const published = channel.publish(exchange, routingKey, message, publishOptions);
        if (!published) {
          throw new Error('Message could not be published');
        }
      } catch (error) {
        if (attempts < this.config.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
          return retryPublish(attempts + 1);
        }
        throw error;
      }
    };

    await retryPublish(0);
  }

  async consumeMessage(
    queue: string,
    callback: Function,
    options: Options.Consume = {}
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Not connected to RabbitMQ');
    }

    try {
      const channel = this.getAvailableChannel();
      
      // Assert queue with dead letter exchange
      await channel.assertQueue(queue, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': 'dlx',
          'x-dead-letter-routing-key': `${queue}-dead-letter`,
        },
      });

      const consumeOptions: Options.Consume = {
        noAck: false,
        ...options,
      };

      await channel.consume(queue, async (msg) => {
        if (!msg) return;

        try {
          await callback(msg);
          channel.ack(msg);
        } catch (error) {
          this.logger.error(`Error processing message from ${queue}:`, error);
          
          const retryCount = (msg.properties.headers['x-retry-count'] || 0) + 1;
          if (retryCount <= this.config.retryAttempts) {
            channel.nack(msg, false, true);
          } else {
            channel.nack(msg, false, false);
          }
        }
      }, consumeOptions);

      this.consumers.set(queue, callback);
    } catch (error) {
      this.logger.error(`Failed to setup consumer for queue ${queue}:`, error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!this.isConnected) return false;

    try {
      // Check connection pool health
      const connectionPromises = this.connections.map(async (connection, index) => {
        if (!connection.connection.writable) {
          throw new Error(`Connection ${index} is not writable`);
        }
      });

      // Check channel health
      const channelPromises = this.channels.map(async (channel, index) => {
        await channel.checkQueue('health-check-queue');
      });

      await Promise.all([...connectionPromises, ...channelPromises]);
      return true;
    } catch (error) {
      this.logger.error('Health check failed:', error);
      return false;
    }
  }

  private getAvailableChannel(): Channel {
    // Simple round-robin channel selection
    const channel = this.channels[Math.floor(Math.random() * this.channels.length)];
    if (!channel) throw new Error('No available channels');
    return channel;
  }
}