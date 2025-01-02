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
  Matches, 
  IsEnum 
} from 'class-validator'; // ^0.14.0
import { Type, Transform } from 'class-transformer'; // ^0.5.1
import { 
  AssociationAddress, 
  AssociationLegalInfo, 
  AssociationBankInfo 
} from '../entities/association.entity';

/**
 * Enum for Jewish organization types
 */
export enum JewishOrganizationType {
  SYNAGOGUE = 'SYNAGOGUE',
  YESHIVA = 'YESHIVA',
  KOLLEL = 'KOLLEL',
  CHARITY = 'CHARITY',
  EDUCATIONAL = 'EDUCATIONAL',
  COMMUNITY = 'COMMUNITY',
  OTHER = 'OTHER'
}

/**
 * DTO for validating association address with Israeli address format support
 */
export class CreateAssociationAddressDto implements AssociationAddress {
  @IsString()
  @Length(5, 100)
  @Matches(/^[\u0590-\u05ff\w\s-,.]+$/, {
    message: 'Street must contain valid Hebrew or English characters'
  })
  street: string;

  @IsString()
  @Length(2, 50)
  @Matches(/^[\u0590-\u05ff\w\s-]+$/, {
    message: 'City must contain valid Hebrew or English characters'
  })
  city: string;

  @IsString()
  @Length(2, 50)
  @IsOptional()
  state: string;

  @IsString()
  @Length(2, 50)
  country: string;

  @IsString()
  @Matches(/^\d{5}(?:[-\s]\d{2})?$/, {
    message: 'Invalid postal code format'
  })
  postalCode: string;
}

/**
 * DTO for validating association legal information with Israeli non-profit requirements
 */
export class CreateAssociationLegalInfoDto implements AssociationLegalInfo {
  @IsString()
  @Matches(/^(AMUTA|COMPANY|FOREIGN)$/, {
    message: 'Registration type must be AMUTA, COMPANY, or FOREIGN'
  })
  registrationType: string;

  @IsString()
  @Length(2, 50)
  registrationCountry: string;

  @Type(() => Date)
  registrationDate: Date;

  @IsString()
  @Matches(/^\d{9}$/, {
    message: 'Tax exemption number must be 9 digits'
  })
  taxExemptionNumber: string;

  @IsString()
  @Matches(/^\d{9}$/, {
    message: 'Nihul Takin certificate number must be 9 digits'
  })
  @IsOptional()
  nihulTakinCertificate?: string;
}

/**
 * DTO for validating association banking information with Israeli bank account format
 */
export class CreateAssociationBankInfoDto implements AssociationBankInfo {
  @IsString()
  @Length(2, 100)
  bankName: string;

  @IsString()
  @Matches(/^\d{2}$/, {
    message: 'Bank code must be 2 digits'
  })
  bankCode: string;

  @IsString()
  @Matches(/^\d{3}$/, {
    message: 'Branch number must be 3 digits'
  })
  branchNumber: string;

  @IsString()
  @Matches(/^\d{6,10}$/, {
    message: 'Account number must be between 6 and 10 digits'
  })
  accountNumber: string;

  @IsString()
  @Matches(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, {
    message: 'Invalid SWIFT/BIC code format'
  })
  @IsOptional()
  swiftCode?: string;

  @IsString()
  @Matches(/^IL\d{2}\d{19}$/, {
    message: 'Invalid Israeli IBAN format'
  })
  @IsOptional()
  ibanNumber?: string;
}

/**
 * DTO for validating new association creation requests with enhanced Israeli market support
 */
export class CreateAssociationDto {
  @IsString()
  @Length(2, 100)
  @Matches(/^[\u0590-\u05ff\w\s-]+$/, {
    message: 'Name must contain valid Hebrew or English characters'
  })
  @Transform(({ value }) => value.trim())
  name: string;

  @IsString()
  @Length(2, 100)
  @Matches(/^[\u0590-\u05ff\s-]+$/, {
    message: 'Hebrew name must contain only Hebrew characters'
  })
  @IsOptional()
  hebrewName?: string;

  @IsEmail()
  email: string;

  @IsPhoneNumber()
  @Matches(/^(\+972|0)[2-9]\d{7,8}$/, {
    message: 'Invalid Israeli phone number format'
  })
  phone: string;

  @IsString()
  @Length(10, 1000)
  @IsOptional()
  description?: string;

  @IsString()
  @Length(10, 1000)
  @Matches(/^[\u0590-\u05ff\s\d\p{P}]+$/u, {
    message: 'Hebrew description must contain only Hebrew characters'
  })
  @IsOptional()
  hebrewDescription?: string;

  @IsUrl()
  @IsOptional()
  website?: string;

  @IsString()
  @Matches(/^[5-8]\d{8}$/, {
    message: 'Invalid Israeli registration number (must start with 5-8 and be 9 digits)'
  })
  @Transform(({ value }) => value.replace(/\D/g, ''))
  registrationNumber: string;

  @IsString()
  @Matches(/^\d{9}$/, {
    message: 'Tax ID must be 9 digits'
  })
  @Transform(({ value }) => value.replace(/\D/g, ''))
  taxId: string;

  @ValidateNested()
  @Type(() => CreateAssociationAddressDto)
  address: CreateAssociationAddressDto;

  @ValidateNested()
  @Type(() => CreateAssociationLegalInfoDto)
  legalInfo: CreateAssociationLegalInfoDto;

  @ValidateNested()
  @Type(() => CreateAssociationBankInfoDto)
  bankInfo: CreateAssociationBankInfoDto;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  categories?: string[];

  @IsString()
  @Matches(/^(he|en|fr)$/, {
    message: 'Primary language must be he, en, or fr'
  })
  primaryLanguage: string;

  @IsArray()
  @IsString({ each: true })
  @Matches(/^(he|en|fr)$/, { each: true, message: 'Supported languages must be he, en, or fr' })
  supportedLanguages: string[];

  @IsArray()
  @IsString({ each: true })
  @Matches(/^(ILS|USD|EUR)$/, { each: true, message: 'Supported currencies must be ILS, USD, or EUR' })
  supportedCurrencies: string[];

  @IsEnum(JewishOrganizationType)
  @IsOptional()
  organizationType?: JewishOrganizationType;
}