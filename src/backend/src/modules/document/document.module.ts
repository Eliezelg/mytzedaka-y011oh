/**
 * @fileoverview Document Module Configuration
 * Configures secure document management functionality with enhanced security features
 * including encrypted document storage, audit logging, and compliance controls.
 * @version 1.0.0
 */

import { Module } from '@nestjs/common'; // @nestjs/common@^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // @nestjs/typeorm@^10.0.0
import { ConfigModule } from '@nestjs/config'; // @nestjs/config@^10.0.0

import { Document } from './entities/document.entity';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

/**
 * Module configuring secure document management functionality with comprehensive
 * security controls, encryption, and audit capabilities.
 * 
 * Features:
 * - Encrypted document storage
 * - Document verification workflows
 * - Access control integration
 * - Audit logging
 * - Compliance controls
 * 
 * Security measures:
 * - Field-level encryption
 * - Access control enforcement
 * - Audit trail tracking
 * - Document integrity validation
 */
@Module({
  imports: [
    // Register Document entity with TypeORM for secure database operations
    TypeOrmModule.forFeature([Document]),
    
    // Import configuration module for security settings
    ConfigModule.forFeature(() => ({
      document: {
        // Encryption configuration
        encryption: {
          algorithm: process.env.DOCUMENT_ENCRYPTION_ALGORITHM || 'aes-256-gcm',
          keyLength: 32,
          ivLength: 16,
          authTagLength: 16
        },
        // Storage configuration
        storage: {
          provider: process.env.DOCUMENT_STORAGE_PROVIDER || 's3',
          bucket: process.env.DOCUMENT_STORAGE_BUCKET,
          region: process.env.AWS_REGION
        },
        // Audit configuration
        audit: {
          enabled: true,
          detailedLogging: process.env.NODE_ENV === 'production',
          retentionDays: 365
        }
      }
    }))
  ],
  controllers: [
    // Register document controller with security middleware
    DocumentController
  ],
  providers: [
    // Register core document service
    DocumentService,
    
    // Register storage provider
    {
      provide: 'StorageProvider',
      useFactory: async (configService) => {
        // Storage provider initialization would be implemented here
        // This is a placeholder for the actual implementation
        return {};
      },
      inject: ['ConfigService']
    }
  ],
  exports: [
    // Export document service for use in other modules
    DocumentService
  ]
})
export class DocumentModule {}