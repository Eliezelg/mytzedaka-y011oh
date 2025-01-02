//
// RegisterViewModelTests.swift
// IJAPTests
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import XCTest
import Combine
import LocalAuthentication
@testable import IJAP

@available(iOS 13.0, *)
final class RegisterViewModelTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: RegisterViewModel!
    private var mockAuthService: MockAuthService!
    private var cancellables: Set<AnyCancellable>!
    private let defaultTimeout: TimeInterval = 2.0
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        mockAuthService = MockAuthService.shared
        mockAuthService.reset()
        sut = RegisterViewModel()
        cancellables = Set<AnyCancellable>()
    }
    
    override func tearDown() {
        cancellables.removeAll()
        sut = nil
        mockAuthService = nil
        super.tearDown()
    }
    
    // MARK: - Email Validation Tests
    
    func testEmailValidation() {
        // Given
        let expectation = XCTestExpectation(description: "Email validation")
        var validationStates: [RegisterViewModel.ValidationState] = []
        
        // When
        let input = RegisterViewModel.Input(
            email: Just("invalid@email").eraseToAnyPublisher(),
            password: Just("").eraseToAnyPublisher(),
            confirmPassword: Just("").eraseToAnyPublisher(),
            firstName: Just("").eraseToAnyPublisher(),
            lastName: Just("").eraseToAnyPublisher(),
            phoneNumber: Just(nil).eraseToAnyPublisher(),
            submit: Empty().eraseToAnyPublisher(),
            language: Just(.english).eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.validationState
            .sink { state in
                validationStates.append(state)
                if validationStates.count == 2 { // Idle + Invalid
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: defaultTimeout)
        XCTAssertEqual(validationStates.count, 2)
        
        if case .invalid(let errors) = validationStates.last {
            XCTAssertNotNil(errors["email"])
        } else {
            XCTFail("Expected invalid email validation state")
        }
    }
    
    // MARK: - Password Validation Tests
    
    func testPasswordComplexityValidation() {
        // Given
        let expectation = XCTestExpectation(description: "Password complexity validation")
        var validationStates: [RegisterViewModel.ValidationState] = []
        
        // When
        let input = RegisterViewModel.Input(
            email: Just("valid@email.com").eraseToAnyPublisher(),
            password: Just("weak").eraseToAnyPublisher(),
            confirmPassword: Just("weak").eraseToAnyPublisher(),
            firstName: Just("John").eraseToAnyPublisher(),
            lastName: Just("Doe").eraseToAnyPublisher(),
            phoneNumber: Just(nil).eraseToAnyPublisher(),
            submit: Empty().eraseToAnyPublisher(),
            language: Just(.english).eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.validationState
            .sink { state in
                validationStates.append(state)
                if validationStates.count == 2 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: defaultTimeout)
        
        if case .invalid(let errors) = validationStates.last {
            XCTAssertNotNil(errors["password"])
            XCTAssertTrue(errors["password"]?.contains("length") ?? false)
        } else {
            XCTFail("Expected invalid password validation state")
        }
    }
    
    // MARK: - Multi-Language Support Tests
    
    func testHebrewInputValidation() {
        // Given
        let expectation = XCTestExpectation(description: "Hebrew input validation")
        var validationStates: [RegisterViewModel.ValidationState] = []
        
        // When
        let input = RegisterViewModel.Input(
            email: Just("test@test.com").eraseToAnyPublisher(),
            password: Just("StrongP@ss123").eraseToAnyPublisher(),
            confirmPassword: Just("StrongP@ss123").eraseToAnyPublisher(),
            firstName: Just("ישראל").eraseToAnyPublisher(),
            lastName: Just("כהן").eraseToAnyPublisher(),
            phoneNumber: Just("+972501234567").eraseToAnyPublisher(),
            submit: Empty().eraseToAnyPublisher(),
            language: Just(.hebrew).eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.validationState
            .sink { state in
                validationStates.append(state)
                if case .valid = state {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: defaultTimeout)
        XCTAssertEqual(validationStates.last, .valid)
    }
    
    // MARK: - Form Submission Tests
    
    func testSuccessfulRegistration() {
        // Given
        let expectation = XCTestExpectation(description: "Successful registration")
        mockAuthService.shouldSucceed = true
        var registrationComplete = false
        
        // When
        let input = RegisterViewModel.Input(
            email: Just("new@user.com").eraseToAnyPublisher(),
            password: Just("SecureP@ss123").eraseToAnyPublisher(),
            confirmPassword: Just("SecureP@ss123").eraseToAnyPublisher(),
            firstName: Just("John").eraseToAnyPublisher(),
            lastName: Just("Doe").eraseToAnyPublisher(),
            phoneNumber: Just("+1234567890").eraseToAnyPublisher(),
            submit: Just(()).eraseToAnyPublisher(),
            language: Just(.english).eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.registrationComplete
            .sink { _ in
                registrationComplete = true
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: defaultTimeout)
        XCTAssertTrue(registrationComplete)
    }
    
    // MARK: - Security Tests
    
    func testRateLimiting() {
        // Given
        let expectation = XCTestExpectation(description: "Rate limiting")
        var errorMessages: [String?] = []
        
        // When
        let input = RegisterViewModel.Input(
            email: Just("test@test.com").eraseToAnyPublisher(),
            password: Just("ValidP@ss123").eraseToAnyPublisher(),
            confirmPassword: Just("ValidP@ss123").eraseToAnyPublisher(),
            firstName: Just("Test").eraseToAnyPublisher(),
            lastName: Just("User").eraseToAnyPublisher(),
            phoneNumber: Just(nil).eraseToAnyPublisher(),
            submit: Publishers.Sequence(sequence: Array(repeating: (), count: 4))
                .eraseToAnyPublisher(),
            language: Just(.english).eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.error
            .sink { error in
                errorMessages.append(error)
                if errorMessages.count == 4 {
                    expectation.fulfill()
                }
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: defaultTimeout)
        XCTAssertTrue(errorMessages.contains { $0?.contains("too many attempts") ?? false })
    }
    
    // MARK: - Error Handling Tests
    
    func testRegistrationFailure() {
        // Given
        let expectation = XCTestExpectation(description: "Registration failure")
        mockAuthService.shouldSucceed = false
        var receivedError: String?
        
        // When
        let input = RegisterViewModel.Input(
            email: Just("test@test.com").eraseToAnyPublisher(),
            password: Just("ValidP@ss123").eraseToAnyPublisher(),
            confirmPassword: Just("ValidP@ss123").eraseToAnyPublisher(),
            firstName: Just("Test").eraseToAnyPublisher(),
            lastName: Just("User").eraseToAnyPublisher(),
            phoneNumber: Just(nil).eraseToAnyPublisher(),
            submit: Just(()).eraseToAnyPublisher(),
            language: Just(.english).eraseToAnyPublisher()
        )
        
        let output = sut.transform(input: input)
        
        output.error
            .sink { error in
                receivedError = error
                expectation.fulfill()
            }
            .store(in: &cancellables)
        
        // Then
        wait(for: [expectation], timeout: defaultTimeout)
        XCTAssertNotNil(receivedError)
    }
}