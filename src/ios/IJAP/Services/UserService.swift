//
// UserService.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+
import CryptoKit // iOS 13.0+

/// Service class responsible for managing user-related operations with enhanced security
/// and reactive programming support
@available(iOS 13.0, *)
public final class UserService {
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = UserService()
    
    /// API client for network requests
    private let apiClient: APIClient
    
    /// Core Data manager for local storage
    private let coreDataManager: CoreDataManager
    
    /// Current user publisher
    private let currentUserSubject: CurrentValueSubject<User?, Never>
    
    /// Background processing queue
    private let backgroundQueue: DispatchQueue
    
    /// User cache with size limits
    private var userCache: NSCache<NSString, User>
    
    /// Security provider for encryption
    private let securityProvider: SecurityProvider
    
    /// Set of cancellables for managing subscriptions
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Constants
    
    private enum Constants {
        static let cacheLimit = 50
        static let requestTimeout: TimeInterval = 30
        static let retryAttempts = 3
    }
    
    // MARK: - Initialization
    
    private init() {
        self.apiClient = APIClient.shared
        self.coreDataManager = CoreDataManager.shared
        self.currentUserSubject = CurrentValueSubject<User?, Never>(nil)
        self.backgroundQueue = DispatchQueue(label: "com.ijap.userservice", qos: .userInitiated)
        
        // Configure user cache
        self.userCache = NSCache<NSString, User>()
        self.userCache.countLimit = Constants.cacheLimit
        
        // Initialize security provider
        self.securityProvider = SecurityProvider()
        
        // Setup memory warning observer
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
        
        // Setup network monitoring
        setupNetworkMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Retrieves the current authenticated user
    /// - Returns: Publisher that emits current user or error
    public func getCurrentUser() -> AnyPublisher<User?, Error> {
        // Check cache first
        if let cachedUser = userCache.object(forKey: "currentUser" as NSString) {
            return Just(cachedUser)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
        
        return apiClient.request(.getUserProfile, type: User.self)
            .tryMap { [weak self] user in
                // Validate user data
                guard user.validate().isValid else {
                    throw UserServiceError.invalidUserData
                }
                
                // Cache user
                self?.userCache.setObject(user, forKey: "currentUser" as NSString)
                self?.currentUserSubject.send(user)
                
                return user
            }
            .mapError { error in
                UserServiceError.apiError(error)
            }
            .eraseToAnyPublisher()
    }
    
    /// Updates user profile information
    /// - Parameters:
    ///   - firstName: User's first name
    ///   - lastName: User's last name
    ///   - phoneNumber: Optional phone number
    ///   - profileImage: Optional profile image data
    /// - Returns: Publisher that emits updated user or error
    public func updateProfile(
        firstName: String,
        lastName: String,
        phoneNumber: String? = nil,
        profileImage: Data? = nil
    ) -> AnyPublisher<User, Error> {
        var profileData: [String: Any] = [
            "firstName": firstName,
            "lastName": lastName
        ]
        
        if let phone = phoneNumber {
            profileData["phoneNumber"] = phone
        }
        
        return apiClient.request(
            .updateUserProfile(profileData),
            type: User.self
        )
        .tryMap { [weak self] user in
            guard user.validate().isValid else {
                throw UserServiceError.invalidUserData
            }
            
            // Update cache and current user subject
            self?.userCache.setObject(user, forKey: "currentUser" as NSString)
            self?.currentUserSubject.send(user)
            
            return user
        }
        .mapError { error in
            UserServiceError.apiError(error)
        }
        .eraseToAnyPublisher()
    }
    
    /// Updates user language preference
    /// - Parameter language: Preferred language code
    /// - Returns: Publisher that emits updated user or error
    public func updateLanguagePreference(_ language: SupportedLanguage) -> AnyPublisher<User, Error> {
        return apiClient.request(
            .updateUserProfile(["preferredLanguage": language.rawValue]),
            type: User.self
        )
        .tryMap { [weak self] user in
            self?.userCache.setObject(user, forKey: "currentUser" as NSString)
            self?.currentUserSubject.send(user)
            return user
        }
        .mapError { error in
            UserServiceError.apiError(error)
        }
        .eraseToAnyPublisher()
    }
    
    /// Toggles two-factor authentication
    /// - Parameter enabled: Whether to enable or disable 2FA
    /// - Returns: Publisher that emits updated user or error
    public func toggleTwoFactorAuth(enabled: Bool) -> AnyPublisher<User, Error> {
        return apiClient.request(
            .updateUserProfile(["isTwoFactorEnabled": enabled]),
            type: User.self
        )
        .tryMap { [weak self] user in
            self?.userCache.setObject(user, forKey: "currentUser" as NSString)
            self?.currentUserSubject.send(user)
            return user
        }
        .mapError { error in
            UserServiceError.apiError(error)
        }
        .eraseToAnyPublisher()
    }
    
    /// Clears all user data from cache and local storage
    public func clearUserData() {
        userCache.removeAllObjects()
        currentUserSubject.send(nil)
        
        // Clear sensitive data from Core Data
        _ = coreDataManager.clearStorage()
        
        // Clear encryption keys
        securityProvider.clearKeys()
    }
    
    // MARK: - Private Methods
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] isConnected in
                if !isConnected {
                    self?.handleNetworkDisconnection()
                }
            }
            .store(in: &cancellables)
    }
    
    @objc private func handleMemoryWarning() {
        userCache.removeAllObjects()
    }
    
    private func handleNetworkDisconnection() {
        // Implement offline mode handling
    }
}

// MARK: - Supporting Types

/// Security provider for handling encryption and key management
private class SecurityProvider {
    private var encryptionKey: SymmetricKey?
    
    init() {
        generateEncryptionKey()
    }
    
    private func generateEncryptionKey() {
        encryptionKey = SymmetricKey(size: .bits256)
    }
    
    func clearKeys() {
        encryptionKey = nil
    }
}

/// Custom errors for UserService
private enum UserServiceError: LocalizedError {
    case invalidUserData
    case apiError(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidUserData:
            return NSLocalizedString(
                "error.invalid_user_data",
                tableName: "UserService",
                bundle: .main,
                comment: "Invalid user data error message"
            )
        case .apiError(let error):
            return error.localizedDescription
        }
    }
}