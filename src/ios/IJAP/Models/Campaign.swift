import Foundation // iOS 13.0+

// MARK: - Campaign Lottery Details
@objc
public class CampaignLotteryDetails: NSObject, Codable {
    public let drawDate: Date
    public let ticketPrice: Decimal
    public let currency: String
    public let maxTickets: Int
    public let soldTickets: Int
    public let prizes: [String: Any]
    public let isDrawComplete: Bool
    
    public init(drawDate: Date,
                ticketPrice: Decimal,
                currency: String,
                maxTickets: Int,
                prizes: [String: Any]) {
        self.drawDate = drawDate
        self.ticketPrice = ticketPrice
        self.currency = currency
        self.maxTickets = maxTickets
        self.soldTickets = 0
        self.prizes = prizes
        self.isDrawComplete = false
        super.init()
    }
    
    public func validatePrizes() -> Bool {
        guard !prizes.isEmpty else { return false }
        
        // Validate prize structure
        for (_, value) in prizes {
            guard let prizeDict = value as? [String: Any],
                  let _ = prizeDict["description"] as? String,
                  let value = prizeDict["value"] as? Decimal,
                  value > 0 else {
                return false
            }
        }
        
        // Validate total prize value doesn't exceed campaign goal
        let totalPrizeValue = prizes.compactMap { (_, value) -> Decimal? in
            guard let prizeDict = value as? [String: Any],
                  let value = prizeDict["value"] as? Decimal else {
                return nil
            }
            return value
        }.reduce(0, +)
        
        return totalPrizeValue > 0
    }
}

// MARK: - Campaign Model
@objc
@objcMembers
public class Campaign: NSObject, Codable {
    // MARK: - Properties
    public let id: String
    public let title: String
    public let description: String
    public let goalAmount: Decimal
    public let currency: String
    public let startDate: Date
    public let endDate: Date
    public let associationId: String
    public let images: [String]
    public let tags: [String]
    public private(set) var currentAmount: Decimal
    public private(set) var donorCount: Int
    public let isLottery: Bool
    public let lotteryDetails: CampaignLotteryDetails?
    public private(set) var status: String
    public let createdAt: Date
    public private(set) var updatedAt: Date
    public var metadata: [String: Any]
    
    // MARK: - Constants
    private enum Status {
        static let active = "ACTIVE"
        static let pending = "PENDING"
        static let completed = "COMPLETED"
        static let cancelled = "CANCELLED"
    }
    
    private var progressCache: Double?
    
    // MARK: - Initialization
    public init(id: String,
                title: String,
                description: String,
                goalAmount: Decimal,
                currency: String,
                startDate: Date,
                endDate: Date,
                associationId: String,
                isLottery: Bool = false,
                lotteryDetails: CampaignLotteryDetails? = nil) throws {
        
        // Validate inputs
        guard UUID(uuidString: id) != nil else {
            throw CampaignError.invalidId
        }
        
        guard !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            throw CampaignError.invalidTitle
        }
        
        guard goalAmount > 0 else {
            throw CampaignError.invalidGoalAmount
        }
        
        guard startDate < endDate else {
            throw CampaignError.invalidDateRange
        }
        
        self.id = id
        self.title = title.trimmingCharacters(in: .whitespacesAndNewlines)
        self.description = description
        self.goalAmount = goalAmount
        self.currency = currency.uppercased()
        self.startDate = startDate
        self.endDate = endDate
        self.associationId = associationId
        self.images = []
        self.tags = []
        self.currentAmount = 0
        self.donorCount = 0
        self.isLottery = isLottery
        self.lotteryDetails = lotteryDetails
        self.status = Status.pending
        self.createdAt = Date()
        self.updatedAt = Date()
        self.metadata = [:]
        
        super.init()
        
        // Validate lottery details if applicable
        if isLottery {
            guard let details = lotteryDetails, details.validatePrizes() else {
                throw CampaignError.invalidLotteryDetails
            }
        }
    }
    
    // MARK: - Public Methods
    public func getProgress() -> Double {
        if let cached = progressCache {
            return cached
        }
        
        let progress = min(100, max(0, (Double(truncating: currentAmount as NSDecimalNumber) / Double(truncating: goalAmount as NSDecimalNumber)) * 100))
        progressCache = progress
        return progress
    }
    
    public func isActive() -> Bool {
        let now = Date()
        return status == Status.active &&
               now >= startDate &&
               now <= endDate
    }
    
    public func validate() -> Bool {
        // Validate currency code (ISO 4217)
        let currencyRegex = "^[A-Z]{3}$"
        guard let currencyMatch = try? NSRegularExpression(pattern: currencyRegex).firstMatch(in: currency, range: NSRange(location: 0, length: currency.count)),
              currencyMatch.range.length > 0 else {
            return false
        }
        
        // Validate goal amount
        guard goalAmount > 0 else {
            return false
        }
        
        // Validate dates
        guard startDate < endDate else {
            return false
        }
        
        // Validate image URLs
        for imageUrl in images {
            guard URL(string: imageUrl) != nil else {
                return false
            }
        }
        
        // Validate lottery details if applicable
        if isLottery {
            guard let details = lotteryDetails,
                  details.validatePrizes() else {
                return false
            }
        }
        
        return true
    }
}

// MARK: - Campaign Errors
public enum CampaignError: Error {
    case invalidId
    case invalidTitle
    case invalidGoalAmount
    case invalidDateRange
    case invalidLotteryDetails
}

// MARK: - Equatable
extension Campaign: Equatable {
    public static func == (lhs: Campaign, rhs: Campaign) -> Bool {
        return lhs.id == rhs.id
    }
}

// MARK: - Hashable
extension Campaign: Hashable {
    public func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}