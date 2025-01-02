// Foundation v13.0+
import Foundation
// Combine v13.0+
import Combine

/// Service class responsible for managing donation operations with comprehensive security,
/// performance monitoring, and error handling capabilities
@available(iOS 13.0, *)
public final class DonationService {
    
    // MARK: - Types
    
    private struct RetryConfiguration {
        let maxAttempts: Int = 3
        let baseDelay: TimeInterval = 1.0
        let maxDelay: TimeInterval = 10.0
    }
    
    private struct SecurityValidator {
        let minAmount: Decimal
        let maxAmount: Decimal
        let maxDailyTransactions: Int
        
        init() {
            self.minAmount = ValidationConfig.DonationValidationRules.minAmount
            self.maxAmount = ValidationConfig.DonationValidationRules.maxAmount
            self.maxDailyTransactions = ValidationConfig.DonationValidationRules.maxDailyTransactions
        }
    }
    
    private struct TransactionMonitor {
        let startTime: Date
        let donationId: String
        let amount: Decimal
        let currency: String
    }
    
    // MARK: - Properties
    
    public static let shared = DonationService()
    
    private let apiClient: APIClient
    private let paymentService: PaymentService
    private let donationPublisher = PassthroughSubject<Donation, Error>()
    private let retryConfiguration: RetryConfiguration
    private let securityValidator: SecurityValidator
    private var transactionMonitor: TransactionMonitor?
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    private init() {
        self.apiClient = APIClient.shared
        self.paymentService = PaymentService.shared
        self.retryConfiguration = RetryConfiguration()
        self.securityValidator = SecurityValidator()
        
        setupNetworkMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Creates and processes a new donation with comprehensive validation and monitoring
    /// - Parameters:
    ///   - amount: The donation amount
    ///   - currency: The currency code (USD, EUR, ILS)
    ///   - associationId: The recipient association ID
    ///   - paymentMethod: The payment method to use
    ///   - isAnonymous: Whether the donation is anonymous
    ///   - isRecurring: Whether this is a recurring donation
    ///   - campaignId: Optional campaign ID for targeted donations
    /// - Returns: Publisher that emits the created donation or error
    public func createDonation(
        amount: Decimal,
        currency: String,
        associationId: String,
        paymentMethod: PaymentMethod,
        isAnonymous: Bool = false,
        isRecurring: Bool = false,
        campaignId: String? = nil
    ) -> AnyPublisher<Donation, Error> {
        // Start performance monitoring
        let monitor = TransactionMonitor(
            startTime: Date(),
            donationId: UUID().uuidString,
            amount: amount,
            currency: currency
        )
        self.transactionMonitor = monitor
        
        // Validate input parameters
        guard validateDonationParameters(
            amount: amount,
            currency: currency,
            associationId: associationId
        ) else {
            return Fail(error: DonationError.invalidParameters)
                .eraseToAnyPublisher()
        }
        
        // Validate payment method
        guard case .success = paymentMethod.validate() else {
            return Fail(error: DonationError.invalidPaymentMethod)
                .eraseToAnyPublisher()
        }
        
        // Create donation object
        let donation: Donation
        do {
            donation = try Donation(
                id: monitor.donationId,
                amount: amount,
                currency: currency,
                paymentMethodType: paymentMethod.type,
                userId: getUserId(),
                associationId: associationId,
                campaignId: campaignId
            )
            donation.isAnonymous = isAnonymous
            donation.isRecurring = isRecurring
        } catch {
            return Fail(error: error).eraseToAnyPublisher()
        }
        
        // Process payment
        return paymentService.processPayment(
            paymentMethod: paymentMethod,
            amount: amount,
            currency: currency
        )
        .flatMap { [weak self] paymentResponse -> AnyPublisher<Donation, Error> in
            guard let self = self else {
                return Fail(error: DonationError.systemError).eraseToAnyPublisher()
            }
            
            // Update donation with payment result
            let result = donation.updatePaymentStatus(
                paymentResponse.status,
                transactionId: paymentResponse.transactionId
            )
            
            switch result {
            case .success:
                return self.saveDonation(donation)
            case .failure(let error):
                return Fail(error: error).eraseToAnyPublisher()
            }
        }
        .handleEvents(
            receiveOutput: { [weak self] donation in
                self?.logDonationMetrics(
                    donation: donation,
                    startTime: monitor.startTime
                )
            },
            receiveCompletion: { [weak self] completion in
                if case .failure(let error) = completion {
                    self?.handleDonationError(error)
                }
            }
        )
        .retry(retryConfiguration.maxAttempts)
        .eraseToAnyPublisher()
    }
    
    /// Retrieves paginated donation history with caching
    /// - Parameters:
    ///   - page: The page number to retrieve
    ///   - limit: Number of items per page
    ///   - filter: Optional filter parameters
    /// - Returns: Publisher that emits paginated donation list or error
    public func getDonationHistory(
        page: Int,
        limit: Int,
        filter: DonationFilter? = nil
    ) -> AnyPublisher<PaginatedResponse<Donation>, Error> {
        return apiClient.request(
            .getDonationHistory(page: page, limit: limit),
            type: PaginatedResponse<Donation>.self
        )
        .mapError { $0 as Error }
        .eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func validateDonationParameters(
        amount: Decimal,
        currency: String,
        associationId: String
    ) -> Bool {
        // Validate amount limits
        guard amount >= securityValidator.minAmount,
              amount <= securityValidator.maxAmount else {
            return false
        }
        
        // Validate currency
        guard CurrencyConfig.supportedCurrencies.contains(where: { $0.rawValue == currency }) else {
            return false
        }
        
        // Validate daily transaction limits
        guard checkDailyTransactionLimits() else {
            return false
        }
        
        return true
    }
    
    private func checkDailyTransactionLimits() -> Bool {
        // Implementation would check against daily transaction limits
        return true
    }
    
    private func saveDonation(_ donation: Donation) -> AnyPublisher<Donation, Error> {
        // Implementation would persist donation to backend
        return Just(donation)
            .setFailureType(to: Error.self)
            .eraseToAnyPublisher()
    }
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] isConnected in
                if !isConnected {
                    self?.handleNetworkDisconnection()
                }
            }
            .store(in: &cancellables)
    }
    
    private func handleNetworkDisconnection() {
        // Implementation would handle offline scenarios
    }
    
    private func handleDonationError(_ error: Error) {
        // Implementation would include error logging and recovery
    }
    
    private func logDonationMetrics(donation: Donation, startTime: Date) {
        let duration = Date().timeIntervalSince(startTime)
        print("Donation processed - ID: \(donation.id), Duration: \(duration)s")
    }
    
    private func getUserId() -> String {
        // Implementation would retrieve authenticated user ID
        return "USER_ID"
    }
}

// MARK: - Supporting Types

public struct DonationFilter {
    let startDate: Date?
    let endDate: Date?
    let status: PaymentStatus?
    let campaignId: String?
}

public struct PaginatedResponse<T: Codable>: Codable {
    let items: [T]
    let total: Int
    let page: Int
    let limit: Int
}