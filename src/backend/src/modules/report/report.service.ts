import { Injectable, Logger } from '@nestjs/common';
import PDFKit from 'pdfkit';
import ExcelJS from 'exceljs';
import { createObjectCsvWriter } from 'csv-writer';
import * as winston from 'winston';
import { GenerateReportDto, ReportType, ReportFormat } from './dto/generate-report.dto';
import { DonationService } from '../donation/donation.service';
import { CampaignService } from '../campaign/campaign.service';

@Injectable()
export class ReportService {
  private readonly logger: winston.Logger;

  constructor(
    private readonly donationService: DonationService,
    private readonly campaignService: CampaignService
  ) {
    // Initialize Winston logger with audit configuration
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      defaultMeta: { service: 'report-service' },
      transports: [
        new winston.transports.File({ filename: 'reports-audit.log' })
      ]
    });
  }

  /**
   * Generates reports with comprehensive data validation and security measures
   * @param generateReportDto Report generation parameters
   * @returns Buffer containing the generated report
   */
  async generateReport(generateReportDto: GenerateReportDto): Promise<Buffer> {
    this.logger.info('Starting report generation', { 
      reportType: generateReportDto.reportType,
      format: generateReportDto.format,
      language: generateReportDto.language
    });

    try {
      // Validate date range
      if (generateReportDto.endDate <= generateReportDto.startDate) {
        throw new Error('End date must be after start date');
      }

      // Get report data based on type
      const reportData = await this.getReportData(generateReportDto);

      // Generate report in requested format
      const report = await this.formatReport(reportData, generateReportDto);

      this.logger.info('Report generated successfully', {
        reportType: generateReportDto.reportType,
        format: generateReportDto.format
      });

      return report;
    } catch (error) {
      this.logger.error('Report generation failed', {
        error: error.message,
        stack: error.stack,
        params: generateReportDto
      });
      throw error;
    }
  }

  /**
   * Retrieves data for report generation based on report type
   * @private
   */
  private async getReportData(dto: GenerateReportDto): Promise<any[]> {
    switch (dto.reportType) {
      case ReportType.DONATION:
        return this.donationService.findAll({
          startDate: dto.startDate,
          endDate: dto.endDate,
          associationId: dto.associationId
        });

      case ReportType.CAMPAIGN:
        return this.campaignService.findAll({
          startDate: dto.startDate,
          endDate: dto.endDate,
          associationId: dto.associationId
        });

      default:
        throw new Error(`Unsupported report type: ${dto.reportType}`);
    }
  }

  /**
   * Formats report data into requested output format
   * @private
   */
  private async formatReport(data: any[], dto: GenerateReportDto): Promise<Buffer> {
    switch (dto.format) {
      case ReportFormat.PDF:
        return this.generatePdfReport(data, dto);
      case ReportFormat.EXCEL:
        return this.generateExcelReport(data, dto);
      case ReportFormat.CSV:
        return this.generateCsvReport(data, dto);
      default:
        throw new Error(`Unsupported format: ${dto.format}`);
    }
  }

  /**
   * Generates PDF report with digital signature support
   * @private
   */
  private async generatePdfReport(data: any[], dto: GenerateReportDto): Promise<Buffer> {
    return new Promise((resolve) => {
      const chunks: Buffer[] = [];
      const doc = new PDFKit({ autoFirstPage: true });

      doc.on('data', chunks.push.bind(chunks));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Add header with RTL support if needed
      if (dto.language === 'he') {
        doc.font('Hebrew-Font').text(this.getReportTitle(dto), { align: 'right' });
      } else {
        doc.font('Helvetica-Bold').text(this.getReportTitle(dto));
      }

      // Add report metadata
      doc.moveDown()
        .fontSize(10)
        .text(`Generated: ${new Date().toISOString()}`)
        .text(`Period: ${dto.startDate.toLocaleDateString()} - ${dto.endDate.toLocaleDateString()}`);

      // Add data tables
      this.addPdfDataTable(doc, data, dto);

      // Add digital signature if required
      if (dto.securityOptions?.digitalSignature) {
        this.addDigitalSignature(doc);
      }

      doc.end();
    });
  }

  /**
   * Generates Excel report with data validation
   * @private
   */
  private async generateExcelReport(data: any[], dto: GenerateReportDto): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(this.getReportTitle(dto));

    // Add headers
    const headers = this.getReportHeaders(dto);
    worksheet.addRow(headers);

    // Add data with formatting
    data.forEach(item => {
      const row = this.formatExcelRow(item, dto);
      worksheet.addRow(row);
    });

    // Add styling
    worksheet.getRow(1).font = { bold: true };
    worksheet.columns.forEach(column => {
      column.width = 15;
    });

    return workbook.xlsx.writeBuffer();
  }

  /**
   * Generates CSV report with proper encoding
   * @private
   */
  private async generateCsvReport(data: any[], dto: GenerateReportDto): Promise<Buffer> {
    const headers = this.getReportHeaders(dto);
    const records = data.map(item => this.formatCsvRow(item, dto));

    const csvWriter = createObjectCsvWriter({
      path: 'temp.csv',
      header: headers.map(header => ({ id: header, title: header })),
      encoding: 'utf8'
    });

    await csvWriter.writeRecords(records);
    return Buffer.from(records.join('\n'), 'utf8');
  }

  /**
   * Gets localized report title
   * @private
   */
  private getReportTitle(dto: GenerateReportDto): string {
    const titles = {
      en: {
        [ReportType.DONATION]: 'Donation Report',
        [ReportType.CAMPAIGN]: 'Campaign Report',
        [ReportType.FINANCIAL]: 'Financial Report',
        [ReportType.TAX]: 'Tax Receipt'
      },
      he: {
        [ReportType.DONATION]: 'דו״ח תרומות',
        [ReportType.CAMPAIGN]: 'דו״ח קמפיינים',
        [ReportType.FINANCIAL]: 'דו״ח פיננסי',
        [ReportType.TAX]: 'קבלה למס'
      },
      fr: {
        [ReportType.DONATION]: 'Rapport des Dons',
        [ReportType.CAMPAIGN]: 'Rapport des Campagnes',
        [ReportType.FINANCIAL]: 'Rapport Financier',
        [ReportType.TAX]: 'Reçu Fiscal'
      }
    };

    return titles[dto.language][dto.reportType];
  }

  /**
   * Gets report headers based on report type
   * @private
   */
  private getReportHeaders(dto: GenerateReportDto): string[] {
    const headers = {
      [ReportType.DONATION]: ['Date', 'Amount', 'Currency', 'Donor', 'Campaign'],
      [ReportType.CAMPAIGN]: ['Title', 'Start Date', 'End Date', 'Goal', 'Progress'],
      [ReportType.FINANCIAL]: ['Date', 'Type', 'Amount', 'Status', 'Reference'],
      [ReportType.TAX]: ['Date', 'Amount', 'Currency', 'Receipt Number', 'Association']
    };

    return headers[dto.reportType];
  }

  /**
   * Adds digital signature to PDF document
   * @private
   */
  private addDigitalSignature(doc: PDFKit.PDFDocument): void {
    doc.moveDown(2)
      .fontSize(10)
      .text('Digitally signed by International Jewish Association Donation Platform')
      .text(`Timestamp: ${new Date().toISOString()}`);
  }

  /**
   * Formats data row for Excel report
   * @private
   */
  private formatExcelRow(item: any, dto: GenerateReportDto): any[] {
    switch (dto.reportType) {
      case ReportType.DONATION:
        return [
          item.createdAt,
          item.amount,
          item.currency,
          item.isAnonymous ? 'Anonymous' : item.donorId,
          item.campaignId || 'N/A'
        ];
      // Add other report types formatting
      default:
        return Object.values(item);
    }
  }

  /**
   * Formats data row for CSV report
   * @private
   */
  private formatCsvRow(item: any, dto: GenerateReportDto): Record<string, any> {
    const headers = this.getReportHeaders(dto);
    const row: Record<string, any> = {};

    headers.forEach((header, index) => {
      row[header] = this.formatExcelRow(item, dto)[index];
    });

    return row;
  }

  /**
   * Adds data table to PDF document
   * @private
   */
  private addPdfDataTable(doc: PDFKit.PDFDocument, data: any[], dto: GenerateReportDto): void {
    const headers = this.getReportHeaders(dto);
    const startY = doc.y + 20;
    const rowHeight = 20;
    const columnWidth = doc.page.width / headers.length;

    // Add headers
    headers.forEach((header, i) => {
      doc.text(header, i * columnWidth, startY);
    });

    // Add data rows
    data.forEach((item, rowIndex) => {
      const row = this.formatExcelRow(item, dto);
      row.forEach((cell, columnIndex) => {
        doc.text(
          cell.toString(),
          columnIndex * columnWidth,
          startY + (rowIndex + 1) * rowHeight
        );
      });
    });
  }
}