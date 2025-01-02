import { Module } from '@nestjs/common'; // ^10.0.0
import { TypeOrmModule } from '@nestjs/typeorm'; // ^10.0.0
import { ConfigModule } from '@nestjs/config'; // ^10.0.0

// Internal imports
import { AssociationController } from './association.controller';
import { AssociationService } from './association.service';
import { Association } from './entities/association.entity';

/**
 * AssociationModule configures and exports the Association feature with:
 * - Secure association management
 * - Data protection through field-level encryption
 * - Multi-language support (Hebrew, English, French)
 * - Integrated payment gateway capabilities (Stripe Connect, Tranzilla)
 */
@Module({
  imports: [
    // Register Association entity with TypeORM for secure data persistence
    TypeOrmModule.forFeature([Association]),
    
    // Import ConfigModule for payment gateway credentials
    ConfigModule.forRoot({
      isGlobal: false,
      envFilePath: '.env',
      validate: true,
      validationSchema: {
        ASSOCIATION_ENCRYPTION_KEY: {
          type: 'string',
          required: true
        },
        STRIPE_API_KEY: {
          type: 'string',
          required: true
        },
        TRANZILLA_TERMINAL_ID: {
          type: 'string',
          required: true
        }
      }
    })
  ],
  controllers: [AssociationController],
  providers: [AssociationService],
  exports: [AssociationService] // Export service for use in other modules
})
export class AssociationModule {}