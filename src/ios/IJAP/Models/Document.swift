import Foundation // iOS 13.0+
import CoreData

// MARK: - Document Type Enumeration
@objc
public enum DocumentType: Int16, Codable {
    case taxReceipt = 0
    case associationDocument = 1
    case financialReport = 2
    case verificationDocument = 3
    
    public var description: String {
        switch self {
        case .taxReceipt: return "TAX_RECEIPT"
        case .associationDocument: return "ASSOCIATION_DOCUMENT"
        case .financialReport: return "FINANCIAL_REPORT"
        case .verificationDocument: return "VERIFICATION_DOCUMENT"
        }
    }
}

// MARK: - Document Status Enumeration
@objc
public enum DocumentStatus: Int16, Codable {
    case pending = 0
    case verified = 1
    case rejected = 2
    
    public var description: String {
        switch self {
        case .pending: return "PENDING"
        case .verified: return "VERIFIED"
        case .rejected: return "REJECTED"
        }
    }
}

// MARK: - Security Classification Enumeration
@objc
public enum SecurityClassification: Int16, Codable {
    case public_ = 0
    case internal_ = 1
    case sensitive = 2
    case critical = 3
    
    public var description: String {
        switch self {
        case .public_: return "PUBLIC"
        case .internal_: return "INTERNAL"
        case .sensitive: return "SENSITIVE"
        case .critical: return "CRITICAL"
        }
    }
}

// MARK: - Document Model
@objc(Document)
public class Document: NSManagedObject, Codable {
    // MARK: - Properties
    @NSManaged public var id: String
    @NSManaged public var type: DocumentType
    @NSManaged public var metadata: [String: Any]
    @NSManaged public var status: DocumentStatus
    @NSManaged public var documentDescription: String?
    @NSManaged public var associationId: String
    @NSManaged public var userId: String?
    @NSManaged public var createdAt: Date
    @NSManaged public var updatedAt: Date
    @NSManaged public var securityLevel: SecurityClassification
    @NSManaged private var encryptionKey: String?
    @NSManaged public var version: Int32
    @NSManaged public var expiryDate: Date?
    @NSManaged public var auditTrail: [String: Any]
    
    // MARK: - Core Data Entity Name
    public static var entityName: String { return "Document" }
    
    // MARK: - Initialization
    public override init(entity: NSEntityDescription, insertInto context: NSManagedObjectContext?) {
        super.init(entity: entity, insertInto: context)
    }
    
    public convenience init(id: String,
                          type: DocumentType,
                          metadata: [String: Any],
                          associationId: String,
                          securityLevel: SecurityClassification,
                          context: NSManagedObjectContext) throws {
        let entity = NSEntityDescription.entity(forEntityName: Document.entityName, in: context)!
        self.init(entity: entity, insertInto: context)
        
        // Validate inputs
        guard UUID(uuidString: id) != nil else {
            throw DocumentError.invalidId
        }
        
        // Initialize required properties
        self.id = id
        self.type = type
        self.metadata = metadata
        self.associationId = associationId
        self.securityLevel = securityLevel
        self.status = .pending
        self.version = 1
        self.createdAt = Date()
        self.updatedAt = Date()
        self.auditTrail = ["created": ["timestamp": self.createdAt,
                                      "action": "DOCUMENT_CREATED"]]
        
        // Generate encryption key for sensitive data if needed
        if securityLevel == .sensitive || securityLevel == .critical {
            self.encryptionKey = UUID().uuidString
            try encryptSensitiveData()
        }
        
        // Validate metadata based on document type
        try validateMetadata()
    }
    
    // MARK: - Codable
    private enum CodingKeys: String, CodingKey {
        case id, type, metadata, status, documentDescription
        case associationId, userId, createdAt, updatedAt
        case securityLevel, version, expiryDate, auditTrail
    }
    
