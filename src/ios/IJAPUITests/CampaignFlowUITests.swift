//
// CampaignFlowUITests.swift
// IJAPUITests
//
// UI test suite for campaign-related flows in the IJAP iOS application
// XCTest Version: Latest
//

import XCTest

class CampaignFlowUITests: XCTestCase {
    
    // MARK: - Properties
    
    private var app: XCUIApplication!
    private let defaultTimeout: TimeInterval = 10.0
    
    // MARK: - Setup & Teardown
    
    override func setUpWithError() throws {
        try super.setUpWithError()
        continueAfterFailure = false
        
        // Initialize and configure test application
        app = XCUIApplication()
        app.launchArguments = ["UI_TESTING"]
        app.launchEnvironment = [
            "ENVIRONMENT": "TEST",
            "DISABLE_ANIMATIONS": "1",
            "RESET_STATE": "1"
        ]
        
        // Launch application
        app.launch()
        
        // Navigate to campaigns section
        let campaignsTab = app.tabBars.buttons["Campaigns"]
        XCTAssertTrue(campaignsTab.waitForExistence(timeout: defaultTimeout))
        campaignsTab.tap()
    }
    
    override func tearDownWithError() throws {
        // Clean up test environment
        app.terminate()
        app = nil
        try super.tearDownWithError()
    }
    
    // MARK: - Test Cases
    
    func testCampaignListLoading() throws {
        // Verify campaign list container exists
        let campaignList = app.collectionViews["campaignListCollectionView"]
        XCTAssertTrue(campaignList.waitForExistence(timeout: defaultTimeout))
        
        // Verify loading indicator appears and disappears
        let loadingIndicator = app.activityIndicators["loadingIndicator"]
        XCTAssertTrue(loadingIndicator.exists)
        XCTAssertFalse(loadingIndicator.waitForExistence(timeout: defaultTimeout))
        
        // Test pull-to-refresh
        campaignList.swipeDown()
        XCTAssertTrue(loadingIndicator.exists)
        XCTAssertFalse(loadingIndicator.waitForExistence(timeout: defaultTimeout))
        
        // Verify campaign cells exist and are interactive
        let campaignCells = campaignList.cells
        XCTAssertGreaterThan(campaignCells.count, 0)
        
        // Verify campaign cell elements
        let firstCell = campaignCells.element(boundBy: 0)
        XCTAssertTrue(firstCell.images["campaignImage"].exists)
        XCTAssertTrue(firstCell.staticTexts["campaignTitle"].exists)
        XCTAssertTrue(firstCell.staticTexts["campaignProgress"].exists)
        XCTAssertTrue(firstCell.progressIndicators["progressBar"].exists)
    }
    
    func testCampaignSearch() throws {
        // Tap search field
        let searchField = app.searchFields["Search campaigns"]
        XCTAssertTrue(searchField.waitForExistence(timeout: defaultTimeout))
        searchField.tap()
        
        // Test search functionality
        searchField.typeText("Test Campaign")
        
        // Verify search results
        let searchResults = app.collectionViews["campaignListCollectionView"]
        XCTAssertTrue(searchResults.waitForExistence(timeout: defaultTimeout))
        
        // Test empty search results
        searchField.buttons["Clear text"].tap()
        searchField.typeText("NonexistentCampaign123")
        
        let emptyStateView = app.otherElements["emptyStateView"]
        XCTAssertTrue(emptyStateView.waitForExistence(timeout: defaultTimeout))
        
        // Clear search
        searchField.buttons["Cancel"].tap()
    }
    
    func testCampaignDetailView() throws {
        // Select first campaign
        let campaignList = app.collectionViews["campaignListCollectionView"]
        let firstCampaign = campaignList.cells.element(boundBy: 0)
        firstCampaign.tap()
        
        // Verify campaign detail elements
        let detailView = app.scrollViews["campaignDetailScrollView"]
        XCTAssertTrue(detailView.waitForExistence(timeout: defaultTimeout))
        
        // Verify essential elements
        XCTAssertTrue(detailView.images["headerImage"].exists)
        XCTAssertTrue(detailView.staticTexts["campaignTitle"].exists)
        XCTAssertTrue(detailView.staticTexts["organizationName"].exists)
        XCTAssertTrue(detailView.staticTexts["campaignDescription"].exists)
        XCTAssertTrue(detailView.progressIndicators["progressBar"].exists)
        XCTAssertTrue(app.buttons["Donate Now"].exists)
        
        // Test share functionality
        let shareButton = app.buttons["shareButton"]
        XCTAssertTrue(shareButton.exists)
        shareButton.tap()
        XCTAssertTrue(app.sheets["Share Campaign"].waitForExistence(timeout: defaultTimeout))
    }
    
    func testCampaignDonationFlow() throws {
        // Navigate to campaign detail
        let campaignList = app.collectionViews["campaignListCollectionView"]
        let firstCampaign = campaignList.cells.element(boundBy: 0)
        firstCampaign.tap()
        
        // Initiate donation
        let donateButton = app.buttons["Donate Now"]
        XCTAssertTrue(donateButton.waitForExistence(timeout: defaultTimeout))
        donateButton.tap()
        
        // Verify donation form
        let donationForm = app.scrollViews["donationFormScrollView"]
        XCTAssertTrue(donationForm.waitForExistence(timeout: defaultTimeout))
        
        // Test amount selection
        let customAmountField = donationForm.textFields["customAmount"]
        customAmountField.tap()
        customAmountField.typeText("100")
        
        // Test payment method selection
        let paymentMethodButton = app.buttons["selectPaymentMethod"]
        paymentMethodButton.tap()
        XCTAssertTrue(app.sheets["Payment Methods"].waitForExistence(timeout: defaultTimeout))
        
        // Test recurring donation toggle
        let recurringToggle = donationForm.switches["recurringDonation"]
        recurringToggle.tap()
        XCTAssertTrue(app.buttons["frequencySelector"].exists)
    }
    
    func testRTLLayoutSupport() throws {
        // Change to Hebrew language
        let settingsButton = app.buttons["settingsButton"]
        settingsButton.tap()
        
        let languageCell = app.cells["languageSettings"]
        languageCell.tap()
        
        let hebrewOption = app.cells["Hebrew"]
        hebrewOption.tap()
        
        // Verify RTL layout
        let campaignList = app.collectionViews["campaignListCollectionView"]
        XCTAssertTrue(campaignList.waitForExistence(timeout: defaultTimeout))
        
        // Verify text alignment
        let firstCell = campaignList.cells.element(boundBy: 0)
        let titleLabel = firstCell.staticTexts["campaignTitle"]
        XCTAssertEqual(titleLabel.horizontalAlignment, .right)
        
        // Test RTL navigation
        firstCell.tap()
        let backButton = app.buttons["backButton"]
        XCTAssertTrue(backButton.exists)
        XCTAssertEqual(backButton.frame.minX, UIScreen.main.bounds.width - backButton.frame.width)
        
        // Verify RTL scroll direction
        let detailView = app.scrollViews["campaignDetailScrollView"]
        XCTAssertTrue(detailView.waitForExistence(timeout: defaultTimeout))
        detailView.swipeRight()
        
        // Reset language
        backButton.tap()
        settingsButton.tap()
        languageCell.tap()
        app.cells["English"].tap()
    }
}