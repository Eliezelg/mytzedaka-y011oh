//
// AuthService.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+
import LocalAuthentication // iOS 13.0+

/// Service responsible for handling authentication operations with enhanced security features
@available(iOS 13.0, *)
public final class AuthService {
    
    // MARK: - Singleton Instance
    
    /// Shared singleton instance of AuthService
    public static let shared = AuthService()
    
    // MARK: - Private Constants
    
    private enum TokenKeys {
        static let accessToken = "access_token"
        static let refreshToken = "refresh_token"
        static let tokenExpiry = "token_expiry"
    }
    
    // MARK: - Public Properties
    
    /// Current user publisher
    public let currentUser = CurrentValueSubject<User?, Never>(nil)
    
    /// Authentication state publisher
    public let isAuthenticated = CurrentValueSubject<Bool, Never>(false)
    
    /// Token refresh timestamp publisher
    public let tokenRefreshPublisher = CurrentValueSubject<Date?, Never>(nil)
    
    // MARK: - Private Properties
    
    private let sessionTimeout: TimeInterval
    private var refreshTimer: Timer?
    private var cancellables = Set<AnyCancellable>()
    private let authContext = LAContext()
    
    // MARK: - Initialization
    
    private init() {
        self.sessionTimeout = SecurityConfig.sessionTimeout
        setupTokenRefreshMonitoring()
        configureAuthContext()
    }
    
    // MARK: - Public Methods
    
