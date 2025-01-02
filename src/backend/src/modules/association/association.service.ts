import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { CreateAssociationDto } from './dto/create-association.dto';
import { UpdateAssociationDto } from './dto/update-association.dto';
import { Association } from './entities/association.entity';
import * as crypto from 'crypto';

@Injectable()
export class AssociationService {
  private readonly ENCRYPTION_KEY: string;
  private readonly IV_LENGTH = 16;

  constructor(
    @InjectRepository(Association)
    private readonly associationRepository: Repository<Association>,
    private readonly dataSource: DataSource
  ) {
    // Initialize encryption key from secure environment variable
    this.ENCRYPTION_KEY = process.env.ASSOCIATION_ENCRYPTION_KEY;
    if (!this.ENCRYPTION_KEY) {
      throw new Error('Association encryption key not configured');
    }
  }

  /**
   * Encrypts sensitive data using AES-256-GCM
   */
  private encrypt(text: string): string {
    const iv = crypto.randomBytes(this.IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(this.ENCRYPTION_KEY), iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${encrypted.toString('hex')}:${authTag.toString('hex')}`;
  }

  /**
   * Decrypts sensitive data using AES-256-GCM
   */
  private decrypt(encryptedData: string): string {
    const [ivHex, encryptedHex, authTagHex] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(this.ENCRYPTION_KEY), iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  /**
   * Creates a new association with enhanced security validation
   */
  async create(createAssociationDto: CreateAssociationDto): Promise<Association> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Check for existing association
      const existingAssociation = await this.associationRepository.findOne({
        where: [
          { email: createAssociationDto.email },
          { registrationNumber: createAssociationDto.registrationNumber }
        ]
      });

      if (existingAssociation) {
        throw new ConflictException('Association already exists');
      }

      // Validate language support
      if (!createAssociationDto.supportedLanguages.includes(createAssociationDto.primaryLanguage)) {
        throw new BadRequestException('Primary language must be included in supported languages');
      }

      // Create association with encrypted sensitive data
      const association = this.associationRepository.create({
        ...createAssociationDto,
        bankInfo: {
          ...createAssociationDto.bankInfo,
          accountNumber: this.encrypt(createAssociationDto.bankInfo.accountNumber),
          routingNumber: this.encrypt(createAssociationDto.bankInfo.routingNumber),
          swiftCode: createAssociationDto.bankInfo.swiftCode ? 
            this.encrypt(createAssociationDto.bankInfo.swiftCode) : undefined,
          ibanNumber: createAssociationDto.bankInfo.ibanNumber ? 
            this.encrypt(createAssociationDto.bankInfo.ibanNumber) : undefined
        },
        status: 'PENDING',
        isVerified: false
      });

      await queryRunner.manager.save(association);
      await queryRunner.commitTransaction();

      // Remove sensitive data before returning
      delete association.bankInfo;
      return association;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Retrieves all associations with security filtering
   */
  async findAll(filters: {
    status?: string;
    isVerified?: boolean;
    categories?: string[];
    language?: string;
  } = {}): Promise<Association[]> {
    const query = this.associationRepository.createQueryBuilder('association');

    if (filters.status) {
      query.andWhere('association.status = :status', { status: filters.status });
    }

    if (filters.isVerified !== undefined) {
      query.andWhere('association.isVerified = :isVerified', { isVerified: filters.isVerified });
    }

    if (filters.categories?.length) {
      query.andWhere('association.categories && :categories', { categories: filters.categories });
    }

    if (filters.language) {
      query.andWhere('association.supportedLanguages @> ARRAY[:language]', { language: filters.language });
    }

    const associations = await query.getMany();

    // Remove sensitive data
    return associations.map(association => {
      delete association.bankInfo;
      return association;
    });
  }

  /**
   * Updates an association with security validation
   */
  async update(id: string, updateAssociationDto: UpdateAssociationDto): Promise<Association> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const association = await this.associationRepository.findOne({ where: { id } });
      if (!association) {
        throw new NotFoundException('Association not found');
      }

      // Encrypt updated banking information if provided
      if (updateAssociationDto.bankInfo) {
        updateAssociationDto.bankInfo = {
          ...updateAssociationDto.bankInfo,
          accountNumber: updateAssociationDto.bankInfo.accountNumber ? 
            this.encrypt(updateAssociationDto.bankInfo.accountNumber) : association.bankInfo.accountNumber,
          routingNumber: updateAssociationDto.bankInfo.routingNumber ? 
            this.encrypt(updateAssociationDto.bankInfo.routingNumber) : association.bankInfo.routingNumber,
          swiftCode: updateAssociationDto.bankInfo.swiftCode ? 
            this.encrypt(updateAssociationDto.bankInfo.swiftCode) : association.bankInfo.swiftCode,
          ibanNumber: updateAssociationDto.bankInfo.ibanNumber ? 
            this.encrypt(updateAssociationDto.bankInfo.ibanNumber) : association.bankInfo.ibanNumber
        };
      }

      const updatedAssociation = await queryRunner.manager.save(Association, {
        ...association,
        ...updateAssociationDto
      });

      await queryRunner.commitTransaction();

      // Remove sensitive data before returning
      delete updatedAssociation.bankInfo;
      return updatedAssociation;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Removes an association with security checks
   */
  async remove(id: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const association = await this.associationRepository.findOne({ where: { id } });
      if (!association) {
        throw new NotFoundException('Association not found');
      }

      // Perform secure deletion
      await queryRunner.manager.remove(association);
      await queryRunner.commitTransaction();

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Verifies an association's legal status
   */
  async verifyAssociation(id: string): Promise<Association> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const association = await this.associationRepository.findOne({ where: { id } });
      if (!association) {
        throw new NotFoundException('Association not found');
      }

      // Update verification status
      const verifiedAssociation = await queryRunner.manager.save(Association, {
        ...association,
        isVerified: true,
        status: 'ACTIVE'
      });

      await queryRunner.commitTransaction();

      // Remove sensitive data before returning
      delete verifiedAssociation.bankInfo;
      return verifiedAssociation;

    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}