// Foundation v13.0+
import Foundation
// Combine v13.0+
import Combine
// Stripe v23.0+
import Stripe

/// Service class responsible for handling payment processing through multiple payment gateways
/// with enhanced performance monitoring and error handling
@available(iOS 13.0, *)
public final class PaymentService {
    
    // MARK: - Types
    
    /// Configuration for different payment gateways
    private struct GatewayConfiguration {
        let stripePublishableKey: String
        let tranzillaTerminalId: String
        let environment: APIConfig.Environment
    }
    
    /// Response type for payment operations
    public struct PaymentResponse: Codable {
        let transactionId: String
        let status: PaymentStatus
        let amount: Decimal
        let currency: String
        let timestamp: Date
        let gatewayType: GatewayType
    }
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = PaymentService()
    
    private let apiClient: APIClient
    private let stripeClient: STPAPIClient
    private let requestTimeout: TimeInterval
    private let maxRetryAttempts: Int
    private let gatewayConfigs: GatewayConfiguration
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    private init() {
        self.apiClient = APIClient.shared
        self.requestTimeout = 2.0 // 2-second timeout as per requirements
        self.maxRetryAttempts = 3
        
        // Configure payment gateways based on environment
        #if DEBUG
        self.gatewayConfigs = GatewayConfiguration(
            stripePublishableKey: "pk_test_...",
            tranzillaTerminalId: "test_terminal",
            environment: .development
        )
        #else
        self.gatewayConfigs = GatewayConfiguration(
            stripePublishableKey: "pk_live_...",
            tranzillaTerminalId: "live_terminal",
            environment: .production
        )
        #endif
        
        // Initialize Stripe client
        self.stripeClient = STPAPIClient(publishableKey: gatewayConfigs.stripePublishableKey)
    }
    
    // MARK: - Public Methods
    
    /// Process a payment through the appropriate gateway with performance monitoring
    /// - Parameters:
    ///   - paymentMethod: The payment method to use
    ///   - amount: The payment amount
    ///   - currency: The currency code (USD, EUR, ILS)
    /// - Returns: Publisher that emits payment result or error
    public func processPayment(
        paymentMethod: PaymentMethod,
        amount: Decimal,
        currency: String
    ) -> AnyPublisher<PaymentResponse, Error> {
        // Start performance tracking
        let startTime = Date()
        
        // Validate payment method and amount
        guard case .success = paymentMethod.validate() else {
            return Fail(error: PaymentMethodError.validationFailed).eraseToAnyPublisher()
        }
        
        guard case .valid = CurrencyUtils.validateAmount(amount, currencyCode: currency) else {
            return Fail(error: PaymentMethodError.invalidCardDetails).eraseToAnyPublisher()
        }
        
        // Select appropriate gateway based on currency and region
        let gateway = selectPaymentGateway(currency: currency)
        
        return processPaymentWithGateway(
            gateway: gateway,
            paymentMethod: paymentMethod,
            amount: amount,
            currency: currency
        )
        .timeout(requestTimeout, scheduler: DispatchQueue.global())
        .retry(maxRetryAttempts)
        .handleEvents(
            receiveCompletion: { [weak self] completion in
                // Log performance metrics
                let duration = Date().timeIntervalSince(startTime)
                self?.logPaymentMetrics(
                    duration: duration,
                    gateway: gateway,
                    result: completion
                )
            }
        )
        .eraseToAnyPublisher()
    }
    
    /// Set up recurring payment with specified interval
    /// - Parameters:
    ///   - paymentMethod: The payment method to use
    ///   - amount: The recurring amount
    ///   - currency: The currency code
    ///   - interval: The recurring interval
    /// - Returns: Publisher that emits setup result or error
    public func setupRecurringPayment(
        paymentMethod: PaymentMethod,
        amount: Decimal,
        currency: String,
        interval: RecurringInterval
    ) -> AnyPublisher<PaymentResponse, Error> {
        // Implementation for recurring payments
        fatalError("Not implemented")
    }
    
    /// Cancel an existing recurring payment
    /// - Parameter subscriptionId: The subscription ID to cancel
    /// - Returns: Publisher that emits cancellation result or error
    public func cancelRecurringPayment(
        subscriptionId: String
    ) -> AnyPublisher<Bool, Error> {
        // Implementation for canceling recurring payments
        fatalError("Not implemented")
    }
    
    /// Process a refund for an existing payment
    /// - Parameters:
    ///   - transactionId: The original transaction ID
    ///   - amount: Optional partial refund amount
    /// - Returns: Publisher that emits refund result or error
    public func refundPayment(
        transactionId: String,
        amount: Decimal?
    ) -> AnyPublisher<PaymentResponse, Error> {
        // Implementation for refunds
        fatalError("Not implemented")
    }
    
    // MARK: - Private Methods
    
    private func selectPaymentGateway(currency: String) -> GatewayType {
        // Use Tranzilla for ILS transactions, Stripe for others
        return currency.uppercased() == "ILS" ? .tranzilla : .stripe
    }
    
    private func processPaymentWithGateway(
        gateway: GatewayType,
        paymentMethod: PaymentMethod,
        amount: Decimal,
        currency: String
    ) -> AnyPublisher<PaymentResponse, Error> {
        switch gateway {
        case .stripe:
            return processStripePayment(
                paymentMethod: paymentMethod,
                amount: amount,
                currency: currency
            )
        case .tranzilla:
            return processTranzillaPayment(
                paymentMethod: paymentMethod,
                amount: amount
            )
        }
    }
    
    private func processStripePayment(
        paymentMethod: PaymentMethod,
        amount: Decimal,
        currency: String
    ) -> AnyPublisher<PaymentResponse, Error> {
        do {
            let stripePaymentMethod = try paymentMethod.toStripePaymentMethod()
            return apiClient.request(
                .createStripePayment(
                    campaignId: paymentMethod.id,
                    amount: NSDecimalNumber(decimal: amount).doubleValue,
                    currency: currency
                ),
                type: PaymentResponse.self
            )
            .mapError { $0 as Error }
            .eraseToAnyPublisher()
        } catch {
            return Fail(error: error).eraseToAnyPublisher()
        }
    }
    
    private func processTranzillaPayment(
        paymentMethod: PaymentMethod,
        amount: Decimal
    ) -> AnyPublisher<PaymentResponse, Error> {
        do {
            let tranzillaParams = try paymentMethod.toTranzillaPaymentMethod()
            return apiClient.request(
                .createTranzillaPayment(
                    campaignId: paymentMethod.id,
                    amount: NSDecimalNumber(decimal: amount).doubleValue
                ),
                type: PaymentResponse.self
            )
            .mapError { $0 as Error }
            .eraseToAnyPublisher()
        } catch {
            return Fail(error: error).eraseToAnyPublisher()
        }
    }
    
    private func logPaymentMetrics(
        duration: TimeInterval,
        gateway: GatewayType,
        result: Subscribers.Completion<Error>
    ) {
        // Implementation would include analytics and monitoring
        let success = if case .finished = result { true } else { false }
        print("Payment processed - Gateway: \(gateway), Duration: \(duration)s, Success: \(success)")
    }
}

// MARK: - Supporting Types

public enum RecurringInterval {
    case weekly
    case monthly
    case quarterly
    case yearly
}