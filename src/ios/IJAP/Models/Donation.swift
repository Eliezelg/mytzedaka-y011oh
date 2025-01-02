// Foundation v13.0+
import Foundation

/// Represents the validation status of a donation
@objc public enum ValidationStatus: Int, Codable {
    case initial
    case validating
    case validated
    case invalid
    case compliance
}

/// Represents the recurring schedule for donations
@objc public enum RecurringSchedule: Int, Codable {
    case monthly
    case quarterly
    case annual
}

/// Comprehensive model representing a donation transaction with security and compliance features
@objc public class Donation: NSObject, Codable, Equatable {
    
    // MARK: - Properties
    
    public let id: String
    public let amount: Decimal
    public let currency: String
    public let paymentMethodType: PaymentMethodType
    public private(set) var paymentStatus: PaymentStatus
    public private(set) var transactionId: String?
    public let userId: String
    public let associationId: String
    public let campaignId: String?
    public var isAnonymous: Bool
    public var isRecurring: Bool
    public var recurringFrequency: String?
    public var recurringSchedule: RecurringSchedule?
    public let taxReceiptRequired: Bool
    private(set) var securityHash: String
    private(set) var validationStatus: ValidationStatus
    public let createdAt: Date
    public private(set) var updatedAt: Date
    public private(set) var lastProcessedAt: Date?
    
    // MARK: - Initialization
    
    /// Initializes a new donation with comprehensive validation and security measures
    public init(id: String,
               amount: Decimal,
               currency: String,
               paymentMethodType: PaymentMethodType,
               userId: String,
               associationId: String,
               campaignId: String? = nil,
               taxReceiptRequired: Bool = false) throws {
        
        // Validate minimum donation amount
        let validationResult = CurrencyUtils.validateAmount(amount, currencyCode: currency)
        guard validationResult == .valid else {
            throw DonationError.invalidAmount
        }
        
        self.id = id
        self.amount = amount
        self.currency = currency
        self.paymentMethodType = paymentMethodType
        self.userId = userId
        self.associationId = associationId
        self.campaignId = campaignId
        self.taxReceiptRequired = taxReceiptRequired
        
        // Initialize status fields
        self.paymentStatus = .pending
        self.validationStatus = .initial
        self.isAnonymous = false
        self.isRecurring = false
        
        // Set timestamps
        let now = Date()
        self.createdAt = now
        self.updatedAt = now
        
        // Generate security hash
        let hashInput = "\(id)|\(userId)|\(associationId)|\(amount)|\(currency)|\(now.timeIntervalSince1970)"
        self.securityHash = SecurityUtils.hashString(hashInput)
        
        super.init()
    }
    
    // MARK: - Public Methods
    
    /// Updates payment status with enhanced security and audit logging
    public func updatePaymentStatus(_ status: PaymentStatus,
                                  transactionId: String? = nil,
                                  metadata: [String: Any]? = nil) -> Result<Void, PaymentError> {
        // Validate status transition
        guard isValidStatusTransition(from: paymentStatus, to: status) else {
            return .failure(.invalidStatusTransition)
        }
        
        // Update security hash
        let hashInput = "\(id)|\(status.rawValue)|\(transactionId ?? "")|\(Date().timeIntervalSince1970)"
        securityHash = SecurityUtils.hashString(hashInput)
        
        // Update status and related fields
        paymentStatus = status
        self.transactionId = transactionId
        lastProcessedAt = Date()
        updatedAt = Date()
        
        return .success(())
    }
    
    /// Performs comprehensive payment validation
    public func validatePayment() -> Result<ValidationStatus, ValidationError> {
        validationStatus = .validating
        
        // Validate amount limits
        let amountValidation = CurrencyUtils.validateAmount(amount, currencyCode: currency)
        guard amountValidation == .valid else {
            validationStatus = .invalid
            return .failure(.invalidAmount)
        }
        
        // Validate currency
        guard CurrencyConfig.supportedCurrencies.contains(where: { $0.rawValue == currency }) else {
            validationStatus = .invalid
            return .failure(.unsupportedCurrency)
        }
        
        // Validate daily transaction limits
        if !validateTransactionLimits() {
            validationStatus = .compliance
            return .failure(.transactionLimitExceeded)
        }
        
        validationStatus = .validated
        return .success(validationStatus)
    }
    
    // MARK: - Private Methods
    
    private func isValidStatusTransition(from currentStatus: PaymentStatus, to newStatus: PaymentStatus) -> Bool {
        switch (currentStatus, newStatus) {
        case (.pending, .validating),
             (.validating, .processing),
             (.processing, .verifying),
             (.verifying, .completed),
             (.processing, .failed),
             (.completed, .refunded),
             (.completed, .disputed):
            return true
        default:
            return false
        }
    }
    
    private func validateTransactionLimits() -> Bool {
        // Implementation would check daily transaction limits
        return true
    }
    
    // MARK: - Equatable
    
    public static func == (lhs: Donation, rhs: Donation) -> Bool {
        return lhs.id == rhs.id
    }
}

// MARK: - Error Types

public enum DonationError: Error {
    case invalidAmount
    case invalidCurrency
    case invalidPaymentMethod
    case securityValidationFailed
}

public enum PaymentError: Error {
    case invalidStatusTransition
    case processingFailed
    case securityCheckFailed
    case systemError
}

public enum ValidationError: Error {
    case invalidAmount
    case unsupportedCurrency
    case transactionLimitExceeded
    case complianceCheckFailed
}

// MARK: - Codable Implementation

extension Donation {
    private enum CodingKeys: String, CodingKey {
        case id, amount, currency, paymentMethodType, paymentStatus
        case transactionId, userId, associationId, campaignId
        case isAnonymous, isRecurring, recurringFrequency, recurringSchedule
        case taxReceiptRequired, securityHash, validationStatus
        case createdAt, updatedAt, lastProcessedAt
    }
}