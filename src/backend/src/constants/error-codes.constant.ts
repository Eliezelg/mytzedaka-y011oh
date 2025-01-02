/**
 * Standardized error codes used across the application for consistent error handling
 * and response formatting in the NestJS microservices architecture.
 * 
 * Error Code Ranges:
 * 0       - Success
 * 1xxx    - Validation/HTTP errors
 * 2xxx    - Business logic errors
 * 3xxx    - Authentication/Authorization errors
 * 4xxx    - System/Infrastructure errors
 */
export enum ErrorCodes {
  /**
   * Indicates successful operation completion
   * Maps to HTTP 200 OK
   */
  SUCCESS = 0,

  /**
   * General validation error for invalid input data
   * Maps to HTTP 400 Bad Request
   */
  VALIDATION_ERROR = 1000,

  /**
   * User is not authenticated for the requested operation
   * Maps to HTTP 401 Unauthorized
   */
  UNAUTHORIZED = 1001,

  /**
   * User lacks necessary permissions for the requested operation
   * Maps to HTTP 403 Forbidden
   */
  FORBIDDEN = 1002,

  /**
   * Requested resource does not exist
   * Maps to HTTP 404 Not Found
   */
  NOT_FOUND = 1003,

  /**
   * Unexpected server error during operation
   * Maps to HTTP 500 Internal Server Error
   */
  INTERNAL_SERVER_ERROR = 1004,

  /**
   * Error during payment processing via payment gateways (Stripe/Tranzilla)
   * Maps to HTTP 402 Payment Required or 400 Bad Request
   */
  PAYMENT_ERROR = 2000,

  /**
   * Attempt to create duplicate record in database
   * Maps to HTTP 409 Conflict
   */
  DUPLICATE_ENTRY = 2001,

  /**
   * Invalid username/password combination during authentication
   * Maps to HTTP 401 Unauthorized
   */
  INVALID_CREDENTIALS = 3000,

  /**
   * Invalid, expired, or malformed authentication token
   * Maps to HTTP 401 Unauthorized
   */
  INVALID_TOKEN = 3001,

  /**
   * Too many requests from client in given time period
   * Maps to HTTP 429 Too Many Requests
   */
  RATE_LIMIT_EXCEEDED = 4000,
}