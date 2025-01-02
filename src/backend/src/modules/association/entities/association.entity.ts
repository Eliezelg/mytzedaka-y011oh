import { 
  Entity, 
  Column, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn 
} from 'typeorm'; // ^0.3.17
import { 
  IsString, 
  IsEmail, 
  IsOptional, 
  IsBoolean, 
  ValidateNested, 
  IsDate 
} from 'class-validator'; // ^0.14.0
import { 
  Exclude, 
  Transform 
} from 'class-transformer'; // ^0.5.1
import { 
  PaymentMethodType, 
  PaymentStatus 
} from '../../interfaces/payment-gateway.interface';

/**
 * Represents the physical address of an association
 */
class AssociationAddress {
  @IsString()
  street: string;

  @IsString()
  city: string;

  @IsString()
  state: string;

  @IsString()
  country: string;

  @IsString()
  postalCode: string;
}

/**
 * Contains legal registration information for an association
 */
class AssociationLegalInfo {
  @IsString()
  registrationType: string;

  @IsDate()
  registrationDate: Date;

  @IsString()
  registrationCountry: string;

  @IsString()
  @IsOptional()
  taxExemptionNumber?: string;

  @IsBoolean()
  isNonProfit: boolean;
}

/**
 * Encrypted banking information for secure storage
 */
@Exclude()
class AssociationBankInfo {
  @IsString()
  bankName: string;

  @IsString()
  accountNumber: string;

  @IsString()
  routingNumber: string;

  @IsString()
  swiftCode: string;

  @IsString()
  @IsOptional()
  ibanNumber?: string;
}

/**
 * Payment gateway configurations with encryption
 */
@Exclude()
class AssociationPaymentGateways {
  @ValidateNested()
  stripe?: {
    accountId: string;
    publicKey: string;
    secretKey: string;
    webhookSecret: string;
    enabledMethods: PaymentMethodType[];
  };

  @ValidateNested()
  tranzilla?: {
    terminalId: string;
    username: string;
    password: string;
    supplierNumber: string;
    enabledMethods: PaymentMethodType[];
  };
}

/**
 * Entity class representing a Jewish charitable association
 * Implements comprehensive data validation and secure handling of sensitive information
 */
@Entity('associations')
export class Association {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @IsString()
  @Transform(({ value }) => value.trim())
  name: string;

  @Column({ unique: true })
  @IsEmail()
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @Column()
  @IsString()
  phone: string;

  @Column('text')
  @IsString()
  @IsOptional()
  description?: string;

  @Column()
  @IsString()
  @IsOptional()
  website?: string;

  @Column()
  @IsString()
  registrationNumber: string;

  @Column()
  @IsString()
  taxId: string;

  @Column('json')
  @ValidateNested()
  address: AssociationAddress;

  @Column('json')
  @ValidateNested()
  legalInfo: AssociationLegalInfo;

  @Column('json')
  @ValidateNested()
  @Exclude()
  bankInfo: AssociationBankInfo;

  @Column('simple-array')
  categories: string[];

  @Column()
  @IsString()
  primaryLanguage: string;

  @Column('simple-array')
  supportedLanguages: string[];

  @Column('json')
  @ValidateNested()
  @Exclude()
  paymentGateways: AssociationPaymentGateways;

  @Column()
  @IsBoolean()
  isVerified: boolean;

  @Column()
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'INACTIVE';

  @CreateDateColumn()
  @IsDate()
  createdAt: Date;

  @UpdateDateColumn()
  @IsDate()
  updatedAt: Date;
}