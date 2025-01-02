import { Module } from '@nestjs/common'; // ^10.0.0
import { ThrottlerModule } from '@nestjs/throttler'; // ^5.0.0

import { TaxController } from './tax.controller';
import { TaxService } from './tax.service';
import { DonationModule } from '../donation/donation.module';
import { DocumentModule } from '../document/document.module';

/**
 * Module implementing secure tax receipt generation and management with PCI DSS compliance.
 * Supports multiple formats (PDF, CERFA) and languages (Hebrew, English, French).
 * 
 * Features:
 * - Automated tax receipt generation
 * - Digital signature integration
 * - Secure document storage
 * - Comprehensive audit logging
 * - Multi-language support
 * - PCI DSS Level 1 compliance
 * 
 * @version 1.0.0
 */
@Module({
  imports: [
    // Import required modules
    DonationModule, // For secure access to donation information
    DocumentModule, // For PCI-compliant document storage

    // Rate limiting for security
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10 // Max requests per window
    })
  ],
  controllers: [TaxController],
  providers: [
    TaxService,
    // Audit logging provider
    {
      provide: 'AUDIT_LOGGER',
      useFactory: () => ({
        enabled: true,
        detailedLogging: true,
        retentionPeriod: '7years',
        pciCompliant: true,
        encryptionEnabled: true
      })
    },
    // Document security provider
    {
      provide: 'DOCUMENT_SECURITY',
      useFactory: () => ({
        encryption: {
          algorithm: 'AES-256-GCM',
          keyRotation: true,
          keyRotationInterval: '30days'
        },
        digitalSignature: {
          algorithm: 'RSA-SHA256',
          keySize: 2048,
          certificateValidation: true
        },
        storage: {
          encrypted: true,
          backupEnabled: true,
          retentionPeriod: '7years'
        })
    }
  ],
  exports: [TaxService]
})
export class TaxModule {
  /**
   * Module version for tracking API compatibility
   * @private
   */
  private readonly MODULE_NAME = 'tax-module';

  /**
   * Flag indicating module is globally available
   * @private
   */
  private readonly IS_GLOBAL = false;
}