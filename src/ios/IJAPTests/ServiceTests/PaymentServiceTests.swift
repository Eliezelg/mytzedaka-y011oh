// XCTest v13.0+
import XCTest
// Combine v13.0+
import Combine
@testable import IJAP

@available(iOS 13.0, *)
final class PaymentServiceTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: PaymentService!
    private var mockAPIClient: MockAPIClient!
    private var cancellables: Set<AnyCancellable>!
    private let defaultTimeout: TimeInterval = 2.0
    
    // Test data
    private var validStripePaymentMethod: PaymentMethod!
    private var validTranzillaPaymentMethod: PaymentMethod!
    private var invalidPaymentMethod: PaymentMethod!
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        mockAPIClient = MockAPIClient.shared
        mockAPIClient.reset()
        sut = PaymentService.shared
        cancellables = Set<AnyCancellable>()
        
        // Initialize test payment methods
        validStripePaymentMethod = PaymentMethod(
            id: "test_stripe_pm",
            type: .creditCard,
            gatewayType: .stripe
        )
        validStripePaymentMethod.lastFourDigits = "4242"
        validStripePaymentMethod.expiryMonth = 12
        validStripePaymentMethod.expiryYear = 2025
        
        validTranzillaPaymentMethod = PaymentMethod(
            id: "test_tranzilla_pm",
            type: .creditCard,
            gatewayType: .tranzilla
        )
        validTranzillaPaymentMethod.lastFourDigits = "1234"
        validTranzillaPaymentMethod.expiryMonth = 12
        validTranzillaPaymentMethod.expiryYear = 2025
        validTranzillaPaymentMethod.billingAddress = Address() // Required for Tranzilla
        
        invalidPaymentMethod = PaymentMethod(
            id: "invalid_pm",
            type: .creditCard,
            gatewayType: .stripe
        )
    }
    
    override func tearDown() {
        cancellables.removeAll()
        mockAPIClient.reset()
        validStripePaymentMethod = nil
        validTranzillaPaymentMethod = nil
        invalidPaymentMethod = nil
        super.tearDown()
    }
    
    // MARK: - Stripe Payment Tests
    
    func testProcessPayment_StripeSuccess() throws {
        // Given
        let expectation = expectation(description: "Process Stripe payment")
        let amount: Decimal = 100.0
        let currency = "USD"
        
        let mockResponse = PaymentResponse(
            transactionId: "tx_123",
            status: .completed,
            amount: amount,
            currency: currency,
            timestamp: Date(),
            gatewayType: .stripe
        )
        
        mockAPIClient.setMockResponse(
            .success(mockResponse),
            for: .createStripePayment(
                campaignId: validStripePaymentMethod.id,
                amount: NSDecimalNumber(decimal: amount).doubleValue,
                currency: currency
            )
        )
        
        var resultResponse: PaymentResponse?
        var resultError: Error?
        
        // When
        sut.processPayment(
            paymentMethod: validStripePaymentMethod,
            amount: amount,
            currency: currency
        )
        .sink(
            receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    resultError = error
                }
                expectation.fulfill()
            },
            receiveValue: { response in
                resultResponse = response
            }
        )
        .store(in: &cancellables)
        
        // Then
        waitForExpectations(timeout: defaultTimeout)
        
        XCTAssertNil(resultError, "Should not have an error")
        XCTAssertNotNil(resultResponse, "Should have a response")
        XCTAssertEqual(resultResponse?.status, .completed)
        XCTAssertEqual(resultResponse?.amount, amount)
        XCTAssertEqual(resultResponse?.currency, currency)
        XCTAssertEqual(resultResponse?.gatewayType, .stripe)
    }
    
    // MARK: - Tranzilla Payment Tests
    
    func testProcessPayment_TranzillaSuccess() throws {
        // Given
        let expectation = expectation(description: "Process Tranzilla payment")
        let amount: Decimal = 100.0
        let currency = "ILS"
        
        let mockResponse = PaymentResponse(
            transactionId: "tz_123",
            status: .completed,
            amount: amount,
            currency: currency,
            timestamp: Date(),
            gatewayType: .tranzilla
        )
        
        mockAPIClient.setMockResponse(
            .success(mockResponse),
            for: .createTranzillaPayment(
                campaignId: validTranzillaPaymentMethod.id,
                amount: NSDecimalNumber(decimal: amount).doubleValue
            )
        )
        
        var resultResponse: PaymentResponse?
        var resultError: Error?
        
        // When
        sut.processPayment(
            paymentMethod: validTranzillaPaymentMethod,
            amount: amount,
            currency: currency
        )
        .sink(
            receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    resultError = error
                }
                expectation.fulfill()
            },
            receiveValue: { response in
                resultResponse = response
            }
        )
        .store(in: &cancellables)
        
        // Then
        waitForExpectations(timeout: defaultTimeout)
        
        XCTAssertNil(resultError, "Should not have an error")
        XCTAssertNotNil(resultResponse, "Should have a response")
        XCTAssertEqual(resultResponse?.status, .completed)
        XCTAssertEqual(resultResponse?.amount, amount)
        XCTAssertEqual(resultResponse?.currency, currency)
        XCTAssertEqual(resultResponse?.gatewayType, .tranzilla)
    }
    
    // MARK: - Error Handling Tests
    
    func testProcessPayment_ValidationError() throws {
        // Given
        let expectation = expectation(description: "Process payment with invalid method")
        let amount: Decimal = 100.0
        let currency = "USD"
        
        var resultError: Error?
        
        // When
        sut.processPayment(
            paymentMethod: invalidPaymentMethod,
            amount: amount,
            currency: currency
        )
        .sink(
            receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    resultError = error
                }
                expectation.fulfill()
            },
            receiveValue: { _ in
                XCTFail("Should not receive a value")
            }
        )
        .store(in: &cancellables)
        
        // Then
        waitForExpectations(timeout: defaultTimeout)
        
        XCTAssertNotNil(resultError)
        if case PaymentMethodError.validationFailed = resultError {
            // Expected error
        } else {
            XCTFail("Unexpected error type: \(String(describing: resultError))")
        }
    }
    
    func testProcessPayment_NetworkError() throws {
        // Given
        let expectation = expectation(description: "Process payment with network error")
        let amount: Decimal = 100.0
        let currency = "USD"
        
        mockAPIClient.setNetworkCondition(.offline)
        
        var resultError: Error?
        
        // When
        sut.processPayment(
            paymentMethod: validStripePaymentMethod,
            amount: amount,
            currency: currency
        )
        .sink(
            receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    resultError = error
                }
                expectation.fulfill()
            },
            receiveValue: { _ in
                XCTFail("Should not receive a value")
            }
        )
        .store(in: &cancellables)
        
        // Then
        waitForExpectations(timeout: defaultTimeout)
        
        XCTAssertNotNil(resultError)
        if case APIError.noInternetConnection = resultError {
            // Expected error
        } else {
            XCTFail("Unexpected error type: \(String(describing: resultError))")
        }
    }
    
    // MARK: - Performance Tests
    
    func testProcessPayment_Performance() throws {
        measure {
            let expectation = expectation(description: "Process payment performance")
            
            sut.processPayment(
                paymentMethod: validStripePaymentMethod,
                amount: 100.0,
                currency: "USD"
            )
            .sink(
                receiveCompletion: { _ in
                    expectation.fulfill()
                },
                receiveValue: { _ in }
            )
            .store(in: &cancellables)
            
            waitForExpectations(timeout: defaultTimeout)
        }
    }
}