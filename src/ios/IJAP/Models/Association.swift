import Foundation // iOS 13.0+

// MARK: - Association Model
@objc
@objcMembers
public class Association: NSObject, Codable {
    // MARK: - Properties
    public let id: String
    public let name: String
    public let email: String
    public let phone: String
    public let description: [String: String] // Multi-language support
    public let website: String?
    public let registrationNumber: String
    public let taxId: String
    public let address: AssociationAddress
    public let legalInfo: AssociationLegalInfo
    public let categories: [String]
    public let primaryLanguage: String
    public let supportedLanguages: [String]
    public let currencyPreferences: [String]
    public private(set) var isVerified: Bool
    public private(set) var status: String
    public private(set) var securityLevel: String
    public let createdAt: Date
    public private(set) var updatedAt: Date
    
    // MARK: - Constants
    private enum SecurityLevel {
        static let confidential = "CONFIDENTIAL"
        static let restricted = "RESTRICTED"
        static let public_ = "PUBLIC"
    }
    
    private enum Status {
        static let active = "ACTIVE"
        static let pending = "PENDING"
        static let suspended = "SUSPENDED"
    }
    
    // MARK: - Initialization
    public init(id: String,
                name: String,
                email: String,
                phone: String,
                registrationNumber: String,
                taxId: String,
                address: AssociationAddress,
                legalInfo: AssociationLegalInfo) throws {
        // Input validation
        guard UUID(uuidString: id) != nil else {
            throw AssociationError.invalidId
        }
        
        guard Self.isValidEmail(email) else {
            throw AssociationError.invalidEmail
        }
        
        guard Self.isValidPhone(phone) else {
            throw AssociationError.invalidPhone
        }
        
        self.id = id
        self.name = name.trimmingCharacters(in: .whitespacesAndNewlines)
        self.email = email.lowercased()
        self.phone = phone
        self.description = [:]
        self.registrationNumber = registrationNumber
        self.taxId = taxId
        self.address = address
        self.legalInfo = legalInfo
        self.categories = []
        self.primaryLanguage = "en"
        self.supportedLanguages = ["en"]
        self.currencyPreferences = ["USD"]
        self.website = nil
        self.isVerified = false
        self.status = Status.pending
        self.securityLevel = SecurityLevel.confidential
        self.createdAt = Date()
        self.updatedAt = Date()
        
        super.init()
    }
    
    // MARK: - Codable
    private enum CodingKeys: String, CodingKey {
        case id, name, email, phone, description, website
        case registrationNumber, taxId, address, legalInfo
        case categories, primaryLanguage, supportedLanguages
        case currencyPreferences, isVerified, status
        case securityLevel, createdAt, updatedAt
    }
    
    // MARK: - Validation Methods
    private static func isValidEmail(_ email: String) -> Bool {
        let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email)
    }
    
    private static func isValidPhone(_ phone: String) -> Bool {
        let phoneRegex = "^\\+[1-9]\\d{1,14}$"
        let phonePredicate = NSPredicate(format: "SELF MATCHES %@", phoneRegex)
        return phonePredicate.evaluate(with: phone)
    }
}

// MARK: - Association Address
public struct AssociationAddress: Codable {
    public let street: String
    public let city: String
    public let state: String?
    public let country: String
    public let postalCode: String
    public let addressFormat: String
    
    public init(street: String,
                city: String,
                state: String?,
                country: String,
                postalCode: String,
                addressFormat: String) {
        self.street = street
        self.city = city
        self.state = state
        self.country = country
        self.postalCode = postalCode
        self.addressFormat = addressFormat
    }
}

// MARK: - Association Legal Info
public struct AssociationLegalInfo: Codable {
    public let registrationType: String
    public let registrationDate: Date
    public let registrationCountry: String
    public let taxExemptStatus: Bool
    public let legalDocuments: [String]
    public let complianceLevel: String
    
    public init(registrationType: String,
                registrationDate: Date,
                registrationCountry: String,
                taxExemptStatus: Bool,
                legalDocuments: [String],
                complianceLevel: String) {
        self.registrationType = registrationType
        self.registrationDate = registrationDate
        self.registrationCountry = registrationCountry
        self.taxExemptStatus = taxExemptStatus
        self.legalDocuments = legalDocuments
        self.complianceLevel = complianceLevel
    }
}

// MARK: - Association Errors
public enum AssociationError: Error {
    case invalidId
    case invalidEmail
    case invalidPhone
    case invalidRegistrationNumber
    case invalidTaxId
}

// MARK: - Equatable
extension Association: Equatable {
    public static func == (lhs: Association, rhs: Association) -> Bool {
        return lhs.id == rhs.id
    }
}

// MARK: - Hashable
extension Association: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}