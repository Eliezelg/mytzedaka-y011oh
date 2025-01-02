import { 
  Controller, 
  Get, 
  Post, 
  Body, 
  Param, 
  Delete, 
  Put, 
  UseGuards, 
  Query, 
  HttpStatus,
  UseInterceptors,
  ValidationPipe,
  Logger,
  ParseUUIDPipe
} from '@nestjs/common'; // ^10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiBody, 
  ApiSecurity,
  ApiQuery 
} from '@nestjs/swagger'; // ^7.0.0
import { RateLimit } from '@nestjs/throttler'; // ^5.0.0
import { AssociationService } from './association.service';
import { CreateAssociationDto } from './dto/create-association.dto';
import { UpdateAssociationDto } from './dto/update-association.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RoleGuard } from '../auth/guards/role.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';

@Controller('associations')
@ApiTags('associations')
@UseGuards(JwtAuthGuard, RoleGuard)
@ApiSecurity('bearer')
@UseInterceptors(LoggingInterceptor)
export class AssociationController {
  private readonly logger = new Logger(AssociationController.name);

  constructor(private readonly associationService: AssociationService) {}

  @Post()
  @Roles('ADMIN')
  @RateLimit({ ttl: 60, limit: 10 })
  @ApiOperation({ summary: 'Create new association' })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Association created successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.UNAUTHORIZED, 
    description: 'Unauthorized access' 
  })
  async create(
    @Body(new ValidationPipe({ transform: true })) createAssociationDto: CreateAssociationDto
  ) {
    this.logger.log(`Creating new association: ${createAssociationDto.name}`);
    return await this.associationService.create(createAssociationDto);
  }

  @Get()
  @RateLimit({ ttl: 60, limit: 100 })
  @ApiOperation({ summary: 'Get all associations' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'isVerified', required: false, type: Boolean })
  @ApiQuery({ name: 'categories', required: false, isArray: true })
  @ApiQuery({ name: 'language', required: false })
  async findAll(
    @Query('status') status?: string,
    @Query('isVerified') isVerified?: boolean,
    @Query('categories') categories?: string[],
    @Query('language') language?: string
  ) {
    this.logger.log('Retrieving all associations with filters');
    return await this.associationService.findAll({
      status,
      isVerified,
      categories,
      language
    });
  }

  @Get(':id')
  @RateLimit({ ttl: 60, limit: 100 })
  @ApiOperation({ summary: 'Get association by ID' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Association not found' 
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`Retrieving association with ID: ${id}`);
    return await this.associationService.findOne(id);
  }

  @Put(':id')
  @Roles('ADMIN')
  @RateLimit({ ttl: 60, limit: 10 })
  @ApiOperation({ summary: 'Update association' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Association not found' 
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) updateAssociationDto: UpdateAssociationDto
  ) {
    this.logger.log(`Updating association with ID: ${id}`);
    return await this.associationService.update(id, updateAssociationDto);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @RateLimit({ ttl: 60, limit: 5 })
  @ApiOperation({ summary: 'Delete association' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.NO_CONTENT, 
    description: 'Association deleted successfully' 
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`Deleting association with ID: ${id}`);
    await this.associationService.remove(id);
  }

  @Put(':id/verify')
  @Roles('ADMIN')
  @RateLimit({ ttl: 60, limit: 10 })
  @ApiOperation({ summary: 'Verify association' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Association verified successfully' 
  })
  async verify(@Param('id', ParseUUIDPipe) id: string) {
    this.logger.log(`Verifying association with ID: ${id}`);
    return await this.associationService.verifyAssociation(id);
  }

  @Post(':id/payment-gateway')
  @Roles('ADMIN')
  @RateLimit({ ttl: 60, limit: 5 })
  @ApiOperation({ summary: 'Setup payment gateway for association' })
  @ApiParam({ name: 'id', type: 'string', format: 'uuid' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Payment gateway setup successful' 
  })
  async setupPaymentGateway(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe()) gatewayConfig: any
  ) {
    this.logger.log(`Setting up payment gateway for association ID: ${id}`);
    return await this.associationService.setupPaymentGateway(id, gatewayConfig);
  }
}