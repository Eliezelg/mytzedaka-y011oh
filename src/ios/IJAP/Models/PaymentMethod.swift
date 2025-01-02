// Foundation v13.0+
import Foundation
// Stripe v23.0+
import Stripe

/// Represents different types of payment methods supported by the platform
@objc public enum PaymentMethodType: Int {
    case creditCard
    case bankTransfer
    case directDebit
    case applePay
}

/// Represents the current status of a payment transaction
@objc public enum PaymentStatus: Int {
    case pending
    case processing
    case completed
    case failed
    case refunded
    case disputed
    case expired
}

/// Represents supported payment gateways
@objc public enum GatewayType: Int {
    case stripe
    case tranzilla
}

/// Model representing a secure payment method with multi-gateway support and PCI compliance
@available(iOS 13.0, *)
public class PaymentMethod: NSObject, Codable {
    
    // MARK: - Properties
    
    public let id: String
    public let type: PaymentMethodType
    public var lastFourDigits: String?
    public var expiryMonth: Int?
    public var expiryYear: Int?
    public var cardBrand: String?
    public var isDefault: Bool
    public let gatewayType: GatewayType
    private(set) var gatewayToken: String?
    public var isExpired: Bool {
        guard let month = expiryMonth,
              let year = expiryYear else {
            return false
        }
        let now = Date()
        let calendar = Calendar.current
        let currentYear = calendar.component(.year, from: now) % 100
        let currentMonth = calendar.component(.month, from: now)
        
        return year < currentYear || (year == currentYear && month < currentMonth)
    }
    private var securityCode: String?
    public var billingAddress: Address?
    public var metadata: [String: Any]?
    
    // MARK: - Initialization
    
    /// Initializes a new payment method with validation
    public init(id: String, type: PaymentMethodType, gatewayType: GatewayType, metadata: [String: Any]? = nil) {
        self.id = id
        self.type = type
        self.gatewayType = gatewayType
        self.isDefault = false
        self.metadata = metadata
        
        super.init()
        
        // Log initialization for audit trail
        logAuditEvent(event: "payment_method_created", details: ["id": id, "type": type])
    }
    
    // MARK: - Public Methods
    
    /// Converts payment method to Stripe format with security checks
    public func toStripePaymentMethod() throws -> STPPaymentMethod {
        // Validate required fields
        guard type == .creditCard || type == .applePay else {
            throw PaymentMethodError.invalidType
        }
        
        // Create payment method params
        let params = STPPaymentMethodParams()
        
        // Handle card details securely
        if let lastFour = lastFourDigits,
           let expMonth = expiryMonth,
           let expYear = expiryYear {
            let cardParams = STPPaymentMethodCardParams()
            cardParams.number = nil // Never store full card number
            cardParams.expMonth = NSNumber(value: expMonth)
            cardParams.expYear = NSNumber(value: expYear)
            cardParams.last4 = lastFour
            params.card = cardParams
        }
        
        // Add billing details if available
        if let billing = billingAddress {
            let billingDetails = STPPaymentMethodBillingDetails()
            billingDetails.address = billing.toStripeAddress()
            params.billingDetails = billingDetails
        }
        
        // Log conversion for audit (excluding sensitive data)
        logAuditEvent(event: "payment_method_converted_stripe", details: ["id": id])
        
        return STPPaymentMethod(paymentMethodId: id, parameters: params)
    }
    
    /// Converts payment method to Tranzilla format with Israeli market support
    public func toTranzillaPaymentMethod() throws -> [String: Any] {
        // Validate required fields for Tranzilla
        guard type == .creditCard else {
            throw PaymentMethodError.invalidType
        }
        
        // Create base dictionary with required fields
        var tranzillaParams: [String: Any] = [
            "terminal_id": getTerminalId(),
            "currency": CurrencyUtils.validateCurrency("ILS"),
            "card_last_digits": lastFourDigits ?? "",
            "expiration_month": String(format: "%02d", expiryMonth ?? 0),
            "expiration_year": String(format: "%02d", expiryYear ?? 0)
        ]
        
        // Add billing information if available
        if let billing = billingAddress {
            tranzillaParams["billing_address"] = billing.toDictionary()
        }
        
        // Log conversion for audit (excluding sensitive data)
        logAuditEvent(event: "payment_method_converted_tranzilla", details: ["id": id])
        
        return tranzillaParams
    }
    
