//
// CampaignViewModelTests.swift
// IJAPTests
//
// XCTest version: iOS 13.0+
// Combine version: iOS 13.0+
//

import XCTest
import Combine
@testable import IJAP

@available(iOS 13.0, *)
final class CampaignViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: CampaignsListViewModel!
    private var cancellables: Set<AnyCancellable>!
    private var mockCampaigns: [Campaign]!
    private var mockProgress: [String: Double]!
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        cancellables = Set<AnyCancellable>()
        
        // Configure mock API client
        MockAPIClient.shared.reset()
        
        // Set up test campaign data
        let startDate = Date()
        let endDate = Calendar.current.date(byAdding: .month, value: 1, to: startDate)!
        
        mockCampaigns = try? [
            Campaign(id: "1", title: "Test Campaign 1", description: "Description 1", 
                    goalAmount: 10000, currency: "USD", startDate: startDate, 
                    endDate: endDate, associationId: "assoc1"),
            Campaign(id: "2", title: "Test Campaign 2", description: "Description 2", 
                    goalAmount: 20000, currency: "EUR", startDate: startDate, 
                    endDate: endDate, associationId: "assoc1"),
            Campaign(id: "3", title: "Lottery Campaign", description: "Description 3", 
                    goalAmount: 30000, currency: "ILS", startDate: startDate, 
                    endDate: endDate, associationId: "assoc2", isLottery: true,
                    lotteryDetails: CampaignLotteryDetails(drawDate: endDate, ticketPrice: 100, 
                                                          currency: "ILS", maxTickets: 1000, 
                                                          prizes: ["1": ["value": 10000, "description": "First Prize"]]))
        ]
        
        // Initialize view model with mock dependencies
        let campaignService = CampaignService(apiClient: MockAPIClient.shared)
        sut = CampaignsListViewModel(campaignService: campaignService)
    }
    
    override func tearDown() {
        MockAPIClient.shared.reset()
        cancellables.removeAll()
        mockCampaigns = nil
        mockProgress = nil
        sut = nil
        super.tearDown()
    }
    
    // MARK: - Test Cases
    
    func testLoadCampaignsSuccess() {
        // Given
        let expectation = XCTestExpectation(description: "Load campaigns")
        var receivedCampaigns: [Campaign]?
        var receivedError: Error?
        
        MockAPIClient.shared.setMockResponse(.success(mockCampaigns), for: .getCampaigns(associationId: nil, page: 1, limit: 20, locale: "en"))
        
        // When
        let input = CampaignsListViewModel.Input(
            viewDidLoad: PassthroughSubject<Void, Never>(),
            refresh: PassthroughSubject<Void, Never>(),
            searchText: PassthroughSubject<String?, Never>(),
            activeFilter: PassthroughSubject<Bool, Never>(),
            currencySelection: PassthroughSubject<String, Never>(),
            sortOption: PassthroughSubject<CampaignSortOption, Never>()
        )
        
        let output = sut.transform(input: input)
        
        output.campaigns
            .sink { campaigns in
                receivedCampaigns = campaigns
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        output.error
            .sink { error in
                receivedError = error
            }
            .store(in: &cancellables)
        
        input.viewDidLoad.send(())
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedCampaigns)
        XCTAssertEqual(receivedCampaigns?.count, mockCampaigns.count)
        XCTAssertNil(receivedError)
    }
    
    func testLoadCampaignsFailure() {
        // Given
        let expectation = XCTestExpectation(description: "Load campaigns error")
        var receivedError: Error?
        
        MockAPIClient.shared.setMockResponse(
            Result<[Campaign], APIError>.failure(.serverError(500)),
            for: .getCampaigns(associationId: nil, page: 1, limit: 20, locale: "en")
        )
        
        // When
        let input = CampaignsListViewModel.Input(
            viewDidLoad: PassthroughSubject<Void, Never>(),
            refresh: PassthroughSubject<Void, Never>(),
            searchText: PassthroughSubject<String?, Never>(),
            activeFilter: PassthroughSubject<Bool, Never>(),
            currencySelection: PassthroughSubject<String, Never>(),
            sortOption: PassthroughSubject<CampaignSortOption, Never>()
        )
        
        let output = sut.transform(input: input)
        
        output.error
            .sink { error in
                receivedError = error
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        input.viewDidLoad.send(())
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedError)
        XCTAssertTrue(receivedError is APIError)
    }
    
    func testFilterCampaigns() {
        // Given
        let expectation = XCTestExpectation(description: "Filter campaigns")
        var receivedCampaigns: [Campaign]?
        
        MockAPIClient.shared.setMockResponse(.success(mockCampaigns), for: .getCampaigns(associationId: nil, page: 1, limit: 20, locale: "en"))
        
        // When
        let input = CampaignsListViewModel.Input(
            viewDidLoad: PassthroughSubject<Void, Never>(),
            refresh: PassthroughSubject<Void, Never>(),
            searchText: PassthroughSubject<String?, Never>(),
            activeFilter: PassthroughSubject<Bool, Never>(),
            currencySelection: PassthroughSubject<String, Never>(),
            sortOption: PassthroughSubject<CampaignSortOption, Never>()
        )
        
        let output = sut.transform(input: input)
        
        output.campaigns
            .sink { campaigns in
                receivedCampaigns = campaigns
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        input.viewDidLoad.send(())
        input.searchText.send("Lottery")
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedCampaigns)
        XCTAssertEqual(receivedCampaigns?.count, 1)
        XCTAssertEqual(receivedCampaigns?.first?.title, "Lottery Campaign")
    }
    
    func testCurrencyConversion() {
        // Given
        let expectation = XCTestExpectation(description: "Currency conversion")
        var receivedCampaigns: [Campaign]?
        
        MockAPIClient.shared.setMockResponse(.success(mockCampaigns), for: .getCampaigns(associationId: nil, page: 1, limit: 20, locale: "en"))
        
        // When
        let input = CampaignsListViewModel.Input(
            viewDidLoad: PassthroughSubject<Void, Never>(),
            refresh: PassthroughSubject<Void, Never>(),
            searchText: PassthroughSubject<String?, Never>(),
            activeFilter: PassthroughSubject<Bool, Never>(),
            currencySelection: PassthroughSubject<String, Never>(),
            sortOption: PassthroughSubject<CampaignSortOption, Never>()
        )
        
        let output = sut.transform(input: input)
        
        output.campaigns
            .sink { campaigns in
                receivedCampaigns = campaigns
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        input.viewDidLoad.send(())
        input.currencySelection.send("EUR")
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedCampaigns)
        XCTAssertTrue(receivedCampaigns?.allSatisfy { $0.currency == "EUR" } ?? false)
    }
    
    func testSortCampaigns() {
        // Given
        let expectation = XCTestExpectation(description: "Sort campaigns")
        var receivedCampaigns: [Campaign]?
        
        MockAPIClient.shared.setMockResponse(.success(mockCampaigns), for: .getCampaigns(associationId: nil, page: 1, limit: 20, locale: "en"))
        
        // When
        let input = CampaignsListViewModel.Input(
            viewDidLoad: PassthroughSubject<Void, Never>(),
            refresh: PassthroughSubject<Void, Never>(),
            searchText: PassthroughSubject<String?, Never>(),
            activeFilter: PassthroughSubject<Bool, Never>(),
            currencySelection: PassthroughSubject<String, Never>(),
            sortOption: PassthroughSubject<CampaignSortOption, Never>()
        )
        
        let output = sut.transform(input: input)
        
        output.campaigns
            .sink { campaigns in
                receivedCampaigns = campaigns
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        input.viewDidLoad.send(())
        input.sortOption.send(.goalAmountDescending)
        
        // Then
        wait(for: [expectation], timeout: 1.0)
        XCTAssertNotNil(receivedCampaigns)
        XCTAssertEqual(receivedCampaigns?.first?.goalAmount, 30000)
    }
}