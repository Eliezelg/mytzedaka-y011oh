import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserSchema } from './schemas/user.schema';

/**
 * User management module with enhanced security features, RBAC support,
 * and optimized MongoDB integration for the International Jewish Association Donation Platform.
 * 
 * Features:
 * - Role-based access control (RBAC)
 * - Multi-language support (Hebrew, English, French)
 * - Rate limiting protection
 * - Secure data handling with field-level encryption
 * - Optimized MongoDB indexing
 */
@Module({
  imports: [
    // Configure MongoDB with optimized indexes and collation for case-insensitive queries
    MongooseModule.forFeatureAsync([
      {
        name: 'User',
        useFactory: () => {
          const schema = UserSchema;
          
          // Optimize email queries with case-insensitive unique index
          schema.index(
            { email: 1 }, 
            { 
              unique: true, 
              collation: { locale: 'en', strength: 2 },
              background: true 
            }
          );

          // Optimize role-based queries
          schema.index(
            { role: 1, createdAt: -1 }, 
            { background: true }
          );

          // Optimize security-related queries
          schema.index(
            { isVerified: 1, failedLoginAttempts: 1 }, 
            { background: true }
          );

          // Optimize language-based queries
          schema.index(
            { preferredLanguage: 1 }, 
            { background: true }
          );

          return schema;
        }
      }
    ]),

    // Configure rate limiting protection
    ThrottlerModule.forRoot({
      ttl: 60, // Time window in seconds
      limit: 10, // Maximum number of requests per time window
    }),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    // Apply rate limiting globally
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    }
  ],
  exports: [UserService] // Export UserService for use in other modules
})
export class UserModule {}