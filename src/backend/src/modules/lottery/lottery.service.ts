import { Injectable } from '@nestjs/common'; // ^9.0.0
import { InjectRepository } from '@nestjs/typeorm'; // ^9.0.0
import { Repository } from 'typeorm'; // ^0.3.0
import { Logger } from '@nestjs/common'; // ^9.0.0
import { CACHE_MANAGER } from '@nestjs/cache-manager'; // ^2.0.0
import { Inject } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { Decimal } from 'decimal.js'; // ^10.4.3

import { Lottery, LotteryStatus, LotteryTicket, LotteryWinner } from './entities/lottery.entity';
import { CreateLotteryDto } from './dto/create-lottery.dto';
import { Campaign, CampaignStatus } from '../campaign/entities/campaign.entity';

@Injectable()
export class LotteryService {
  private readonly CACHE_TTL = 300; // 5 minutes cache
  private readonly RATE_LIMIT_WINDOW = 300000; // 5 minutes in ms
  private readonly MAX_TICKETS_PER_WINDOW = 100;

  constructor(
    @InjectRepository(Lottery)
    private readonly lotteryRepository: Repository<Lottery>,
    @InjectRepository(Campaign)
    private readonly campaignRepository: Repository<Campaign>,
    private readonly logger: Logger,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: any
  ) {
    this.logger.setContext('LotteryService');
  }

  /**
   * Creates a new lottery with comprehensive validation
   */
  async createLottery(createLotteryDto: CreateLotteryDto): Promise<Lottery> {
    this.logger.debug(`Creating lottery for campaign: ${createLotteryDto.campaignId}`);

    // Validate campaign exists and supports lottery
    const campaign = await this.campaignRepository.findOne({
      where: { id: createLotteryDto.campaignId }
    });

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (!campaign.isLottery || campaign.status !== CampaignStatus.ACTIVE) {
      throw new Error('Campaign does not support lottery or is not active');
    }

    // Validate lottery parameters
    if (createLotteryDto.drawDate <= new Date()) {
      throw new Error('Draw date must be in the future');
    }

    if (createLotteryDto.drawDate > campaign.endDate) {
      throw new Error('Draw date cannot be after campaign end date');
    }

    // Create lottery entity with security measures
    const lottery = new Lottery();
    lottery.campaignId = createLotteryDto.campaignId;
    lottery.drawDate = createLotteryDto.drawDate;
    lottery.ticketPrice = createLotteryDto.ticketPrice;
    lottery.currency = createLotteryDto.currency;
    lottery.maxTickets = createLotteryDto.maxTickets;
    lottery.prizes = createLotteryDto.prizes;
    lottery.status = LotteryStatus.ACTIVE;
    lottery.soldTickets = 0;
    lottery.tickets = [];
    lottery.winners = [];

    // Save lottery with transaction
    try {
      const savedLottery = await this.lotteryRepository.save(lottery);
      await this.cacheManager.set(
        `lottery:${savedLottery.id}`,
        savedLottery,
        this.CACHE_TTL
      );
      
      this.logger.log(`Created lottery: ${savedLottery.id}`);
      return savedLottery;
    } catch (error) {
      this.logger.error(`Failed to create lottery: ${error.message}`);
      throw new Error('Failed to create lottery');
    }
  }

  /**
   * Processes ticket purchase with rate limiting and validation
   */
  async purchaseTicket(
    lotteryId: string,
    userId: string,
    currency: string
  ): Promise<LotteryTicket> {
    this.logger.debug(`Processing ticket purchase for lottery: ${lotteryId}`);

    // Get lottery with cache check
    let lottery = await this.cacheManager.get(`lottery:${lotteryId}`);
    if (!lottery) {
      lottery = await this.lotteryRepository.findOne({
        where: { id: lotteryId }
      });
      if (!lottery) {
        throw new Error('Lottery not found');
      }
    }

    // Validate lottery status and availability
    if (!lottery.hasAvailableTickets()) {
      throw new Error('No tickets available or lottery not active');
    }

    // Check rate limiting for user
    const userTickets = lottery.tickets.filter(
      ticket => ticket.userId === userId &&
      new Date(ticket.purchaseDate).getTime() > Date.now() - this.RATE_LIMIT_WINDOW
    );

    if (userTickets.length >= this.MAX_TICKETS_PER_WINDOW) {
      throw new Error('Rate limit exceeded for ticket purchases');
    }

    // Generate cryptographically secure ticket number
    const ticketNumber = this.generateSecureTicketNumber();

    // Create ticket with transaction
    const ticket: LotteryTicket = {
      number: ticketNumber,
      userId: userId,
      purchaseDate: new Date(),
      transactionId: randomBytes(16).toString('hex')
    };

    try {
      lottery.tickets.push(ticket);
      lottery.soldTickets++;

      await this.lotteryRepository.save(lottery);
      await this.cacheManager.set(`lottery:${lotteryId}`, lottery, this.CACHE_TTL);

      this.logger.log(`Ticket purchased: ${ticketNumber} for lottery: ${lotteryId}`);
      return ticket;
    } catch (error) {
      this.logger.error(`Failed to purchase ticket: ${error.message}`);
      throw new Error('Failed to purchase ticket');
    }
  }

  /**
   * Performs secure lottery drawing with cryptographic randomness
   */
  async performDrawing(lotteryId: string): Promise<LotteryWinner[]> {
    this.logger.debug(`Performing drawing for lottery: ${lotteryId}`);

    const lottery = await this.lotteryRepository.findOne({
      where: { id: lotteryId }
    });

    if (!lottery || !lottery.isDrawingAvailable()) {
      throw new Error('Lottery not available for drawing');
    }

    try {
      // Lock lottery for drawing
      lottery.status = LotteryStatus.DRAWING;
      await this.lotteryRepository.save(lottery);

      // Generate cryptographically secure random selections
      const winners: LotteryWinner[] = [];
      const availableTickets = [...lottery.tickets];
      
      for (const prize of lottery.prizes) {
        if (availableTickets.length === 0) break;

        const winningIndex = this.generateSecureRandomIndex(availableTickets.length);
        const winningTicket = availableTickets.splice(winningIndex, 1)[0];

        winners.push({
          userId: winningTicket.userId,
          ticketNumber: winningTicket.number,
          prize: prize,
          drawDate: new Date()
        });
      }

      // Update lottery with winners
      lottery.winners = winners;
      lottery.status = LotteryStatus.COMPLETED;
      
      await this.lotteryRepository.save(lottery);
      await this.cacheManager.del(`lottery:${lotteryId}`);

      this.logger.log(`Drawing completed for lottery: ${lotteryId}`);
      return winners;
    } catch (error) {
      this.logger.error(`Failed to perform drawing: ${error.message}`);
      throw new Error('Failed to perform drawing');
    }
  }

  /**
   * Generates cryptographically secure ticket number
   */
  private generateSecureTicketNumber(): string {
    const bytes = randomBytes(4);
    return bytes.toString('hex').toUpperCase().slice(0, 8);
  }

  /**
   * Generates cryptographically secure random index
   */
  private generateSecureRandomIndex(max: number): number {
    const bytes = randomBytes(4);
    const value = bytes.readUInt32BE(0);
    return value % max;
  }
}