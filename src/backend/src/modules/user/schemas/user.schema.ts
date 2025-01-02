import { Schema, Prop, SchemaIndex } from '@nestjs/mongoose'; // @nestjs/mongoose ^10.0.0
import { Document } from 'mongoose'; // mongoose ^7.5.0
import { Roles } from '../../../constants/roles.constant';

/**
 * MongoDB schema definition for user data model in the International Jewish Association Donation Platform.
 * Implements comprehensive user management with security features, RBAC, and GDPR compliance.
 * 
 * Features:
 * - Role-based access control
 * - Multi-language support (en, fr, he)
 * - Two-factor authentication
 * - Security tracking and rate limiting
 * - GDPR compliance
 * - Performance optimizations via strategic indexing
 */
@Schema({ timestamps: true })
@SchemaIndex({ email: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })
@SchemaIndex({ role: 1, createdAt: -1 })
@SchemaIndex({ lastLoginAt: -1 })
export class UserSchema extends Document {
  @Prop({ 
    required: true, 
    unique: true, 
    index: true, 
    lowercase: true 
  })
  email: string;

  @Prop({ 
    required: true, 
    minlength: 12, 
    select: false 
  })
  password: string;

  @Prop({ 
    required: true, 
    trim: true, 
    maxlength: 100 
  })
  firstName: string;

  @Prop({ 
    required: true, 
    trim: true, 
    maxlength: 100 
  })
  lastName: string;

  @Prop({ 
    validate: /^\+[1-9]\d{1,14}$/ 
  })
  phoneNumber?: string;

  @Prop({ 
    type: String, 
    enum: Roles, 
    default: Roles.DONOR, 
    index: true 
  })
  role: Roles;

  @Prop({ 
    type: String, 
    enum: ['en', 'fr', 'he'], 
    default: 'en' 
  })
  preferredLanguage: string;

  @Prop({ 
    default: false, 
    index: true 
  })
  isVerified: boolean;

  @Prop({ 
    select: false 
  })
  refreshToken?: string;

  @Prop()
  refreshTokenExpiresAt?: Date;

  @Prop({ 
    default: false 
  })
  twoFactorEnabled: boolean;

  @Prop({ 
    select: false 
  })
  twoFactorSecret?: string;

  @Prop({ 
    index: true 
  })
  lastLoginAt?: Date;

  @Prop()
  lastLoginIP?: string;

  @Prop({ 
    default: 0 
  })
  failedLoginAttempts: number;

  @Prop()
  lockoutUntil?: Date;

  @Prop({ 
    required: true 
  })
  gdprConsent: boolean;

  @Prop({ 
    required: true 
  })
  gdprConsentDate: Date;
}