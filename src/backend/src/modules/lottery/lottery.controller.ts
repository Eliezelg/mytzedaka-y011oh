import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  Param, 
  UseGuards, 
  Put,
  UseInterceptors,
  HttpStatus,
  HttpException,
  ParseUUIDPipe,
  ValidationPipe
} from '@nestjs/common'; // ^9.0.0

import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiSecurity,
  ApiBearerAuth,
  ApiParam,
  ApiBody 
} from '@nestjs/swagger'; // ^6.0.0

import { AuthGuard } from '@nestjs/passport'; // ^9.0.0
import { RateLimit } from '@nestjs/throttler'; // ^4.0.0
import { Roles } from '../../decorators/roles.decorator';
import { RoleGuard } from '../../guards/role.guard';
import { LoggingInterceptor } from '../../interceptors/logging.interceptor';
import { CacheInterceptor } from '../../interceptors/cache.interceptor';

import { LotteryService } from './lottery.service';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { Lottery, LotteryTicket, LotteryWinner } from './entities/lottery.entity';

/**
 * Controller handling lottery-related operations with enhanced security and validation
 */
@Controller('lotteries')
@ApiTags('Lottery')
@ApiBearerAuth()
@ApiSecurity('jwt')
@UseGuards(AuthGuard('jwt'), RoleGuard)
@UseInterceptors(LoggingInterceptor, CacheInterceptor)
export class LotteryController {
  constructor(private readonly lotteryService: LotteryService) {}

  /**
   * Creates a new lottery for a campaign with comprehensive validation
   */
  @Post()
  @Roles('admin', 'association')
  @ApiOperation({ summary: 'Create new lottery for campaign' })
  @ApiBody({ type: CreateLotteryDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Lottery created successfully',
    type: Lottery 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid input data' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Insufficient permissions' 
  })
  async createLottery(
    @Body(new ValidationPipe({ transform: true })) createLotteryDto: CreateLotteryDto
  ): Promise<Lottery> {
    try {
      return await this.lotteryService.createLottery(createLotteryDto);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to create lottery',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Processes ticket purchase with rate limiting and security checks
   */
  @Post(':lotteryId/tickets')
  @RateLimit({ ttl: 60, limit: 5 })
  @ApiOperation({ summary: 'Purchase lottery ticket' })
  @ApiParam({ name: 'lotteryId', type: String })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Ticket purchased successfully',
    type: LotteryTicket 
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid lottery ID or no tickets available' 
  })
  @ApiResponse({ 
    status: HttpStatus.TOO_MANY_REQUESTS, 
    description: 'Rate limit exceeded' 
  })
  async purchaseTicket(
    @Param('lotteryId', ParseUUIDPipe) lotteryId: string,
    @Body('userId', ParseUUIDPipe) userId: string,
    @Body('currency') currency: string
  ): Promise<LotteryTicket> {
    try {
      return await this.lotteryService.purchaseTicket(lotteryId, userId, currency);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to purchase ticket',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Performs secure lottery drawing with cryptographic randomness
   */
  @Put(':lotteryId/draw')
  @Roles('admin')
  @ApiOperation({ summary: 'Perform lottery drawing' })
  @ApiParam({ name: 'lotteryId', type: String })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Drawing completed successfully',
    type: [LotteryWinner]
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: 'Invalid lottery ID or drawing not available' 
  })
  @ApiResponse({ 
    status: HttpStatus.FORBIDDEN, 
    description: 'Insufficient permissions' 
  })
  async performDrawing(
    @Param('lotteryId', ParseUUIDPipe) lotteryId: string
  ): Promise<LotteryWinner[]> {
    try {
      return await this.lotteryService.performDrawing(lotteryId);
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to perform drawing',
        error.status || HttpStatus.BAD_REQUEST
      );
    }
  }

  /**
   * Retrieves lottery details with caching
   */
  @Get(':lotteryId')
  @ApiOperation({ summary: 'Get lottery details' })
  @ApiParam({ name: 'lotteryId', type: String })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: 'Lottery details retrieved successfully',
    type: Lottery 
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: 'Lottery not found' 
  })
  async getLotteryDetails(
    @Param('lotteryId', ParseUUIDPipe) lotteryId: string
  ): Promise<Lottery> {
    try {
      const lottery = await this.lotteryService.getLotteryDetails(lotteryId);
      if (!lottery) {
        throw new HttpException('Lottery not found', HttpStatus.NOT_FOUND);
      }
      return lottery;
    } catch (error) {
      throw new HttpException(
        error.message || 'Failed to retrieve lottery details',
        error.status || HttpStatus.NOT_FOUND
      );
    }
  }
}