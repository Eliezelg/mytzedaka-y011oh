// XCTest v13.0+
import XCTest
// Combine v13.0+
import Combine
@testable import IJAP

@available(iOS 13.0, *)
final class DonationFormViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: DonationFormViewModel!
    private var mockDonationService: MockDonationService!
    private var cancellables: Set<AnyCancellable>!
    private let testTimeout: TimeInterval = 2.0
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        mockDonationService = MockDonationService()
        sut = DonationFormViewModel(
            donationService: mockDonationService,
            associationId: "test_association_id"
        )
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        cancellables.removeAll()
        sut = nil
        mockDonationService = nil
        super.tearDown()
    }
    
    // MARK: - Form Validation Tests
    
    func testFormValidation_AllCurrencies() {
        // Given
        let input = createTestInput()
        let output = sut.transform(input: input)
        let expectation = expectation(description: "Form validation")
        var validationResults: [Bool] = []
        
        // Test USD validation
        input.amountSubject.send(18.0)
        input.currencySubject.send("USD")
        
        // Test ILS validation
        input.amountSubject.send(50.0)
        input.currencySubject.send("ILS")
        
        // Test EUR validation
        input.amountSubject.send(15.0)
        input.currencySubject.send("EUR")
        
        // When
        output.isValid
            .collect(3)
            .sink { results in
                validationResults = results
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Then
        waitForExpectations(timeout: testTimeout)
        XCTAssertEqual(validationResults, [true, true, true])
    }
    
    func testFormValidation_InvalidAmounts() {
        // Given
        let input = createTestInput()
        let output = sut.transform(input: input)
        let expectation = expectation(description: "Invalid amount validation")
        var errors: [ValidationError] = []
        
        // When
        output.validationErrors
            .sink { validationErrors in
                errors = validationErrors
                if !errors.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        input.amountSubject.send(1.0) // Below minimum
        
        // Then
        waitForExpectations(timeout: testTimeout)
        XCTAssertTrue(errors.contains(.invalidAmount))
    }
    
    // MARK: - Payment Processing Tests
    
    func testPaymentProcessing_Success() {
        // Given
        let input = createTestInput()
        let output = sut.transform(input: input)
        let expectation = expectation(description: "Payment processing")
        var result: Result<Donation, Error>?
        
        // Configure mock service
        mockDonationService.mockDonationResult = .success(createTestDonation())
        
        // When
        output.donationResult
            .sink { donationResult in
                result = donationResult
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        input.submitTrigger.send()
        
        // Then
        waitForExpectations(timeout: testTimeout)
        XCTAssertNotNil(try? result?.get())
    }
    
    func testPaymentProcessing_Failure() {
        // Given
        let input = createTestInput()
        let output = sut.transform(input: input)
        let expectation = expectation(description: "Payment failure")
        var result: Result<Donation, Error>?
        
        // Configure mock service
        mockDonationService.mockDonationResult = .failure(TestError.donationFailed)
        
        // When
        output.donationResult
            .sink { donationResult in
                result = donationResult
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        input.submitTrigger.send()
        
        // Then
        waitForExpectations(timeout: testTimeout)
        XCTAssertThrowsError(try result?.get())
    }
    
    // MARK: - Security Tests
    
    func testSecurityCompliance() {
        // Given
        let input = createTestInput()
        let output = sut.transform(input: input)
        let expectation = expectation(description: "Security validation")
        var securityStatus: ValidationStatus?
        
        // When
        output.securityStatus
            .sink { status in
                securityStatus = status
                if status == .compliance {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Test high-value transaction
        input.amountSubject.send(1_000_000.0)
        input.currencySubject.send("USD")
        
        // Then
        waitForExpectations(timeout: testTimeout)
        XCTAssertEqual(securityStatus, .compliance)
    }
    
    // MARK: - Transaction Monitoring Tests
    
    func testTransactionMonitoring() {
        // Given
        let input = createTestInput()
        let output = sut.transform(input: input)
        let expectation = expectation(description: "Transaction monitoring")
        var processingStates: [PaymentStatus] = []
        
        // When
        output.processingStatus
            .sink { status in
                processingStates.append(status)
                if status == .completed {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        mockDonationService.mockDonationResult = .success(createTestDonation())
        input.submitTrigger.send()
        
        // Then
        waitForExpectations(timeout: testTimeout)
        XCTAssertEqual(processingStates, [.pending, .processing, .completed])
    }
    
    // MARK: - Helper Methods
    
    private func createTestInput() -> DonationFormViewModel.Input {
        return DonationFormViewModel.Input(
            amountSubject: CurrentValueSubject<Decimal?, Never>(100.0),
            currencySubject: CurrentValueSubject<String, Never>("USD"),
            paymentMethodSubject: CurrentValueSubject<PaymentMethodType?, Never>(.creditCard),
            isAnonymousSubject: CurrentValueSubject<Bool, Never>(false),
            isRecurringSubject: CurrentValueSubject<Bool, Never>(false),
            recurringFrequencySubject: CurrentValueSubject<RecurringSchedule?, Never>(nil),
            dedicationSubject: CurrentValueSubject<String?, Never>(nil),
            submitTrigger: PassthroughSubject<Void, Never>(),
            cancelTrigger: PassthroughSubject<Void, Never>()
        )
    }
    
    private func createTestDonation() -> Donation {
        try! Donation(
            id: "test_donation_id",
            amount: 100.0,
            currency: "USD",
            paymentMethodType: .creditCard,
            userId: "test_user_id",
            associationId: "test_association_id"
        )
    }
}

// MARK: - Mock Objects

private enum TestError: Error {
    case donationFailed
    case networkError
    case validationError
    case securityError
}

private class MockDonationService: DonationService {
    var mockDonationResult: Result<Donation, Error>!
    
    override func createDonation(
        amount: Decimal,
        currency: String,
        associationId: String,
        paymentMethod: PaymentMethod,
        isAnonymous: Bool,
        isRecurring: Bool,
        campaignId: String?
    ) -> AnyPublisher<Donation, Error> {
        return Just(mockDonationResult)
            .flatMap { result in
                result.publisher
            }
            .eraseToAnyPublisher()
    }
}