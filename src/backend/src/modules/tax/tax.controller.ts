import { 
  Controller, 
  Post, 
  Body, 
  UseGuards 
} from '@nestjs/common'; // ^10.0.0
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse 
} from '@nestjs/swagger'; // ^7.0.0
import { TaxService } from './tax.service';
import { GenerateReceiptDto } from './dto/generate-receipt.dto';
import { Auth } from '../../decorators/auth.decorator';
import { Roles } from '../../decorators/roles.decorator';
import { Document } from '../document/entities/document.entity';

/**
 * Controller implementing secure tax receipt generation endpoints with support for
 * multiple formats (PDF, CERFA) and languages (Hebrew, English, French).
 * Implements PCI DSS Level 1 compliance for document handling.
 */
@Controller('tax')
@ApiTags('Tax')
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  /**
   * Generates a tax receipt for a completed donation with comprehensive validation
   * and secure document handling. Supports multiple formats and languages with
   * digital signatures and audit trails.
   * 
   * @param generateReceiptDto Receipt generation parameters including format and language
   * @returns Generated and digitally signed tax receipt document
   */
  @Post('receipt')
  @Auth(true)
  @Roles('DONOR', 'ASSOCIATION', 'ADMIN')
  @ApiOperation({ 
    summary: 'Generate tax receipt for donation',
    description: 'Generates a secure, digitally signed tax receipt in the requested format and language'
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Receipt generated successfully',
    type: Document
  })
  @ApiResponse({ 
    status: 400, 
    description: 'Invalid request parameters'
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Unauthorized access'
  })
  @ApiResponse({ 
    status: 403, 
    description: 'Insufficient permissions'
  })
  async generateReceipt(
    @Body() generateReceiptDto: GenerateReceiptDto
  ): Promise<Document> {
    return this.taxService.generateReceipt(generateReceiptDto);
  }
}