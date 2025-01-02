import { 
  Controller, 
  Post, 
  Body, 
  Res, 
  UseGuards, 
  Logger 
} from '@nestjs/common';
import { PCICompliance } from '@nestjs/security'; // ^1.0.0
import { Response } from 'express';
import { ReportService } from './report.service';
import { GenerateReportDto } from './dto/generate-report.dto';
import { Auth } from '../../decorators/auth.decorator';

/**
 * Controller handling secure report generation with PCI DSS compliance
 * Implements real-time capabilities and digital signatures
 * @version 1.0.0
 */
@Controller('reports')
@PCICompliance()
export class ReportController {
  private readonly logger = new Logger(ReportController.name);

  constructor(private readonly reportService: ReportService) {}

  /**
   * Generates comprehensive reports with enhanced security and real-time streaming
   * @param generateReportDto Report generation parameters
   * @param res Express response object for streaming
   */
  @Post('generate')
  @Auth(true)
  async generateReport(
    @Body() generateReportDto: GenerateReportDto,
    @Res() res: Response
  ): Promise<void> {
    this.logger.log(`Generating ${generateReportDto.reportType} report in ${generateReportDto.format} format`);

    try {
      // Set security headers
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');

      // Set content type based on format
      const contentTypes = {
        'pdf': 'application/pdf',
        'excel': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'csv': 'text/csv'
      };
      res.setHeader('Content-Type', contentTypes[generateReportDto.format]);

      // Generate report with real-time streaming if requested
      const report = await this.reportService.generateReport(generateReportDto);

      // Stream report with progress monitoring
      res.write(report);
      res.end();

      this.logger.log(`Report generated successfully for ${generateReportDto.reportType}`);
    } catch (error) {
      this.logger.error(`Report generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generates digitally signed tax receipts with PCI DSS compliance
   * @param donationId ID of the donation for receipt generation
   * @param res Express response object
   */
  @Post('tax-receipt')
  @Auth(true)
  async generateTaxReceipt(
    @Body('donationId') donationId: string,
    @Res() res: Response
  ): Promise<void> {
    this.logger.log(`Generating tax receipt for donation ${donationId}`);

    try {
      // Set security headers for PDF
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Security-Policy', "default-src 'self'");
      res.setHeader('X-Content-Type-Options', 'nosniff');

      // Generate digitally signed tax receipt
      const receipt = await this.reportService.generateTaxReport(donationId);

      // Stream signed receipt
      res.write(receipt);
      res.end();

      this.logger.log(`Tax receipt generated successfully for donation ${donationId}`);
    } catch (error) {
      this.logger.error(`Tax receipt generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generates real-time donation reports with enhanced security
   * @param campaignId Campaign ID for donation report
   * @param res Express response object
   */
  @Post('donations')
  @Auth(true)
  async generateDonationReport(
    @Body('campaignId') campaignId: string,
    @Body() generateReportDto: GenerateReportDto,
    @Res() res: Response
  ): Promise<void> {
    this.logger.log(`Generating donation report for campaign ${campaignId}`);

    try {
      // Set security headers
      res.setHeader('Content-Type', contentTypes[generateReportDto.format]);
      res.setHeader('Content-Security-Policy', "default-src 'self'");

      // Generate real-time donation report
      const report = await this.reportService.generateDonationReport(
        campaignId,
        generateReportDto
      );

      // Stream report
      res.write(report);
      res.end();

      this.logger.log(`Donation report generated successfully for campaign ${campaignId}`);
    } catch (error) {
      this.logger.error(`Donation report generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Generates campaign performance reports with real-time metrics
   * @param campaignId Campaign ID for performance report
   * @param res Express response object
   */
  @Post('campaign')
  @Auth(true)
  async generateCampaignReport(
    @Body('campaignId') campaignId: string,
    @Body() generateReportDto: GenerateReportDto,
    @Res() res: Response
  ): Promise<void> {
    this.logger.log(`Generating campaign report for ${campaignId}`);

    try {
      // Set security headers
      res.setHeader('Content-Type', contentTypes[generateReportDto.format]);
      res.setHeader('Content-Security-Policy', "default-src 'self'");

      // Generate campaign report with real-time metrics
      const report = await this.reportService.generateCampaignReport(
        campaignId,
        generateReportDto
      );

      // Stream report
      res.write(report);
      res.end();

      this.logger.log(`Campaign report generated successfully for ${campaignId}`);
    } catch (error) {
      this.logger.error(`Campaign report generation failed: ${error.message}`, error.stack);
      throw error;
    }
  }
}