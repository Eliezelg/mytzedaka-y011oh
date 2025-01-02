//
// LoginViewModelTests.swift
// IJAPTests
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import XCTest
import Combine
@testable import IJAP

@available(iOS 13.0, *)
final class LoginViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: LoginViewModel!
    private var mockAuthService: MockAuthService!
    private var cancellables: Set<AnyCancellable>!
    private var outputEvents: [LoginViewModel.Output]!
    private let inputSubject = PassthroughSubject<LoginViewModel.Input, Never>()
    
    // MARK: - Test Constants
    
    private let testTimeout: TimeInterval = 5.0
    private let validEmail = "test@example.com"
    private let validPassword = "Test123!@#"
    private let invalidEmail = "invalid.email"
    private let invalidPassword = "weak"
    
    // MARK: - Setup & Teardown
    
    override func setUp() {
        super.setUp()
        mockAuthService = MockAuthService.shared
        mockAuthService.reset()
        sut = LoginViewModel()
        cancellables = Set<AnyCancellable>()
        outputEvents = []
        
        // Subscribe to view model outputs
        sut.transform(input: inputSubject.eraseToAnyPublisher())
            .sink { [weak self] output in
                self?.outputEvents.append(output)
            }
            .store(in: &cancellables)
    }
    
    override func tearDown() {
        outputEvents = nil
        cancellables = nil
        sut = nil
        mockAuthService.reset()
        super.tearDown()
    }
    
    // MARK: - Email Validation Tests
    
    func testEmailValidation() {
        // Test valid email formats
        let validEmails = [
            "test@example.com",
            "user.name+tag@domain.co.uk",
            "hebrew@דוגמה.קום",
            "user@domain.com"
        ]
        
        validEmails.forEach { email in
            inputSubject.send(.emailChanged(email))
            XCTAssertFalse(outputEvents.contains(where: { 
                if case .validationError = $0 { return true }
                return false
            }), "Email \(email) should be valid")
        }
        
        // Test invalid email formats
        let invalidEmails = [
            "invalid.email",
            "@nodomain.com",
            "spaces in@email.com",
            "missing.domain@",
            ""
        ]
        
        invalidEmails.forEach { email in
            inputSubject.send(.emailChanged(email))
            XCTAssertTrue(outputEvents.contains(where: {
                if case .validationError = $0 { return true }
                return false
            }), "Email \(email) should be invalid")
        }
    }
    
    // MARK: - Password Validation Tests
    
    func testPasswordValidation() {
        // Test valid password formats
        let validPasswords = [
            "Test123!@#",
            "SecureP@ssw0rd",
            "Complex1ty!2023",
            "P@ssw0rd!123"
        ]
        
        validPasswords.forEach { password in
            inputSubject.send(.passwordChanged(password))
            XCTAssertFalse(outputEvents.contains(where: {
                if case .validationError = $0 { return true }
                return false
            }), "Password \(password) should be valid")
        }
        
        // Test invalid password formats
        let invalidPasswords = [
            "short",
            "nodigits!",
            "NO_LOWERCASE_123",
            "no_uppercase_123",
            "NoSpecialChars123"
        ]
        
        invalidPasswords.forEach { password in
            inputSubject.send(.passwordChanged(password))
            XCTAssertTrue(outputEvents.contains(where: {
                if case .validationError = $0 { return true }
                return false
            }), "Password \(password) should be invalid")
        }
    }
    
    // MARK: - Login Flow Tests
    
    func testSuccessfulLogin() {
        let expectation = XCTestExpectation(description: "Login success")
        mockAuthService.shouldSucceed = true
        
        // Setup mock user
        let mockUser = try? User(
            id: UUID().uuidString,
            email: validEmail,
            firstName: "Test",
            lastName: "User",
            role: .donor,
            preferredLanguage: .english,
            isVerified: true,
            isTwoFactorEnabled: false,
            createdAt: Date(),
            updatedAt: Date()
        )
        mockAuthService.mockUser = mockUser
        
        // Monitor login success output
        sut.transform(input: inputSubject.eraseToAnyPublisher())
            .sink { output in
                if case .loginSuccess(let user) = output {
                    XCTAssertEqual(user.email, self.validEmail)
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Perform login
        inputSubject.send(.emailChanged(validEmail))
        inputSubject.send(.passwordChanged(validPassword))
        inputSubject.send(.loginTapped)
        
        wait(for: [expectation], timeout: testTimeout)
    }
    
    func testFailedLogin() {
        let expectation = XCTestExpectation(description: "Login failure")
        mockAuthService.shouldSucceed = false
        
        sut.transform(input: inputSubject.eraseToAnyPublisher())
            .sink { output in
                if case .loginFailure = output {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        inputSubject.send(.emailChanged(validEmail))
        inputSubject.send(.passwordChanged(validPassword))
        inputSubject.send(.loginTapped)
        
        wait(for: [expectation], timeout: testTimeout)
    }
    
    // MARK: - Biometric Authentication Tests
    
    func testBiometricAuthentication() {
        let expectation = XCTestExpectation(description: "Biometric authentication")
        mockAuthService.shouldSucceed = true
        
        sut.transform(input: inputSubject.eraseToAnyPublisher())
            .sink { output in
                if case .biometricAvailable(let available) = output {
                    XCTAssertTrue(available)
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        inputSubject.send(.biometricLoginTapped)
        
        wait(for: [expectation], timeout: testTimeout)
    }
    
    // MARK: - Localization Tests
    
    func testLocalizationSupport() {
        let languages: [SupportedLanguage] = [.english, .hebrew, .french]
        
        languages.forEach { language in
            inputSubject.send(.languageChanged(language))
            
            // Verify error messages are localized
            inputSubject.send(.emailChanged(invalidEmail))
            XCTAssertTrue(outputEvents.contains(where: {
                if case .validationError(let error) = $0 {
                    return error?.localizedDescription.contains(
                        NSLocalizedString(
                            "login.error.invalid_email",
                            tableName: "Login",
                            bundle: .main,
                            comment: ""
                        )
                    ) ?? false
                }
                return false
            }))
        }
    }
    
    // MARK: - State Management Tests
    
    func testLoadingState() {
        let expectation = XCTestExpectation(description: "Loading state")
        mockAuthService.mockDelay = 1.0
        
        var loadingStates: [Bool] = []
        sut.transform(input: inputSubject.eraseToAnyPublisher())
            .sink { output in
                if case .isLoading(let isLoading) = output {
                    loadingStates.append(isLoading)
                    if loadingStates.count == 2 {
                        XCTAssertEqual(loadingStates, [true, false])
                        expectation.fulfill()
                    }
                }
            }
            .store(in: &cancellables)
        
        inputSubject.send(.loginTapped)
        
        wait(for: [expectation], timeout: testTimeout)
    }
    
    func testResetValidation() {
        inputSubject.send(.emailChanged(invalidEmail))
        inputSubject.send(.passwordChanged(invalidPassword))
        
        // Verify validation errors exist
        XCTAssertTrue(outputEvents.contains(where: {
            if case .validationError = $0 { return true }
            return false
        }))
        
        // Reset validation
        inputSubject.send(.resetValidation)
        
        // Verify validation errors are cleared
        XCTAssertTrue(outputEvents.last.map {
            if case .validationError(nil) = $0 { return true }
            return false
        } ?? false)
    }
}