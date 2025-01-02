import XCTest // Version: Latest - iOS 16.0+

class DonationFlowUITests: XCTestCase {
    
    // MARK: - Properties
    private var app: XCUIApplication!
    
    // MARK: - Test Configuration Constants
    private enum TestConstants {
        static let minimumDonation: Double = 18.0
        static let maximumDonation: Double = 1000000.0
        static let defaultCurrency = "USD"
        static let testStripeCard = "4242424242424242"
        static let testTranzillaCard = "4580458045804580"
        static let timeoutDuration: TimeInterval = 10
    }
    
    // MARK: - Setup and Teardown
    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["UI-Testing"]
        app.launchEnvironment = [
            "STRIPE_TEST_MODE": "true",
            "TRANZILLA_TEST_MODE": "true",
            "DEFAULT_CURRENCY": TestConstants.defaultCurrency
        ]
        app.launch()
        
        // Navigate to donation form
        app.buttons["donateButton"].tap()
        
        // Wait for donation form to load
        let donationForm = app.otherElements["donationFormView"]
        XCTAssertTrue(donationForm.waitForExistence(timeout: TestConstants.timeoutDuration))
    }
    
    override func tearDownWithError() throws {
        // Clear test state
        app.terminate()
        app = nil
        super.tearDown()
    }
    
    // MARK: - Form Validation Tests
    func testDonationFormValidation() throws {
        // Test empty amount validation
        let donateButton = app.buttons["proceedToPaymentButton"]
        donateButton.tap()
        XCTAssertTrue(app.staticTexts["amountErrorLabel"].exists)
        
        // Test minimum amount validation
        let amountField = app.textFields["amountTextField"]
        amountField.tap()
        amountField.typeText("10")  // Below minimum
        donateButton.tap()
        XCTAssertTrue(app.staticTexts["minimumAmountError"].exists)
        
        // Test maximum amount validation
        amountField.tap()
        amountField.typeText(String(TestConstants.maximumDonation + 1))
        donateButton.tap()
        XCTAssertTrue(app.staticTexts["maximumAmountError"].exists)
        
        // Test currency selection
        let currencyButton = app.buttons["currencySelector"]
        currencyButton.tap()
        app.buttons["ILS"].tap()
        XCTAssertEqual(app.buttons["currencySelector"].label, "ILS")
        
        // Test payment method validation
        donateButton.tap()
        XCTAssertTrue(app.staticTexts["paymentMethodError"].exists)
        
        // Test recurring donation selection
        let recurringSwitch = app.switches["recurringDonationSwitch"]
        recurringSwitch.tap()
        XCTAssertTrue(app.buttons["frequencySelector"].exists)
        
        // Test accessibility
        XCTAssertTrue(amountField.isAccessibilityElement)
        XCTAssertTrue(donateButton.isAccessibilityElement)
    }
    
    // MARK: - Donation Submission Tests
    func testDonationFormSubmission() throws {
        // Test Stripe Connect flow
        let amountField = app.textFields["amountTextField"]
        amountField.tap()
        amountField.typeText("100")
        
        app.buttons["paymentMethodSelector"].tap()
        app.buttons["creditCardOption"].tap()
        
        let cardNumberField = app.textFields["cardNumberField"]
        cardNumberField.tap()
        cardNumberField.typeText(TestConstants.testStripeCard)
        
        app.textFields["expiryField"].typeText("1225")
        app.textFields["cvcField"].typeText("123")
        
        app.buttons["proceedToPaymentButton"].tap()
        
        // Verify successful payment
        XCTAssertTrue(app.staticTexts["successMessage"].waitForExistence(timeout: TestConstants.timeoutDuration))
        
        // Test Tranzilla flow (Israeli market)
        app.buttons["newDonationButton"].tap()
        app.buttons["currencySelector"].tap()
        app.buttons["ILS"].tap()
        
        amountField.tap()
        amountField.typeText("360")
        
        app.buttons["paymentMethodSelector"].tap()
        app.buttons["israeliCreditOption"].tap()
        
        let tranzillaCardField = app.textFields["israeliCardNumberField"]
        tranzillaCardField.tap()
        tranzillaCardField.typeText(TestConstants.testTranzillaCard)
        
        app.textFields["israeliExpiryField"].typeText("1225")
        app.textFields["israeliCvvField"].typeText("123")
        app.textFields["israeliIdField"].typeText("123456789")
        
        app.buttons["proceedToPaymentButton"].tap()
        
        // Verify successful Israeli payment
        XCTAssertTrue(app.staticTexts["successMessage"].waitForExistence(timeout: TestConstants.timeoutDuration))
    }
    
    // MARK: - Confirmation Screen Tests
    func testDonationConfirmation() throws {
        // Setup successful donation first
        try setupTestDonation()
        
        // Verify confirmation screen elements
        let confirmationView = app.otherElements["donationConfirmationView"]
        XCTAssertTrue(confirmationView.exists)
        
        // Test receipt download
        let receiptButton = app.buttons["downloadReceiptButton"]
        XCTAssertTrue(receiptButton.exists)
        receiptButton.tap()
        XCTAssertTrue(app.staticTexts["receiptDownloadSuccess"].waitForExistence(timeout: TestConstants.timeoutDuration))
        
        // Test tax receipt generation
        let taxReceiptButton = app.buttons["generateTaxReceiptButton"]
        XCTAssertTrue(taxReceiptButton.exists)
        taxReceiptButton.tap()
        XCTAssertTrue(app.staticTexts["taxReceiptGenerated"].waitForExistence(timeout: TestConstants.timeoutDuration))
        
        // Test sharing functionality
        let shareButton = app.buttons["shareButton"]
        XCTAssertTrue(shareButton.exists)
        shareButton.tap()
        XCTAssertTrue(app.otherElements["ActivityListView"].exists)
        
        // Verify donation details
        XCTAssertTrue(app.staticTexts["donationAmount"].exists)
        XCTAssertTrue(app.staticTexts["donationDate"].exists)
        XCTAssertTrue(app.staticTexts["transactionId"].exists)
        
        // Test navigation options
        let newDonationButton = app.buttons["makeNewDonationButton"]
        XCTAssertTrue(newDonationButton.exists)
        newDonationButton.tap()
        XCTAssertTrue(app.otherElements["donationFormView"].waitForExistence(timeout: TestConstants.timeoutDuration))
    }
    
    // MARK: - Helper Methods
    private func setupTestDonation() throws {
        let amountField = app.textFields["amountTextField"]
        amountField.tap()
        amountField.typeText("100")
        
        app.buttons["paymentMethodSelector"].tap()
        app.buttons["creditCardOption"].tap()
        
        let cardNumberField = app.textFields["cardNumberField"]
        cardNumberField.tap()
        cardNumberField.typeText(TestConstants.testStripeCard)
        
        app.textFields["expiryField"].typeText("1225")
        app.textFields["cvcField"].typeText("123")
        
        app.buttons["proceedToPaymentButton"].tap()
        
        XCTAssertTrue(app.otherElements["donationConfirmationView"].waitForExistence(timeout: TestConstants.timeoutDuration))
    }
}