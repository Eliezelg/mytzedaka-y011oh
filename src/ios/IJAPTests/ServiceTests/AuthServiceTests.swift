//
// AuthServiceTests.swift
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
final class AuthServiceTests: XCTestCase {
    
    // MARK: - Properties
    
    private var sut: AuthService!
    private var mockAPIClient: MockAPIClient!
    private var cancellables: Set<AnyCancellable>!
    private var testUser: User!
    private var mockAuthContext: LAContext!
    
    // MARK: - Test Lifecycle
    
    override func setUp() {
        super.setUp()
        mockAPIClient = MockAPIClient.shared
        sut = AuthService.shared
        cancellables = Set<AnyCancellable>()
        mockAuthContext = LAContext()
        
        // Initialize test user
        testUser = try! User(
            id: "test-user-id",
            email: "test@ijap.org",
            firstName: "Test",
            lastName: "User",
            phoneNumber: "+1234567890",
            role: .donor,
            preferredLanguage: .english,
            isVerified: true,
            isTwoFactorEnabled: true,
            lastLoginAt: Date(),
            createdAt: Date(),
            updatedAt: Date()
        )
        
        // Reset mock API client
        mockAPIClient.reset()
    }
    
    override func tearDown() {
        // Cancel all subscriptions
        cancellables.forEach { $0.cancel() }
        cancellables.removeAll()
        
        // Reset state
        mockAPIClient.reset()
        sut.logout()
        
        // Clear test data
        testUser = nil
        mockAuthContext = nil
        
        super.tearDown()
    }
    
    // MARK: - Login Tests
    
    func testSuccessfulLogin() {
        // Given
        let expectation = XCTestExpectation(description: "Login success")
        let mockResponse = LoginResponse(
            user: testUser,
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
            expiresIn: 3600
        )
        mockAPIClient.setMockResponse(.success(mockResponse), for: .login(email: testUser.email, password: "password"))
        
        // When
        sut.login(email: testUser.email, password: "password")
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        XCTFail("Login failed with error: \(error)")
                    }
                },
                receiveValue: { user in
                    // Then
                    XCTAssertEqual(user.id, self.testUser.id)
                    XCTAssertTrue(self.sut.isAuthenticated.value)
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: TestConstants.timeout)
    }
    
    func testLoginWithInvalidCredentials() {
        // Given
        let expectation = XCTestExpectation(description: "Login failure")
        mockAPIClient.setMockResponse(.failure(.unauthorized), for: .login(email: testUser.email, password: "wrong"))
        
        // When
        sut.login(email: testUser.email, password: "wrong")
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        // Then
                        XCTAssertEqual(error, .invalidCredentials)
                        XCTAssertFalse(self.sut.isAuthenticated.value)
                        expectation.fulfill()
                    }
                },
                receiveValue: { _ in
                    XCTFail("Login should not succeed")
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: TestConstants.timeout)
    }
    
    // MARK: - Token Refresh Tests
    
    func testTokenRefresh() {
        // Given
        let expectation = XCTestExpectation(description: "Token refresh")
        let mockResponse = TokenResponse(
            accessToken: "new-access-token",
            refreshToken: "new-refresh-token",
            expiresIn: 3600
        )
        mockAPIClient.setMockResponse(.success(mockResponse), for: .refreshToken(token: "mock-refresh-token"))
        
        // When
        sut.refreshTokens()
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        XCTFail("Token refresh failed with error: \(error)")
                    }
                },
                receiveValue: {
                    // Then
                    XCTAssertNotNil(self.sut.tokenRefreshPublisher.value)
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: TestConstants.timeout)
    }
    
    // MARK: - Biometric Authentication Tests
    
    func testBiometricAuthentication() {
        // Given
        let expectation = XCTestExpectation(description: "Biometric authentication")
        mockAuthContext.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        
        // When
        sut.authenticateWithBiometrics()
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        XCTFail("Biometric authentication failed with error: \(error)")
                    }
                },
                receiveValue: { success in
                    // Then
                    XCTAssertTrue(success)
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: TestConstants.timeout)
    }
    
    // MARK: - Logout Tests
    
    func testLogout() {
        // Given
        let loginExpectation = XCTestExpectation(description: "Login before logout")
        let mockResponse = LoginResponse(
            user: testUser,
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
            expiresIn: 3600
        )
        mockAPIClient.setMockResponse(.success(mockResponse), for: .login(email: testUser.email, password: "password"))
        
        // Login first
        sut.login(email: testUser.email, password: "password")
            .sink(
                receiveCompletion: { _ in },
                receiveValue: { _ in
                    loginExpectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [loginExpectation], timeout: TestConstants.timeout)
        
        // When
        sut.logout()
        
        // Then
        XCTAssertFalse(sut.isAuthenticated.value)
        XCTAssertNil(sut.currentUser.value)
        XCTAssertNil(sut.tokenRefreshPublisher.value)
    }
    
    // MARK: - Localization Tests
    
    func testLocalizationSupport() {
        // Given
        let expectation = XCTestExpectation(description: "Localized login")
        testUser.preferredLanguage = .hebrew
        let mockResponse = LoginResponse(
            user: testUser,
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
            expiresIn: 3600
        )
        mockAPIClient.setMockResponse(.success(mockResponse), for: .login(email: testUser.email, password: "password"))
        
        // When
        sut.login(email: testUser.email, password: "password")
            .sink(
                receiveCompletion: { completion in
                    if case .failure(let error) = completion {
                        XCTFail("Login failed with error: \(error)")
                    }
                },
                receiveValue: { user in
                    // Then
                    XCTAssertEqual(user.preferredLanguage, .hebrew)
                    expectation.fulfill()
                }
            )
            .store(in: &cancellables)
        
        wait(for: [expectation], timeout: TestConstants.timeout)
    }
}

// MARK: - Test Constants

private enum TestConstants {
    static let timeout: TimeInterval = 5.0
}

// MARK: - Test Error Types

private enum TestError: Error {
    case mockError
    case biometricError
    case networkError
    case validationError
}