    public required convenience init(from decoder: Decoder) throws {
        guard let context = decoder.userInfo[.managedObjectContext] as? NSManagedObjectContext else {
            throw DocumentError.missingManagedObjectContext
        }
        
        let entity = NSEntityDescription.entity(forEntityName: Document.entityName, in: context)!
        self.init(entity: entity, insertInto: context)
        
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decode(String.self, forKey: .id)
        type = try container.decode(DocumentType.self, forKey: .type)
        metadata = try container.decode([String: Any].self, forKey: .metadata)
        status = try container.decode(DocumentStatus.self, forKey: .status)
        documentDescription = try container.decodeIfPresent(String.self, forKey: .documentDescription)
        associationId = try container.decode(String.self, forKey: .associationId)
        userId = try container.decodeIfPresent(String.self, forKey: .userId)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        securityLevel = try container.decode(SecurityClassification.self, forKey: .securityLevel)
        version = try container.decode(Int32.self, forKey: .version)
        expiryDate = try container.decodeIfPresent(Date.self, forKey: .expiryDate)
        auditTrail = try container.decode([String: Any].self, forKey: .auditTrail)
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(id, forKey: .id)
        try container.encode(type, forKey: .type)
        try container.encode(metadata, forKey: .metadata)
        try container.encode(status, forKey: .status)
        try container.encodeIfPresent(documentDescription, forKey: .documentDescription)
        try container.encode(associationId, forKey: .associationId)
        try container.encodeIfPresent(userId, forKey: .userId)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
        try container.encode(securityLevel, forKey: .securityLevel)
        try container.encode(version, forKey: .version)
        try container.encodeIfPresent(expiryDate, forKey: .expiryDate)
        try container.encode(auditTrail, forKey: .auditTrail)
    }
    
    // MARK: - Public Methods
    public func toJSON() throws -> [String: Any] {
        var json: [String: Any] = [
            "id": id,
            "type": type.description,
            "status": status.description,
            "associationId": associationId,
            "createdAt": ISO8601DateFormatter().string(from: createdAt),
            "updatedAt": ISO8601DateFormatter().string(from: updatedAt),
            "securityLevel": securityLevel.description,
            "version": version
        ]
        
        // Add optional fields
        if let desc = documentDescription { json["description"] = desc }
        if let uid = userId { json["userId"] = uid }
        if let expiry = expiryDate { json["expiryDate"] = ISO8601DateFormatter().string(from: expiry) }
        
        // Handle sensitive data based on security level
        if securityLevel == .public_ || securityLevel == .internal_ {
            json["metadata"] = metadata
            json["auditTrail"] = auditTrail
        } else {
            // Return only safe metadata fields for sensitive/critical documents
            json["metadata"] = metadata.filter { key, _ in
                !["financialData", "personalInfo", "securityInfo"].contains(key)
            }
        }
        
        return json
    }
    
    public func validateMetadata() throws {
        guard !metadata.isEmpty else {
            throw DocumentError.invalidMetadata
        }
        
        // Validate required fields based on document type
        switch type {
        case .taxReceipt:
            guard let amount = metadata["amount"] as? Decimal,
                  let currency = metadata["currency"] as? String,
                  let donorId = metadata["donorId"] as? String else {
                throw DocumentError.invalidMetadata
            }
            
            // Validate currency format
            let currencyRegex = "^[A-Z]{3}$"
            guard currency.range(of: currencyRegex, options: .regularExpression) != nil else {
                throw DocumentError.invalidMetadata
            }
            
        case .associationDocument:
            guard let docType = metadata["documentType"] as? String,
                  let issueDate = metadata["issueDate"] as? Date else {
                throw DocumentError.invalidMetadata
            }
            
        case .financialReport:
            guard let reportType = metadata["reportType"] as? String,
                  let period = metadata["period"] as? String,
                  let totalAmount = metadata["totalAmount"] as? Decimal else {
                throw DocumentError.invalidMetadata
            }
            
        case .verificationDocument:
            guard let verificationType = metadata["verificationType"] as? String,
                  let verifierId = metadata["verifierId"] as? String else {
                throw DocumentError.invalidMetadata
            }
        }
    }
    
    // MARK: - Private Methods
    private func encryptSensitiveData() throws {
        guard let key = encryptionKey else {
            throw DocumentError.missingEncryptionKey
        }
        
        // Encrypt sensitive metadata fields
        let sensitiveFields = ["financialData", "personalInfo", "securityInfo"]
        for field in sensitiveFields {
            if let data = metadata[field] {
                metadata[field] = try CoreDataManager.shared.encryptField(data, using: key)
            }
        }
    }
}

// MARK: - Document Errors
public enum DocumentError: Error {
    case invalidId
    case invalidMetadata
    case missingEncryptionKey
    case missingManagedObjectContext
    case encryptionFailed
    case decryptionFailed
}

// MARK: - Managed Object Context Extension
private extension CodingUserInfoKey {
    static let managedObjectContext = CodingUserInfoKey(rawValue: "managedObjectContext")!
}