//
// MockAuthService.swift
// IJAPTests
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+
import XCTest // iOS 13.0+
@testable import IJAP

// MARK: - Mock Errors
enum MockError: Error {
    case authenticationFailed
    case registrationFailed
    case twoFactorFailed
    case tokenRefreshFailed
    case invalidRole
    case securityEventLoggingFailed
}

// MARK: - Authentication Event Types
enum AuthenticationEventType {
    case login
    case logout
    case tokenRefresh
    case twoFactorVerification
    case roleChange
}

// MARK: - Mock Auth Service
@available(iOS 13.0, *)
class MockAuthService {
    
    // MARK: - Singleton
    static let shared = MockAuthService()
    
    // MARK: - Publishers
    private(set) var currentUser = CurrentValueSubject<User?, Never>(nil)
    private(set) var isAuthenticated = CurrentValueSubject<Bool, Never>(false)
    private(set) var authenticationEvents = PassthroughSubject<AuthenticationEventType, Never>()
    
    // MARK: - Mock Control Properties
    var shouldSucceed: Bool = true
    var mockDelay: TimeInterval = 0.5
    var mockUser: User?
    var lastAuthenticationEvent: AuthenticationEventType?
    var securityEventLogger: ((AuthenticationEventType, User?) -> Bool)?
    
    // MARK: - Private Properties
    private var cancellables = Set<AnyCancellable>()
    private let queue = DispatchQueue(label: "com.ijap.mockauth", qos: .userInitiated)
    
    // MARK: - Initialization
    private init() {
        setupEventMonitoring()
    }
    
    // MARK: - Authentication Methods
    func login(email: String, password: String) -> AnyPublisher<User, Error> {
        return Future<User, Error> { [weak self] promise in
            guard let self = self else {
                promise(.failure(MockError.authenticationFailed))
                return
            }
            
            self.queue.asyncAfter(deadline: .now() + self.mockDelay) {
                if self.shouldSucceed, let mockUser = self.createMockUser(email: email) {
                    self.currentUser.send(mockUser)
                    self.isAuthenticated.send(true)
                    self.logSecurityEvent(.login, user: mockUser)
                    promise(.success(mockUser))
                } else {
                    promise(.failure(MockError.authenticationFailed))
                }
            }
        }.eraseToAnyPublisher()
    }
    
    func logout() -> AnyPublisher<Void, Error> {
        return Future<Void, Error> { [weak self] promise in
            guard let self = self else {
                promise(.failure(MockError.authenticationFailed))
                return
            }
            
            self.queue.asyncAfter(deadline: .now() + self.mockDelay) {
                if self.shouldSucceed {
                    let previousUser = self.currentUser.value
                    self.currentUser.send(nil)
                    self.isAuthenticated.send(false)
                    self.logSecurityEvent(.logout, user: previousUser)
                    promise(.success(()))
                } else {
                    promise(.failure(MockError.authenticationFailed))
                }
            }
        }.eraseToAnyPublisher()
    }
    
    func verifyTwoFactor(code: String) -> AnyPublisher<Bool, Error> {
        return Future<Bool, Error> { [weak self] promise in
            guard let self = self else {
                promise(.failure(MockError.twoFactorFailed))
                return
            }
            
            self.queue.asyncAfter(deadline: .now() + self.mockDelay) {
                if self.shouldSucceed && code.count == 6 {
                    self.logSecurityEvent(.twoFactorVerification, user: self.currentUser.value)
                    promise(.success(true))
                } else {
                    promise(.failure(MockError.twoFactorFailed))
                }
            }
        }.eraseToAnyPublisher()
    }
    
    func refreshToken() -> AnyPublisher<Void, Error> {
        return Future<Void, Error> { [weak self] promise in
            guard let self = self else {
                promise(.failure(MockError.tokenRefreshFailed))
                return
            }
            
            self.queue.asyncAfter(deadline: .now() + self.mockDelay) {
                if self.shouldSucceed {
                    self.logSecurityEvent(.tokenRefresh, user: self.currentUser.value)
                    promise(.success(()))
                } else {
                    promise(.failure(MockError.tokenRefreshFailed))
                }
            }
        }.eraseToAnyPublisher()
    }
    
    // MARK: - Helper Methods
    private func createMockUser(email: String) -> User? {
        if let existingMockUser = mockUser {
            return existingMockUser
        }
        
        do {
            return try User(
                id: UUID().uuidString,
                email: email,
                firstName: "Mock",
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
        } catch {
            return nil
        }
    }
    
    private func setupEventMonitoring() {
        authenticationEvents
            .sink { [weak self] event in
                self?.lastAuthenticationEvent = event
            }
            .store(in: &cancellables)
    }
    
    private func logSecurityEvent(_ event: AuthenticationEventType, user: User?) {
        if let logger = securityEventLogger {
            if !logger(event, user) {
                print("Warning: Security event logging failed for event: \(event)")
            }
        }
        authenticationEvents.send(event)
    }
    
    // MARK: - Test Helper Methods
    func reset() {
        shouldSucceed = true
        mockUser = nil
        currentUser.send(nil)
        isAuthenticated.send(false)
        lastAuthenticationEvent = nil
        cancellables.removeAll()
        setupEventMonitoring()
    }
    
    func simulateTokenExpiration() {
        logSecurityEvent(.tokenRefresh, user: currentUser.value)
        isAuthenticated.send(false)
    }
    
    func simulateRoleChange(to newRole: UserRole) {
        guard var updatedUser = currentUser.value else { return }
        updatedUser.role = newRole
        currentUser.send(updatedUser)
        logSecurityEvent(.roleChange, user: updatedUser)
    }
}