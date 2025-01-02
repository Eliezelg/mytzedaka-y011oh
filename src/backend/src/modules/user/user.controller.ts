import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  ValidationPipe,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiHeader,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { RateLimit } from '@nestjs/throttler';

import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../decorators/roles.decorator';
import { RolesGuard } from '../../guards/roles.guard';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { AuditLogInterceptor } from '../../interceptors/audit-log.interceptor';
import { User } from './entities/user.entity';

/**
 * Controller handling user-related HTTP requests with enhanced security,
 * multi-language support, and comprehensive validation
 */
@Controller('users')
@ApiTags('users')
@ApiSecurity('jwt')
@UseInterceptors(AuditLogInterceptor)
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * Create new user with enhanced validation and security
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @RateLimit({ points: 5, duration: 60 })
  @ApiOperation({ summary: 'Create new user' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'User created successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  @ApiResponse({ status: HttpStatus.TOO_MANY_REQUESTS, description: 'Rate limit exceeded' })
  async create(@Body(new ValidationPipe({ transform: true })) createUserDto: CreateUserDto): Promise<User> {
    return this.userService.create(createUserDto);
  }

  /**
   * Retrieve users with pagination and filtering
   */
  @Get()
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @RateLimit({ points: 100, duration: 60 })
  @ApiOperation({ summary: 'Get all users' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: ['ADMIN', 'ASSOCIATION', 'DONOR'] })
  @ApiResponse({ status: HttpStatus.OK, description: 'Users retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('role') role?: string
  ): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    return this.userService.findAll(page, limit, role);
  }

  /**
   * Retrieve specific user by ID
   */
  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'ASSOCIATION')
  @RateLimit({ points: 100, duration: 60 })
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'User retrieved successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async findOne(@Param('id') id: string): Promise<User> {
    const user = await this.userService.findOne(id);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  /**
   * Update user profile with validation
   */
  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @RateLimit({ points: 20, duration: 60 })
  @ApiOperation({ summary: 'Update user profile' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'User updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid input data' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ transform: true })) updateUserDto: UpdateUserDto
  ): Promise<User> {
    const updatedUser = await this.userService.update(id, updateUserDto);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    return updatedUser;
  }

  /**
   * Delete user with security checks
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @RateLimit({ points: 10, duration: 60 })
  @ApiOperation({ summary: 'Delete user' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'User deleted successfully' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized access' })
  @ApiResponse({ status: HttpStatus.FORBIDDEN, description: 'Insufficient permissions' })
  async remove(@Param('id') id: string): Promise<void> {
    const result = await this.userService.remove(id);
    if (!result) {
      throw new NotFoundException('User not found');
    }
  }

  /**
   * Update user's preferred language
   */
  @Put(':id/language')
  @UseGuards(RolesGuard)
  @Roles('ADMIN', 'DONOR', 'ASSOCIATION')
  @RateLimit({ points: 20, duration: 60 })
  @ApiOperation({ summary: 'Update user language preference' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: HttpStatus.OK, description: 'Language preference updated successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid language selection' })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, description: 'User not found' })
  async updateLanguage(
    @Param('id') id: string,
    @Body('language') language: string
  ): Promise<User> {
    if (!['en', 'fr', 'he'].includes(language)) {
      throw new BadRequestException('Invalid language selection');
    }
    const updatedUser = await this.userService.updateLanguage(id, language);
    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }
    return updatedUser;
  }
}