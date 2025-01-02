//
// DonationHistoryViewModelTests.swift
// IJAPTests
//
// Foundation version: iOS 13.0+
// XCTest version: iOS 13.0+
// Combine version: iOS 13.0+
//

import XCTest
import Combine
@testable import IJAP

@available(iOS 13.0, *)
final class DonationHistoryViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: DonationHistoryViewModel!
    private var mockAPIClient: MockAPIClient!
    private var cancellables: Set<AnyCancellable>!
    private let testTimeout: TimeInterval = 2.0 // As per performance requirements
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        mockAPIClient = MockAPIClient.shared
        sut = DonationHistoryViewModel(donationService: DonationService())
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        mockAPIClient.reset()
        cancellables.removeAll()
        sut = nil
        super.tearDown()
    }
    
    // MARK: - Initial Load Tests
    
    func testLoadDonationHistory_Success() {
        // Given
        let expectation = XCTestExpectation(description: "Load donations")
        let mockDonations = createMockDonations(count: 20)
        let mockResponse = PaginatedResponse(items: mockDonations, total: 50, page: 1, limit: 20)
        
        mockAPIClient.setMockResponse(.success(mockResponse), for: .getDonationHistory(page: 1, limit: 20))
        
        var loadingStates: [DonationHistoryViewModel.LoadingState] = []
        var receivedDonations: [Donation] = []
        var hasMore = false
        
        // When
        let input = DonationHistoryViewModel.DonationHistoryInput(
            action: Just(.loadHistory).eraseToAnyPublisher(),
            cancellationToken: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.loadingState
            .sink { state in
                loadingStates.append(state)
            }
            .store(in: &cancellables)
        
        output.donations
            .sink { donations in
                receivedDonations = donations
                if !donations.isEmpty {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        output.hasMorePages
            .sink { value in
                hasMore = value
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: testTimeout)
        
        XCTAssertEqual(loadingStates, [.loading, .idle])
        XCTAssertEqual(receivedDonations.count, 20)
        XCTAssertTrue(hasMore)
        XCTAssertEqual(mockAPIClient.numberOfRequests, 1)
    }
    
    func testLoadDonationHistory_Error() {
        // Given
        let expectation = XCTestExpectation(description: "Load donations error")
        mockAPIClient.setMockResponse(
            Result<PaginatedResponse<Donation>, APIError>.failure(.networkError(NSError())),
            for: .getDonationHistory(page: 1, limit: 20)
        )
        
        var receivedError: LocalizedError?
        var loadingStates: [DonationHistoryViewModel.LoadingState] = []
        
        // When
        let input = DonationHistoryViewModel.DonationHistoryInput(
            action: Just(.loadHistory).eraseToAnyPublisher(),
            cancellationToken: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.error
            .sink { error in
                receivedError = error
                if error != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        output.loadingState
            .sink { state in
                loadingStates.append(state)
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: testTimeout)
        
        XCTAssertNotNil(receivedError)
        XCTAssertEqual(loadingStates.last, .error(receivedError?.localizedDescription ?? ""))
    }
    
    // MARK: - Pagination Tests
    
    func testLoadMoreDonations_Success() {
        // Given
        let initialExpectation = XCTestExpectation(description: "Initial load")
        let loadMoreExpectation = XCTestExpectation(description: "Load more")
        
        let initialDonations = createMockDonations(count: 20)
        let additionalDonations = createMockDonations(count: 20, startId: 21)
        
        mockAPIClient.setMockResponse(
            .success(PaginatedResponse(items: initialDonations, total: 50, page: 1, limit: 20)),
            for: .getDonationHistory(page: 1, limit: 20)
        )
        
        mockAPIClient.setMockResponse(
            .success(PaginatedResponse(items: additionalDonations, total: 50, page: 2, limit: 20)),
            for: .getDonationHistory(page: 2, limit: 20)
        )
        
        var allReceivedDonations: [Donation] = []
        
        // When
        let input = DonationHistoryViewModel.DonationHistoryInput(
            action: Just(.loadHistory).eraseToAnyPublisher(),
            cancellationToken: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.donations
            .sink { donations in
                allReceivedDonations = donations
                if donations.count == 20 {
                    initialExpectation.fulfill()
                    // Trigger load more after initial load
                    input.action.send(.loadMore)
                } else if donations.count == 40 {
                    loadMoreExpectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [initialExpectation, loadMoreExpectation], timeout: testTimeout)
        
        XCTAssertEqual(allReceivedDonations.count, 40)
        XCTAssertEqual(mockAPIClient.numberOfRequests, 2)
    }
    
    // MARK: - Offline Behavior Tests
    
    func testLoadDonationHistory_Offline() {
        // Given
        let expectation = XCTestExpectation(description: "Offline error")
        mockAPIClient.setNetworkCondition(.offline)
        
        var receivedError: LocalizedError?
        var loadingStates: [DonationHistoryViewModel.LoadingState] = []
        
        // When
        let input = DonationHistoryViewModel.DonationHistoryInput(
            action: Just(.loadHistory).eraseToAnyPublisher(),
            cancellationToken: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.error
            .sink { error in
                receivedError = error
                if error != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        output.loadingState
            .sink { state in
                loadingStates.append(state)
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: testTimeout)
        
        XCTAssertEqual(receivedError as? APIError, .noInternetConnection)
        XCTAssertEqual(loadingStates, [.loading, .error("No internet connection")])
    }
    
    // MARK: - Performance Tests
    
    func testLoadDonationHistory_Timeout() {
        // Given
        let expectation = XCTestExpectation(description: "Timeout error")
        mockAPIClient.setNetworkCondition(.veryPoor)
        mockAPIClient.setMockTimeout(testTimeout + 1, for: .getDonationHistory(page: 1, limit: 20))
        
        var receivedError: LocalizedError?
        
        // When
        let input = DonationHistoryViewModel.DonationHistoryInput(
            action: Just(.loadHistory).eraseToAnyPublisher(),
            cancellationToken: Empty().eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.error
            .sink { error in
                receivedError = error
                if error != nil {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: testTimeout + 0.5)
        
        XCTAssertEqual(receivedError as? APIError, .timeoutError)
    }
    
    // MARK: - Helper Methods
    
    private func createMockDonations(count: Int, startId: Int = 1) -> [Donation] {
        return (startId...(startId + count - 1)).map { id in
            try! Donation(
                id: "donation_\(id)",
                amount: Decimal(100),
                currency: "USD",
                paymentMethodType: .creditCard,
                userId: "user_1",
                associationId: "assoc_1"
            )
        }
    }
}