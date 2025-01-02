//
// APIError.swift
// IJAP
//
// Foundation version: iOS 13.0+
//

import Foundation

/// Comprehensive enumeration of all possible API and network-related errors
/// with localized descriptions and recovery suggestions.
enum APIError: LocalizedError {
    case invalidURL
    case networkError(Error)
    case invalidResponse
    case decodingError(Error)
    case unauthorized
    case forbidden
    case notFound
    case serverError(Int)
    case validationError([String: [String]])
    case noInternetConnection
    case timeoutError
    case cancelled
    case unknown
    
    /// User-facing localized description of the error
    public var errorDescription: String? {
        switch self {
        case .invalidURL:
            return NSLocalizedString(
                "error.invalid_url",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Invalid URL error message"
            )
        case .networkError(let error):
            return String(
                format: NSLocalizedString(
                    "error.network",
                    tableName: "APIErrors",
                    bundle: .main,
                    comment: "Network error message"
                ),
                error.localizedDescription
            )
        case .invalidResponse:
            return NSLocalizedString(
                "error.invalid_response",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Invalid response error message"
            )
        case .decodingError(let error):
            return String(
                format: NSLocalizedString(
                    "error.decoding",
                    tableName: "APIErrors",
                    bundle: .main,
                    comment: "Decoding error message"
                ),
                error.localizedDescription
            )
        case .unauthorized:
            return NSLocalizedString(
                "error.unauthorized",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Unauthorized error message"
            )
        case .forbidden:
            return NSLocalizedString(
                "error.forbidden",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Forbidden error message"
            )
        case .notFound:
            return NSLocalizedString(
                "error.not_found",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Not found error message"
            )
        case .serverError(let statusCode):
            return String(
                format: NSLocalizedString(
                    "error.server",
                    tableName: "APIErrors",
                    bundle: .main,
                    comment: "Server error message"
                ),
                statusCode
            )
        case .validationError(let errors):
            let errorMessages = errors.map { "\($0.key): \($0.value.joined(separator: ", "))" }
            return String(
                format: NSLocalizedString(
                    "error.validation",
                    tableName: "APIErrors",
                    bundle: .main,
                    comment: "Validation error message"
                ),
                errorMessages.joined(separator: "\n")
            )
        case .noInternetConnection:
            return NSLocalizedString(
                "error.no_internet",
                tableName: "APIErrors",
                bundle: .main,
                comment: "No internet connection error message"
            )
        case .timeoutError:
            return NSLocalizedString(
                "error.timeout",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Timeout error message"
            )
        case .cancelled:
            return NSLocalizedString(
                "error.cancelled",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Cancelled error message"
            )
        case .unknown:
            return NSLocalizedString(
                "error.unknown",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Unknown error message"
            )
        }
    }
    
    /// Detailed technical reason for the error occurrence
    public var failureReason: String? {
        switch self {
        case .networkError(let error):
            return error.localizedDescription
        case .decodingError(let error):
            return error.localizedDescription
        case .serverError(let statusCode):
            return "Server returned status code: \(statusCode)"
        case .validationError(let errors):
            return "Validation failed: \(errors)"
        default:
            return nil
        }
    }
    
    /// User-friendly suggestion for resolving the error
    public var recoverySuggestion: String? {
        switch self {
        case .invalidURL:
            return NSLocalizedString(
                "recovery.invalid_url",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Invalid URL recovery suggestion"
            )
        case .networkError:
            return NSLocalizedString(
                "recovery.network",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Network error recovery suggestion"
            )
        case .unauthorized:
            return NSLocalizedString(
                "recovery.unauthorized",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Unauthorized recovery suggestion"
            )
        case .forbidden:
            return NSLocalizedString(
                "recovery.forbidden",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Forbidden recovery suggestion"
            )
        case .noInternetConnection:
            return NSLocalizedString(
                "recovery.no_internet",
                tableName: "APIErrors",
                bundle: .main,
                comment: "No internet recovery suggestion"
            )
        case .timeoutError:
            return NSLocalizedString(
                "recovery.timeout",
                tableName: "APIErrors",
                bundle: .main,
                comment: "Timeout recovery suggestion"
            )
        default:
            return NSLocalizedString(
                "recovery.general",
                tableName: "APIErrors",
                bundle: .main,
                comment: "General recovery suggestion"
            )
        }
    }
    
    /// Logs the error with appropriate severity level
    private func logError() {
        let severity: String
        switch self {
        case .unauthorized, .forbidden, .serverError:
            severity = "critical"
        case .networkError, .decodingError, .validationError:
            severity = "error"
        case .noInternetConnection, .timeoutError:
            severity = "warning"
        default:
            severity = "info"
        }
        
        // Sanitize sensitive data before logging
        let sanitizedDescription = errorDescription?.replacingOccurrences(
            of: #"(password|token|key)\":\"[^\"]*\""#,
            with: "$1\":\"[REDACTED]\"",
            options: .regularExpression
        )
        
        // Integration point for system logging
        print("[\(severity)] APIError: \(sanitizedDescription ?? "Unknown error")")
    }
}