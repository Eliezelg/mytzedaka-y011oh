//
// MockUserService.swift
// IJAPTests
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+
import IJAP

/// Thread-safe mock implementation of UserService for testing purposes
@available(iOS 13.0, *)
public final class MockUserService {
    
    // MARK: - Properties
    
    /// Current mock user publisher
    public let mockUser = CurrentValueSubject<User?, Never>(nil)
    
    /// Operation tracking flags
    public private(set) var updateProfileCalled = false
    public private(set) var updateLanguageCalled = false
    public private(set) var toggleTwoFactorCalled = false
    public private(set) var shouldSimulateError = false
    
    /// Thread-safe operation queue
    private let queue = DispatchQueue(label: "com.ijap.mockuserservice", qos: .userInitiated)
    
    /// Error simulation type
    public var errorSimulationType: MockErrorType = .none
    
    /// Call count tracking
    public private(set) var callCount: [String: Int] = [:]
    
    /// Last update timestamp
    public private(set) var lastUpdatedTimestamp: Date?
    
    // MARK: - Error Types
    
    public enum MockErrorType {
        case none
        case network
        case validation
        case unauthorized
        case unknown
        
        var error: Error {
            switch self {
            case .none:
                return NSError(domain: "", code: 0)
            case .network:
                return APIError.networkError(NSError(domain: "MockNetwork", code: -1009))
            case .validation:
                return APIError.validationError(["profile": ["Invalid data"]])
            case .unauthorized:
                return APIError.unauthorized
            case .unknown:
                return APIError.unknown
            }
        }
    }
    
    // MARK: - Initialization
    
    public init() {}
    
    // MARK: - Mock Configuration
    
    /// Sets the mock user with thread safety
    public func setMockUser(_ user: User) {
        queue.async { [weak self] in
            self?.mockUser.send(user)
            self?.lastUpdatedTimestamp = Date()
            self?.incrementCallCount(for: #function)
        }
    }
    
    // MARK: - UserService Protocol Implementation
    
    public func getCurrentUser() -> AnyPublisher<User?, Error> {
        return queue.sync { [weak self] in
            guard let self = self else {
                return Fail(error: APIError.unknown).eraseToAnyPublisher()
            }
            
            self.incrementCallCount(for: #function)
            
            if shouldSimulateError {
                return Fail(error: errorSimulationType.error).eraseToAnyPublisher()
            }
            
            return Just(mockUser.value)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
    }
    
    public func updateProfile(firstName: String, lastName: String, phoneNumber: String? = nil) -> AnyPublisher<User, Error> {
        return queue.sync { [weak self] in
            guard let self = self else {
                return Fail(error: APIError.unknown).eraseToAnyPublisher()
            }
            
            self.updateProfileCalled = true
            self.incrementCallCount(for: #function)
            
            if shouldSimulateError {
                return Fail(error: errorSimulationType.error).eraseToAnyPublisher()
            }
            
            guard var user = mockUser.value else {
                return Fail(error: APIError.unauthorized).eraseToAnyPublisher()
            }
            
            // Update mock user
            user.firstName = firstName
            user.lastName = lastName
            user.phoneNumber = phoneNumber
            user.updatedAt = Date()
            
            mockUser.send(user)
            lastUpdatedTimestamp = Date()
            
            return Just(user)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
    }
    
    public func updateLanguagePreference(_ language: SupportedLanguage) -> AnyPublisher<User, Error> {
        return queue.sync { [weak self] in
            guard let self = self else {
                return Fail(error: APIError.unknown).eraseToAnyPublisher()
            }
            
            self.updateLanguageCalled = true
            self.incrementCallCount(for: #function)
            
            if shouldSimulateError {
                return Fail(error: errorSimulationType.error).eraseToAnyPublisher()
            }
            
            guard var user = mockUser.value else {
                return Fail(error: APIError.unauthorized).eraseToAnyPublisher()
            }
            
            // Update mock user
            user.preferredLanguage = language
            user.updatedAt = Date()
            
            mockUser.send(user)
            lastUpdatedTimestamp = Date()
            
            return Just(user)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
    }
    
    public func toggleTwoFactorAuth(enabled: Bool) -> AnyPublisher<User, Error> {
        return queue.sync { [weak self] in
            guard let self = self else {
                return Fail(error: APIError.unknown).eraseToAnyPublisher()
            }
            
            self.toggleTwoFactorCalled = true
            self.incrementCallCount(for: #function)
            
            if shouldSimulateError {
                return Fail(error: errorSimulationType.error).eraseToAnyPublisher()
            }
            
            guard var user = mockUser.value else {
                return Fail(error: APIError.unauthorized).eraseToAnyPublisher()
            }
            
            // Update mock user
            user.isTwoFactorEnabled = enabled
            user.updatedAt = Date()
            
            mockUser.send(user)
            lastUpdatedTimestamp = Date()
            
            return Just(user)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
    }
    
    // MARK: - Test Helper Methods
    
    /// Clears all mock data and resets tracking
    public func clearUserData() {
        queue.sync { [weak self] in
            self?.mockUser.send(nil)
            self?.updateProfileCalled = false
            self?.updateLanguageCalled = false
            self?.toggleTwoFactorCalled = false
            self?.shouldSimulateError = false
            self?.errorSimulationType = .none
            self?.callCount.removeAll()
            self?.lastUpdatedTimestamp = nil
        }
    }
    
    // MARK: - Private Methods
    
    private func incrementCallCount(for function: String) {
        callCount[function, default: 0] += 1
    }
}