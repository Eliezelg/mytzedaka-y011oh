//
// TwoFactorViewModel.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+

/// Comprehensive error handling for two-factor authentication
public enum TwoFactorError: LocalizedError {
    case invalidCode
    case maxAttemptsExceeded
    case rateLimited(TimeInterval)
    case networkError
    case serverError
    case verificationFailed
    case sessionExpired
    
    public var errorDescription: String? {
        switch self {
        case .invalidCode:
            return NSLocalizedString("auth.2fa.error.invalid_code", comment: "Invalid verification code")
        case .maxAttemptsExceeded:
            return NSLocalizedString("auth.2fa.error.max_attempts", comment: "Maximum attempts exceeded")
        case .rateLimited(let interval):
            return String(format: NSLocalizedString("auth.2fa.error.rate_limited", comment: "Rate limited"), Int(ceil(interval)))
        case .networkError:
            return NSLocalizedString("auth.2fa.error.network", comment: "Network error")
        case .serverError:
            return NSLocalizedString("auth.2fa.error.server", comment: "Server error")
        case .verificationFailed:
            return NSLocalizedString("auth.2fa.error.verification", comment: "Verification failed")
        case .sessionExpired:
            return NSLocalizedString("auth.2fa.error.session_expired", comment: "Session expired")
        }
    }
    
    public var recoverySuggestion: String? {
        switch self {
        case .invalidCode:
            return NSLocalizedString("auth.2fa.recovery.invalid_code", comment: "Check and try again")
        case .maxAttemptsExceeded:
            return NSLocalizedString("auth.2fa.recovery.max_attempts", comment: "Contact support")
        case .rateLimited:
            return NSLocalizedString("auth.2fa.recovery.rate_limited", comment: "Wait and try again")
        case .networkError:
            return NSLocalizedString("auth.2fa.recovery.network", comment: "Check connection")
        case .serverError:
            return NSLocalizedString("auth.2fa.recovery.server", comment: "Try again later")
        case .verificationFailed:
            return NSLocalizedString("auth.2fa.recovery.verification", comment: "Request new code")
        case .sessionExpired:
            return NSLocalizedString("auth.2fa.recovery.session_expired", comment: "Login again")
        }
    }
}

/// ViewModel for handling two-factor authentication with enhanced security features
@available(iOS 13.0, *)
public final class TwoFactorViewModel: ViewModelType {
    
    // MARK: - Type Definitions
    
    public enum Input {
        case submitCode(String)
        case requestNewCode
        case submitRecoveryCode(String)
        case resetAttempts
    }
    
    public enum Output {
        case isLoading(Bool)
        case verificationSuccess
        case error(TwoFactorError)
        case attemptsRemaining(Int)
        case isRateLimited(Bool)
        case timeoutDuration(TimeInterval)
    }
    
    // MARK: - Private Properties
    
    private let authService: AuthService
    private var cancellables = Set<AnyCancellable>()
    private var verificationAttempts: Int = 0
    private let maxAttempts = 5
    private var lastAttemptTime: Date?
    private var isRateLimited: Bool = false
    private let rateLimitDuration: TimeInterval = 300 // 5 minutes
    private let codeLength = 6
    private let recoveryCodeLength = 10
    
    // MARK: - Initialization
    
