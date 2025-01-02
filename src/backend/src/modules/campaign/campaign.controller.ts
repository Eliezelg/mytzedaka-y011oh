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
  ValidationPipe,
  ParseUUIDPipe,
  HttpStatus,
  BadRequestException,
  ForbiddenException,
  NotFoundException
} from '@nestjs/common'; // ^10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiParam, 
  ApiBody, 
  ApiQuery,
  ApiSecurity 
} from '@nestjs/swagger'; // ^7.0.0
import { JwtAuthGuard } from '@nestjs/jwt'; // ^10.0.0

import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { UpdateCampaignDto, CampaignStatus } from './dto/update-campaign.dto';
import { Roles } from '../../decorators/roles.decorator';

@ApiTags('campaigns')
@Controller('campaigns')
@UseGuards(JwtAuthGuard)
@ApiSecurity('jwt')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @Roles('ASSOCIATION', 'ADMIN')
  @ApiOperation({ summary: 'Create new campaign' })
  @ApiBody({ type: CreateCampaignDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Campaign created successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Insufficient permissions' 
  })
  async create(@Body(new ValidationPipe({ transform: true })) createCampaignDto: CreateCampaignDto) {
    try {
      return await this.campaignService.create(createCampaignDto);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  @ApiOperation({ summary: 'List all campaigns with filtering' })
  @ApiQuery({ name: 'status', enum: CampaignStatus, required: false })
  @ApiQuery({ name: 'currency', required: false })
  @ApiQuery({ name: 'associationId', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'isLottery', required: false, type: Boolean })
  @ApiQuery({ name: 'active', required: false, type: Boolean })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'List of campaigns retrieved successfully' 
  })
  async findAll(
    @Query('status') status?: CampaignStatus,
    @Query('currency') currency?: string,
    @Query('associationId') associationId?: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('isLottery') isLottery?: boolean,
    @Query('active') active?: boolean
  ) {
    const filters = {
      status,
      currency,
      associationId,
      isLottery,
      active
    };
    return await this.campaignService.findAll(filters, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  @ApiParam({ name: 'id', type: String, description: 'Campaign UUID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Campaign retrieved successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Campaign not found' 
  })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.campaignService.findOne(id);
    } catch (error) {
      throw new NotFoundException('Campaign not found');
    }
  }

  @Put(':id')
  @Roles('ASSOCIATION', 'ADMIN')
  @ApiOperation({ summary: 'Update campaign' })
  @ApiParam({ name: 'id', type: String, description: 'Campaign UUID' })
  @ApiBody({ type: UpdateCampaignDto })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Campaign updated successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Insufficient permissions' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Campaign not found' 
  })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ValidationPipe({ transform: true })) updateCampaignDto: UpdateCampaignDto
  ) {
    try {
      return await this.campaignService.update(id, updateCampaignDto);
    } catch (error) {
      if (error.message === 'Campaign not found') {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Delete(':id')
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Delete campaign' })
  @ApiParam({ name: 'id', type: String, description: 'Campaign UUID' })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Campaign deleted successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Insufficient permissions' 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Campaign not found' 
  })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.campaignService.remove(id);
    } catch (error) {
      if (error.message === 'Campaign not found') {
        throw new NotFoundException(error.message);
      }
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/lottery/:action')
  @Roles('ASSOCIATION', 'ADMIN')
  @ApiOperation({ summary: 'Manage campaign lottery' })
  @ApiParam({ name: 'id', type: String, description: 'Campaign UUID' })
  @ApiParam({ name: 'action', enum: ['draw', 'cancel', 'verify'] })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Lottery action processed successfully' 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid lottery action' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Insufficient permissions' 
  })
  async manageLottery(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('action') action: 'draw' | 'cancel' | 'verify'
  ) {
    try {
      return await this.campaignService.manageLottery(id, action);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post(':id/progress')
  @Roles('ASSOCIATION', 'ADMIN')
  @ApiOperation({ summary: 'Update campaign progress' })
  @ApiParam({ name: 'id', type: String, description: 'Campaign UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string' }
      }
    }
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Campaign progress updated successfully' 
  })
  async updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('amount') amount: number,
    @Body('currency') currency: string
  ) {
    try {
      return await this.campaignService.updateProgress(id, amount, currency);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
}