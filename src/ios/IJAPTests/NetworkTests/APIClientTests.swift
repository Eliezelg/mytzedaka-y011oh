//
// APIClientTests.swift
// IJAPTests
//
// XCTest version: iOS 13.0+
// Combine version: iOS 13.0+
//

import XCTest
import Combine
@testable import IJAP

@available(iOS 13.0, *)
final class APIClientTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: APIClient!
    private var mockClient: MockAPIClient!
    private var cancellables: Set<AnyCancellable>!
    private let defaultTimeout: TimeInterval = 30.0
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        sut = APIClient.shared
        mockClient = MockAPIClient.shared
        cancellables = Set<AnyCancellable>()
        mockClient.reset()
    }
    
    override func tearDown() {
        cancellables.removeAll()
        mockClient.reset()
        super.tearDown()
    }
    
    // MARK: - Request Tests
    
    func testSuccessfulRequest() throws {
        // Given
        let expectation = XCTestExpectation(description: "Successful API request")
        let mockResponse = ["id": "123", "name": "Test Association"]
        mockClient.setMockResponse(.success(mockResponse), for: .getAssociationDetail(id: "123", locale: "en"))
        
        // When
        sut.request(.getAssociationDetail(id: "123", locale: "en"), type: [String: String].self)
            .sink(receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    XCTFail("Request failed with error: \(error)")
                }
            }, receiveValue: { response in
                // Then
                XCTAssertEqual(response["id"], "123")
                XCTAssertEqual(response["name"], "Test Association")
                expectation.fulfill()
            })
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: defaultTimeout)
    }
    
    func testRequestWithNetworkError() {
        // Given
        let expectation = XCTestExpectation(description: "Network error handling")
        mockClient.setNetworkCondition(.offline)
        
        // When
        sut.request(.getUserProfile, type: [String: String].self)
            .sink(receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    // Then
                    XCTAssertEqual(error, APIError.noInternetConnection)
                    expectation.fulfill()
                }
            }, receiveValue: { _ in
                XCTFail("Should not receive value")
            })
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: defaultTimeout)
    }
    
    // MARK: - Payment Gateway Tests
    
    func testStripePaymentIntegration() {
        // Given
        let expectation = XCTestExpectation(description: "Stripe payment processing")
        let paymentData = [
            "payment_intent_id": "pi_123",
            "client_secret": "secret_123",
            "status": "succeeded"
        ]
        mockClient.setMockResponse(.success(paymentData), for: .createStripePayment(
            campaignId: "campaign_123",
            amount: 100.0,
            currency: "USD"
        ))
        
        // When
        sut.request(
            .createStripePayment(
                campaignId: "campaign_123",
                amount: 100.0,
                currency: "USD"
            ),
            type: [String: String].self
        )
        .sink(receiveCompletion: { completion in
            if case .failure(let error) = completion {
                XCTFail("Payment failed with error: \(error)")
            }
        }, receiveValue: { response in
            // Then
            XCTAssertEqual(response["status"], "succeeded")
            XCTAssertEqual(response["payment_intent_id"], "pi_123")
            expectation.fulfill()
        })
        .store(in: &cancellables)
        
        wait(for: [expectation], timeout: defaultTimeout)
    }
    
    func testTranzillaPaymentIntegration() {
        // Given
        let expectation = XCTestExpectation(description: "Tranzilla payment processing")
        let paymentData = [
            "transaction_id": "tr_456",
            "status": "approved",
            "currency": "ILS"
        ]
        mockClient.setMockResponse(.success(paymentData), for: .createTranzillaPayment(
            campaignId: "campaign_456",
            amount: 1000.0
        ))
        
        // When
        sut.request(
            .createTranzillaPayment(
                campaignId: "campaign_456",
                amount: 1000.0
            ),
            type: [String: String].self
        )
        .sink(receiveCompletion: { completion in
            if case .failure(let error) = completion {
                XCTFail("Payment failed with error: \(error)")
            }
        }, receiveValue: { response in
            // Then
            XCTAssertEqual(response["status"], "approved")
            XCTAssertEqual(response["currency"], "ILS")
            expectation.fulfill()
        })
        .store(in: &cancellables)
        
        wait(for: [expectation], timeout: defaultTimeout)
    }
    
    // MARK: - Upload Tests
    
    func testDocumentUpload() {
        // Given
        let expectation = XCTestExpectation(description: "Document upload")
        let testData = "test".data(using: .utf8)!
        let progress = Progress(totalUnitCount: 100)
        progress.completedUnitCount = 50
        
        mockClient.setMockProgress(progress, for: .uploadDocument(
            type: "tax_receipt",
            documentId: "doc_123",
            locale: "en"
        ))
        
        // When
        sut.upload(
            data: testData,
            mimeType: "application/pdf",
            to: .uploadDocument(
                type: "tax_receipt",
                documentId: "doc_123",
                locale: "en"
            )
        )
        .sink(receiveCompletion: { completion in
            if case .failure(let error) = completion {
                XCTFail("Upload failed with error: \(error)")
            }
        }, receiveValue: { uploadProgress in
            // Then
            XCTAssertEqual(uploadProgress.fractionCompleted, 0.5)
            expectation.fulfill()
        })
        .store(in: &cancellables)
        
        wait(for: [expectation], timeout: defaultTimeout)
    }
    
    // MARK: - Security Tests
    
    func testUnauthorizedAccess() {
        // Given
        let expectation = XCTestExpectation(description: "Unauthorized access handling")
        mockClient.setMockResponse(.failure(APIError.unauthorized), for: .getUserProfile)
        
        // When
        sut.request(.getUserProfile, type: [String: String].self)
            .sink(receiveCompletion: { completion in
                if case .failure(let error) = completion {
                    // Then
                    XCTAssertEqual(error, APIError.unauthorized)
                    expectation.fulfill()
                }
            }, receiveValue: { _ in
                XCTFail("Should not receive value")
            })
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: defaultTimeout)
    }
    
    func testRequestCancellation() {
        // Given
        let expectation = XCTestExpectation(description: "Request cancellation")
        mockClient.setMockResponse(.failure(APIError.cancelled), for: .getCampaigns(
            associationId: nil,
            page: 1,
            limit: 10,
            locale: "en"
        ))
        
        // When
        let request = sut.request(
            .getCampaigns(
                associationId: nil,
                page: 1,
                limit: 10,
                locale: "en"
            ),
            type: [String: Any].self
        )
        .sink(receiveCompletion: { completion in
            if case .failure(let error) = completion {
                // Then
                XCTAssertEqual(error, APIError.cancelled)
                expectation.fulfill()
            }
        }, receiveValue: { _ in
            XCTFail("Should not receive value")
        })
        
        request.store(in: &cancellables)
        sut.cancelAllRequests()
        
        wait(for: [expectation], timeout: defaultTimeout)
    }
}