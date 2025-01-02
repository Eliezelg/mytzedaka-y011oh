import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'; // ^10.0.0
import { Observable } from 'rxjs'; // ^7.8.0
import { map } from 'rxjs/operators'; // ^7.8.0

/**
 * Interceptor that transforms all API responses into a standardized format
 * with consistent structure, success indicators, and timestamps.
 * 
 * Response Format:
 * {
 *   success: boolean,
 *   timestamp: string (ISO format),
 *   data: any (original response payload)
 * }
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  /**
   * Intercepts and transforms HTTP responses into a standardized format
   * @param context - ExecutionContext containing request/response details
   * @param next - CallHandler for processing the response stream
   * @returns Observable of the transformed response
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(responseData => {
        // Check if response is an error object
        if (responseData && responseData.error) {
          return {
            success: false,
            timestamp: new Date().toISOString(),
            error: {
              message: responseData.error.message || 'An error occurred',
              code: responseData.error.code || 'UNKNOWN_ERROR',
              details: responseData.error.details || null
            }
          };
        }

        // Transform successful responses
        return {
          success: true,
          timestamp: new Date().toISOString(),
          data: responseData
        };
      })
    );
  }
}