    public init() {
        self.authService = AuthService.shared
        setupSecurityMonitoring()
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(input: Input) -> AnyPublisher<Output, Never> {
        let outputSubject = PassthroughSubject<Output, Never>()
        
        switch input {
        case .submitCode(let code):
            handleCodeSubmission(code, outputSubject: outputSubject)
            
        case .requestNewCode:
            handleNewCodeRequest(outputSubject: outputSubject)
            
        case .submitRecoveryCode(let code):
            handleRecoveryCodeSubmission(code, outputSubject: outputSubject)
            
        case .resetAttempts:
            resetVerificationAttempts()
            outputSubject.send(.attemptsRemaining(maxAttempts))
        }
        
        return outputSubject.eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func handleCodeSubmission(_ code: String, outputSubject: PassthroughSubject<Output, Never>) {
        // Validate rate limiting
        if let timeRemaining = checkRateLimit() {
            outputSubject.send(.error(.rateLimited(timeRemaining)))
            outputSubject.send(.timeoutDuration(timeRemaining))
            return
        }
        
        // Validate code format
        guard code.count == codeLength, code.rangeOfCharacter(from: CharacterSet.decimalDigits.inverted) == nil else {
            outputSubject.send(.error(.invalidCode))
            return
        }
        
        // Check attempts
        guard verificationAttempts < maxAttempts else {
            outputSubject.send(.error(.maxAttemptsExceeded))
            return
        }
        
        outputSubject.send(.isLoading(true))
        
        // Verify code
        authService.verifyTwoFactor(code: code)
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                guard let self = self else { return }
                
                outputSubject.send(.isLoading(false))
                
                switch completion {
                case .failure(let error):
                    self.verificationAttempts += 1
                    self.lastAttemptTime = Date()
                    
                    if self.verificationAttempts >= self.maxAttempts {
                        self.isRateLimited = true
                        outputSubject.send(.error(.maxAttemptsExceeded))
                    } else {
                        outputSubject.send(.error(self.mapAuthError(error)))
                    }
                    
                    outputSubject.send(.attemptsRemaining(self.maxAttempts - self.verificationAttempts))
                    
                case .finished:
                    break
                }
            } receiveValue: { _ in
                outputSubject.send(.verificationSuccess)
            }
            .store(in: &cancellables)
    }
    
    private func handleNewCodeRequest(outputSubject: PassthroughSubject<Output, Never>) {
        // Validate rate limiting
        if let timeRemaining = checkRateLimit() {
            outputSubject.send(.error(.rateLimited(timeRemaining)))
            outputSubject.send(.timeoutDuration(timeRemaining))
            return
        }
        
        outputSubject.send(.isLoading(true))
        
        authService.requestNewCode()
            .receive(on: DispatchQueue.main)
            .sink { completion in
                outputSubject.send(.isLoading(false))
                
                if case .failure(let error) = completion {
                    outputSubject.send(.error(self.mapAuthError(error)))
                }
            } receiveValue: { _ in
                self.resetVerificationAttempts()
                outputSubject.send(.attemptsRemaining(self.maxAttempts))
            }
            .store(in: &cancellables)
    }
    
    private func handleRecoveryCodeSubmission(_ code: String, outputSubject: PassthroughSubject<Output, Never>) {
        // Validate recovery code format
        guard code.count == recoveryCodeLength,
              code.rangeOfCharacter(from: CharacterSet.alphanumerics.inverted) == nil else {
            outputSubject.send(.error(.invalidCode))
            return
        }
        
        outputSubject.send(.isLoading(true))
        
        // Hash recovery code before transmission
        let hashedCode = SecurityUtils.hashString(code)
        
        authService.verifyTwoFactor(code: hashedCode)
            .receive(on: DispatchQueue.main)
            .sink { completion in
                outputSubject.send(.isLoading(false))
                
                if case .failure(let error) = completion {
                    outputSubject.send(.error(self.mapAuthError(error)))
                }
            } receiveValue: { _ in
                outputSubject.send(.verificationSuccess)
            }
            .store(in: &cancellables)
    }
    
    private func checkRateLimit() -> TimeInterval? {
        guard isRateLimited else { return nil }
        
        if let lastAttempt = lastAttemptTime {
            let timeSinceLastAttempt = Date().timeIntervalSince(lastAttempt)
            if timeSinceLastAttempt < rateLimitDuration {
                return rateLimitDuration - timeSinceLastAttempt
            } else {
                isRateLimited = false
                resetVerificationAttempts()
                return nil
            }
        }
        return nil
    }
    
    private func resetVerificationAttempts() {
        verificationAttempts = 0
        isRateLimited = false
        lastAttemptTime = nil
    }
    
    private func setupSecurityMonitoring() {
        // Monitor for security events like app backgrounding
        NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)
            .sink { [weak self] _ in
                self?.resetVerificationAttempts()
            }
            .store(in: &cancellables)
    }
    
    private func mapAuthError(_ error: AuthError) -> TwoFactorError {
        switch error {
        case .invalidCredentials:
            return .invalidCode
        case .networkError:
            return .networkError
        case .serverError:
            return .serverError
        case .tokenExpired:
            return .sessionExpired
        default:
            return .verificationFailed
        }
    }
    
    deinit {
        cancellables.forEach { $0.cancel() }
    }
}