    /// Comprehensive payment method validation
    public func validate() -> Result<Bool, PaymentMethodError> {
        // Validate basic requirements
        guard !id.isEmpty else {
            return .failure(.invalidId)
        }
        
        // Validate card-specific requirements
        if type == .creditCard {
            guard let lastFour = lastFourDigits,
                  lastFour.count == 4,
                  let month = expiryMonth,
                  let year = expiryYear else {
                return .failure(.invalidCardDetails)
            }
            
            // Check expiration
            if isExpired {
                return .failure(.expired)
            }
        }
        
        // Validate gateway-specific requirements
        switch gatewayType {
        case .stripe:
            guard !isExpired else {
                return .failure(.expired)
            }
        case .tranzilla:
            guard billingAddress != nil else {
                return .failure(.missingBillingAddress)
            }
        }
        
        // Log validation attempt
        logAuditEvent(event: "payment_method_validated", details: ["id": id, "result": "success"])
        
        return .success(true)
    }
    
    // MARK: - Private Methods
    
    private func logAuditEvent(event: String, details: [String: Any]) {
        // Implementation would include secure audit logging
        // Sensitive data must be masked or excluded
    }
    
    private func getTerminalId() -> String {
        // Implementation would retrieve terminal ID from secure storage
        return "TERMINAL_ID"
    }
}

// MARK: - Error Types

public enum PaymentMethodError: Error {
    case invalidId
    case invalidType
    case invalidCardDetails
    case expired
    case missingBillingAddress
    case conversionFailed
    case validationFailed
}

// MARK: - Codable Implementation

extension PaymentMethod {
    private enum CodingKeys: String, CodingKey {
        case id, type, lastFourDigits, expiryMonth, expiryYear
        case cardBrand, isDefault, gatewayType, gatewayToken
        case billingAddress, metadata
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(type.rawValue, forKey: .type)
        try container.encodeIfPresent(lastFourDigits, forKey: .lastFourDigits)
        try container.encodeIfPresent(expiryMonth, forKey: .expiryMonth)
        try container.encodeIfPresent(expiryYear, forKey: .expiryYear)
        try container.encodeIfPresent(cardBrand, forKey: .cardBrand)
        try container.encode(isDefault, forKey: .isDefault)
        try container.encode(gatewayType.rawValue, forKey: .gatewayType)
        try container.encodeIfPresent(gatewayToken, forKey: .gatewayToken)
        try container.encodeIfPresent(billingAddress, forKey: .billingAddress)
        
        // Encrypt sensitive data before encoding
        if let metadata = metadata {
            let encryptedMetadata = try SecurityUtils.encryptData(JSONSerialization.data(withJSONObject: metadata))
            try container.encode(encryptedMetadata, forKey: .metadata)
        }
    }
    
    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        type = try PaymentMethodType(rawValue: container.decode(Int.self, forKey: .type)) ?? .creditCard
        lastFourDigits = try container.decodeIfPresent(String.self, forKey: .lastFourDigits)
        expiryMonth = try container.decodeIfPresent(Int.self, forKey: .expiryMonth)
        expiryYear = try container.decodeIfPresent(Int.self, forKey: .expiryYear)
        cardBrand = try container.decodeIfPresent(String.self, forKey: .cardBrand)
        isDefault = try container.decode(Bool.self, forKey: .isDefault)
        gatewayType = try GatewayType(rawValue: container.decode(Int.self, forKey: .gatewayType)) ?? .stripe
        gatewayToken = try container.decodeIfPresent(String.self, forKey: .gatewayToken)
        billingAddress = try container.decodeIfPresent(Address.self, forKey: .billingAddress)
        
        // Decrypt sensitive data after decoding
        if let encryptedMetadata = try container.decodeIfPresent(Data.self, forKey: .metadata) {
            let decryptedData = try SecurityUtils.decryptData(encryptedMetadata)
            metadata = try JSONSerialization.jsonObject(with: decryptedData) as? [String: Any]
        }
        
        super.init()
    }
}