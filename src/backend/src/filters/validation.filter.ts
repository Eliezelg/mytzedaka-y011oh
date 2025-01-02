import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { ValidationError } from 'class-validator';
import { ErrorCodes } from '../constants/error-codes.constant';
import { Messages } from '../constants/messages.constant';

/**
 * Global validation filter that handles validation exceptions and transforms them into
 * standardized, multi-language API responses with proper error formatting.
 * 
 * @implements {ExceptionFilter<ValidationError>}
 */
@Catch(ValidationError)
export class ValidationFilter implements ExceptionFilter<ValidationError> {
  private readonly logger = new Logger(ValidationFilter.name);

  /**
   * Handles validation exceptions and transforms them into standardized error responses
   * with proper localization and formatting.
   * 
   * @param {ValidationError[]} exception - The validation errors from class-validator
   * @param {ArgumentsHost} host - The execution context
   * @returns {object} Standardized error response with validation details
   */
  catch(exception: ValidationError[], host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    // Extract correlation ID for request tracking
    const correlationId = request.headers['x-correlation-id'] || 'unknown';

    // Log validation error details
    this.logger.warn({
      message: 'Validation error occurred',
      correlationId,
      path: request.url,
      errors: exception
    });

    // Get user's preferred language from Accept-Language header
    const language = this.getPreferredLanguage(request.headers['accept-language']);

    // Format validation errors with localized messages
    const formattedErrors = this.formatValidationErrors(exception, language);

    // Send standardized error response
    response.status(400).json({
      success: false,
      errorCode: ErrorCodes.VALIDATION_ERROR,
      message: Messages.VALIDATION.INVALID_FORMAT.templates[language],
      errors: formattedErrors,
      timestamp: new Date().toISOString(),
      path: request.url,
      correlationId
    });
  }

  /**
   * Formats validation error objects into a readable structure with multi-language support
   * 
   * @param {ValidationError[]} errors - Array of validation errors
   * @param {string} language - User's preferred language code
   * @returns {object} Formatted validation errors with localized messages
   */
  private formatValidationErrors(errors: ValidationError[], language: 'en' | 'he' | 'fr'): object {
    const formattedErrors = {};

    for (const error of errors) {
      const constraints = error.constraints || {};
      const messages = [];

      // Process each validation constraint
      for (const [constraint, message] of Object.entries(constraints)) {
        let localizedMessage = '';

        // Map constraint to appropriate message template
        switch (constraint) {
          case 'isNotEmpty':
            localizedMessage = Messages.VALIDATION.REQUIRED_FIELD.templates[language]
              .replace('{field}', error.property);
            break;
          default:
            localizedMessage = Messages.VALIDATION.INVALID_FORMAT.templates[language]
              .replace('{field}', error.property);
        }

        messages.push({
          constraint,
          message: localizedMessage
        });
      }

      // Handle nested validation errors recursively
      if (error.children && error.children.length > 0) {
        formattedErrors[error.property] = {
          messages,
          nested: this.formatValidationErrors(error.children, language)
        };
      } else {
        formattedErrors[error.property] = messages;
      }
    }

    return formattedErrors;
  }

  /**
   * Determines the preferred language from the Accept-Language header
   * Defaults to English if no supported language is found
   * 
   * @param {string} acceptLanguage - Accept-Language header value
   * @returns {'en' | 'he' | 'fr'} Supported language code
   */
  private getPreferredLanguage(acceptLanguage: string): 'en' | 'he' | 'fr' {
    if (!acceptLanguage) {
      return 'en';
    }

    const supportedLanguages = ['en', 'he', 'fr'];
    const preferredLanguage = acceptLanguage
      .split(',')
      .map(lang => lang.split(';')[0].trim().substring(0, 2))
      .find(lang => supportedLanguages.includes(lang));

    return (preferredLanguage as 'en' | 'he' | 'fr') || 'en';
  }
}