    /// Authenticates user with email and password
    /// - Parameters:
    ///   - email: User's email address
    ///   - password: User's password
    /// - Returns: Publisher emitting authenticated user or error
    public func login(email: String, password: String) -> AnyPublisher<User, AuthError> {
        return Future<User, AuthError> { [weak self] promise in
            guard let self = self else {
                promise(.failure(.unknown))
                return
            }
            
            // Create login request
            let loginRequest = APIRouter.login(email: email, password: password)
            
            // Perform login request with retry capability
            APIClient.shared.request(loginRequest, type: LoginResponse.self)
                .tryMap { response -> User in
                    // Store tokens securely
                    try self.storeTokens(
                        accessToken: response.accessToken,
                        refreshToken: response.refreshToken,
                        expiresIn: response.expiresIn
                    )
                    return response.user
                }
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            promise(.failure(self.mapAPIError(error)))
                        }
                    },
                    receiveValue: { user in
                        self.currentUser.send(user)
                        self.isAuthenticated.send(true)
                        self.setupTokenRefreshTimer()
                        promise(.success(user))
                    }
                )
                .store(in: &self.cancellables)
        }
        .eraseToAnyPublisher()
    }
    
    /// Refreshes authentication tokens
    /// - Returns: Publisher indicating success or error
    public func refreshTokens() -> AnyPublisher<Void, AuthError> {
        return Future<Void, AuthError> { [weak self] promise in
            guard let self = self else {
                promise(.failure(.unknown))
                return
            }
            
            // Verify biometric authentication if enabled
            guard let refreshToken = try? self.getRefreshToken() else {
                promise(.failure(.tokenExpired))
                return
            }
            
            let refreshRequest = APIRouter.refreshToken(token: refreshToken)
            
            APIClient.shared.request(refreshRequest, type: TokenResponse.self)
                .tryMap { response -> Void in
                    try self.storeTokens(
                        accessToken: response.accessToken,
                        refreshToken: response.refreshToken,
                        expiresIn: response.expiresIn
                    )
                    self.tokenRefreshPublisher.send(Date())
                }
                .sink(
                    receiveCompletion: { completion in
                        if case .failure(let error) = completion {
                            promise(.failure(self.mapAPIError(error)))
                        }
                    },
                    receiveValue: { _ in
                        promise(.success(()))
                    }
                )
                .store(in: &self.cancellables)
        }
        .eraseToAnyPublisher()
    }
    
    /// Logs out the current user
    public func logout() {
        // Clear stored tokens
        try? KeychainManager.shared.removeSecureItem(forKey: TokenKeys.accessToken)
        try? KeychainManager.shared.removeSecureItem(forKey: TokenKeys.refreshToken)
        try? KeychainManager.shared.removeSecureItem(forKey: TokenKeys.tokenExpiry)
        
        // Reset state
        currentUser.send(nil)
        isAuthenticated.send(false)
        tokenRefreshPublisher.send(nil)
        refreshTimer?.invalidate()
        refreshTimer = nil
    }
    
    // MARK: - Private Methods
    
    private func setupTokenRefreshMonitoring() {
        // Monitor network connectivity for token refresh
        NetworkMonitor.shared.isConnected
            .filter { $0 }
            .sink { [weak self] _ in
                self?.checkAndRefreshTokensIfNeeded()
            }
            .store(in: &cancellables)
    }
    
    private func configureAuthContext() {
        authContext.localizedCancelTitle = NSLocalizedString(
            "auth.biometric.cancel",
            comment: "Cancel biometric authentication"
        )
        authContext.localizedFallbackTitle = NSLocalizedString(
            "auth.biometric.fallback",
            comment: "Use passcode instead"
        )
    }
    
    private func storeTokens(accessToken: String, refreshToken: String, expiresIn: TimeInterval) throws {
        let expiryDate = Date().addingTimeInterval(expiresIn)
        
        // Store tokens with biometric protection
        try KeychainManager.shared.saveSecureItem(
            accessToken.data(using: .utf8)!,
            forKey: TokenKeys.accessToken,
            requiresBiometric: true
        ).get()
        
        try KeychainManager.shared.saveSecureItem(
            refreshToken.data(using: .utf8)!,
            forKey: TokenKeys.refreshToken,
            requiresBiometric: true
        ).get()
        
        try KeychainManager.shared.saveSecureItem(
            expiryDate.timeIntervalSince1970.description.data(using: .utf8)!,
            forKey: TokenKeys.tokenExpiry,
            requiresBiometric: false
        ).get()
    }
    
    private func getRefreshToken() throws -> String? {
        let result = KeychainManager.shared.loadSecureItem(forKey: TokenKeys.refreshToken)
        switch result {
        case .success(let data):
            guard let data = data else { return nil }
            return String(data: data, encoding: .utf8)
        case .failure:
            throw AuthError.tokenExpired
        }
    }
    
    private func setupTokenRefreshTimer() {
        refreshTimer?.invalidate()
        refreshTimer = Timer.scheduledTimer(
            withTimeInterval: sessionTimeout * 0.8,
            repeats: true
        ) { [weak self] _ in
            self?.checkAndRefreshTokensIfNeeded()
        }
    }
    
    private func checkAndRefreshTokensIfNeeded() {
        guard isAuthenticated.value else { return }
        
        refreshTokens()
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure = completion {
                        self?.logout()
                    }
                },
                receiveValue: { _ in }
            )
            .store(in: &cancellables)
    }
    
    private func mapAPIError(_ error: APIError) -> AuthError {
        switch error {
        case .unauthorized:
            return .invalidCredentials
        case .networkError:
            return .networkError
        case .serverError:
            return .serverError
        default:
            return .unknown
    }
}

// MARK: - Error Types

/// Authentication specific errors
public enum AuthError: LocalizedError {
    case invalidCredentials
    case networkError
    case tokenExpired
    case biometricFailed
    case serverError
    case unknown
    
    public var errorDescription: String? {
        switch self {
        case .invalidCredentials:
            return NSLocalizedString("auth.error.invalid_credentials", comment: "")
        case .networkError:
            return NSLocalizedString("auth.error.network", comment: "")
        case .tokenExpired:
            return NSLocalizedString("auth.error.token_expired", comment: "")
        case .biometricFailed:
            return NSLocalizedString("auth.error.biometric_failed", comment: "")
        case .serverError:
            return NSLocalizedString("auth.error.server", comment: "")
        case .unknown:
            return NSLocalizedString("auth.error.unknown", comment: "")
        }
    }
}

// MARK: - Response Types

private struct LoginResponse: Decodable {
    let user: User
    let accessToken: String
    let refreshToken: String
    let expiresIn: TimeInterval
}

private struct TokenResponse: Decodable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: TimeInterval
}