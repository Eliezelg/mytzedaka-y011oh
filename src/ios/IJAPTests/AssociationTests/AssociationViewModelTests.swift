//
// AssociationViewModelTests.swift
// IJAPTests
//
// Comprehensive test suite for AssociationsListViewModel
// iOS 13.0+
//

import XCTest
import Combine
@testable import IJAP

@available(iOS 13.0, *)
final class AssociationViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: AssociationsListViewModel!
    private var mockAPIClient: MockAPIClient!
    private var cancellables: Set<AnyCancellable>!
    private var testData: TestData!
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        mockAPIClient = MockAPIClient.shared
        mockAPIClient.reset()
        cancellables = Set<AnyCancellable>()
        sut = AssociationsListViewModel()
        setupTestData()
    }
    
    override func tearDown() {
        cancellables.removeAll()
        mockAPIClient.reset()
        sut = nil
        testData = nil
        super.tearDown()
    }
    
    // MARK: - Success Tests
    
    func testLoadAssociationsSuccess() {
        // Given
        let expectation = XCTestExpectation(description: "Load associations")
        let mockAssociations = createMockAssociations()
        mockAPIClient.setMockResponse(.success(mockAssociations), for: .getAssociations(page: 1, limit: 100, locale: "en"))
        
        var loadingStates: [Bool] = []
        var receivedAssociations: [Association]?
        var receivedError: Error?
        
        // When
        let input = AssociationsListViewModelInput.loadTrigger(Just(()).eraseToAnyPublisher())
        let output = sut.transform(input: input)
        
        output.loading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)
        
        output.associations
            .sink { associations in
                receivedAssociations = associations
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedError = error
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertEqual(loadingStates, [true, false])
        XCTAssertEqual(receivedAssociations?.count, mockAssociations.count)
        XCTAssertNil(receivedError)
        XCTAssertEqual(mockAPIClient.numberOfRequests, 1)
    }
    
    func testLoadAssociationsFailure() {
        // Given
        let expectation = XCTestExpectation(description: "Load associations failure")
        mockAPIClient.setMockResponse(.failure(APIError.serverError(500)), for: .getAssociations(page: 1, limit: 100, locale: "en"))
        
        var loadingStates: [Bool] = []
        var receivedError: APIError?
        
        // When
        let input = AssociationsListViewModelInput.loadTrigger(Just(()).eraseToAnyPublisher())
        let output = sut.transform(input: input)
        
        output.loading
            .sink { isLoading in
                loadingStates.append(isLoading)
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                if let apiError = error as? APIError {
                    receivedError = apiError
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertEqual(loadingStates, [true, false])
        XCTAssertEqual(receivedError, APIError.serverError(500))
    }
    
    func testSearchAssociations() {
        // Given
        let expectation = XCTestExpectation(description: "Search associations")
        let searchQuery = "Test"
        let mockAssociations = createMockAssociations()
        mockAPIClient.setMockResponse(.success(mockAssociations), for: .getAssociations(page: 1, limit: 100, locale: "en"))
        
        var receivedAssociations: [Association]?
        
        // When
        let input = AssociationsListViewModelInput.searchTrigger(Just(searchQuery).eraseToAnyPublisher())
        let output = sut.transform(input: input)
        
        output.associations
            .sink { associations in
                receivedAssociations = associations
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertNotNil(receivedAssociations)
        XCTAssertTrue(receivedAssociations?.allSatisfy { $0.name.localizedCaseInsensitiveContains(searchQuery) } ?? false)
    }
    
    func testOfflineSupport() {
        // Given
        let expectation = XCTestExpectation(description: "Offline support")
        mockAPIClient.setNetworkCondition(.offline)
        
        var receivedSyncState: AssociationsListViewModel.SyncState?
        
        // When
        let input = AssociationsListViewModelInput.loadTrigger(Just(()).eraseToAnyPublisher())
        let output = sut.transform(input: input)
        
        output.syncState
            .sink { state in
                receivedSyncState = state
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        
        if case .needsSync = receivedSyncState {
            XCTAssertTrue(true)
        } else {
            XCTFail("Expected needsSync state")
        }
    }
    
    func testLocalization() {
        // Given
        let expectation = XCTestExpectation(description: "Localized content")
        let hebrewLocale = "he"
        let mockAssociations = createMockAssociations(locale: hebrewLocale)
        mockAPIClient.setMockResponse(.success(mockAssociations), for: .getAssociations(page: 1, limit: 100, locale: hebrewLocale))
        
        var receivedAssociations: [Association]?
        
        // When
        let input = AssociationsListViewModelInput.loadTrigger(Just(()).eraseToAnyPublisher())
        let output = sut.transform(input: input)
        
        output.associations
            .sink { associations in
                receivedAssociations = associations
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        
        XCTAssertNotNil(receivedAssociations)
        XCTAssertTrue(receivedAssociations?.allSatisfy { $0.description.keys.contains(hebrewLocale) } ?? false)
    }
    
    // MARK: - Helper Methods
    
    private func setupTestData() {
        testData = TestData()
    }
    
    private func createMockAssociations(locale: String = "en") -> [Association] {
        let address = AssociationAddress(
            street: "123 Test St",
            city: "Test City",
            state: "Test State",
            country: "Test Country",
            postalCode: "12345",
            addressFormat: "standard"
        )
        
        let legalInfo = AssociationLegalInfo(
            registrationType: "nonprofit",
            registrationDate: Date(),
            registrationCountry: "Test Country",
            taxExemptStatus: true,
            legalDocuments: ["doc1", "doc2"],
            complianceLevel: "high"
        )
        
        return (1...5).compactMap { index in
            try? Association(
                id: UUID().uuidString,
                name: "Test Association \(index)",
                email: "test\(index)@example.com",
                phone: "+1234567890",
                registrationNumber: "REG\(index)",
                taxId: "TAX\(index)",
                address: address,
                legalInfo: legalInfo
            )
        }
    }
}

// MARK: - Test Data Structure

private struct TestData {
    let associations: [Association]
    
    init() {
        self.associations = []
    }
}