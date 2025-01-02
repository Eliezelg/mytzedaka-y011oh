import { 
  IsString, 
  IsEmail, 
  IsPhoneNumber, 
  IsOptional, 
  IsArray, 
  ValidateNested, 
  IsBoolean, 
  IsUrl, 
  Length, 
  Matches 
} from 'class-validator'; // ^0.14.0
import { Type, PartialType } from 'class-transformer'; // ^0.5.1
import { PartialType as MappedPartialType } from '@nestjs/mapped-types'; // ^2.0.0
import { 
  AssociationAddress, 
  AssociationLegalInfo, 
  AssociationBankInfo 
} from '../entities/association.entity';

/**
 * DTO for updating association address information
 */
export class UpdateAssociationAddressDto implements Partial<AssociationAddress> {
  @IsString()
  @Length(2, 100)
  @IsOptional()
  street?: string;

  @IsString()
  @Length(2, 50)
  @IsOptional()
  city?: string;

  @IsString()
  @Length(2, 50)
  @IsOptional()
  state?: string;

  @IsString()
  @Length(2, 50)
  @IsOptional()
  country?: string;

  @IsString()
  @Matches(/^[A-Z0-9\s-]+$/i, { message: 'Invalid postal code format' })
  @IsOptional()
  postalCode?: string;
}

/**
 * DTO for updating association legal information
 */
export class UpdateAssociationLegalInfoDto implements Partial<AssociationLegalInfo> {
  @IsString()
  @Length(2, 50)
  @IsOptional()
  registrationType?: string;

  @IsString()
  @IsOptional()
  registrationDate?: Date;

  @IsString()
  @Length(2, 50)
  @IsOptional()
  registrationCountry?: string;

  @IsString()
  @Matches(/^[A-Z0-9-]+$/i, { message: 'Invalid tax exemption number format' })
  @IsOptional()
  taxExemptionNumber?: string;

  @IsBoolean()
  @IsOptional()
  isNonProfit?: boolean;
}

/**
 * DTO for updating association bank information with enhanced security patterns
 */
export class UpdateAssociationBankInfoDto implements Partial<AssociationBankInfo> {
  @IsString()
  @Length(2, 100)
  @IsOptional()
  bankName?: string;

  @IsString()
  @Matches(/^[0-9-]+$/, { message: 'Invalid account number format' })
  @IsOptional()
  accountNumber?: string;

  @IsString()
  @Matches(/^[0-9-]+$/, { message: 'Invalid routing number format' })
  @IsOptional()
  routingNumber?: string;

  @IsString()
  @Matches(/^[A-Z0-9]+$/, { message: 'Invalid SWIFT code format' })
  @IsOptional()
  swiftCode?: string;

  @IsString()
  @Matches(/^[A-Z0-9]+$/, { message: 'Invalid IBAN format' })
  @IsOptional()
  ibanNumber?: string;
}

/**
 * Main DTO for updating association information
 * Implements comprehensive validation with enhanced security patterns
 */
export class UpdateAssociationDto {
  @IsString()
  @Length(2, 100)
  @IsOptional()
  name?: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @IsString()
  @Length(10, 1000)
  @IsOptional()
  description?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsString()
  @Matches(/^[A-Z0-9-]+$/, { message: 'Invalid registration number format' })
  @IsOptional()
  registrationNumber?: string;

  @IsString()
  @Matches(/^[A-Z0-9-]+$/, { message: 'Invalid tax ID format' })
  @IsOptional()
  taxId?: string;

  @ValidateNested()
  @Type(() => UpdateAssociationAddressDto)
  @IsOptional()
  address?: UpdateAssociationAddressDto;

  @ValidateNested()
  @Type(() => UpdateAssociationLegalInfoDto)
  @IsOptional()
  legalInfo?: UpdateAssociationLegalInfoDto;

  @ValidateNested()
  @Type(() => UpdateAssociationBankInfoDto)
  @IsOptional()
  bankInfo?: UpdateAssociationBankInfoDto;

  @IsArray()
  @IsString({ each: true })
  @Length(2, 50, { each: true })
  @IsOptional()
  categories?: string[];

  @IsString()
  @Matches(/^(he|en|fr)$/, { message: 'Language must be he, en, or fr' })
  @IsOptional()
  primaryLanguage?: string;

  @IsArray()
  @IsString({ each: true })
  @Matches(/^(he|en|fr)$/, { each: true, message: 'Supported languages must be he, en, or fr' })
  @IsOptional()
  supportedLanguages?: string[];

  @IsBoolean()
  @IsOptional()
  isVerified?: boolean;

  @IsString()
  @Matches(/^(ACTIVE|SUSPENDED|PENDING|INACTIVE)$/, { message: 'Invalid status value' })
  @IsOptional()
  status?: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'INACTIVE';
}