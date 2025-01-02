//
// LoginViewModel.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+
import LocalAuthentication // iOS 13.0+

@available(iOS 13.0, *)
public final class LoginViewModel: ViewModelType {
    
    // MARK: - Input/Output Types
    
    public enum Input {
        case emailChanged(String)
        case passwordChanged(String)
        case loginTapped
        case biometricLoginTapped
        case languageChanged(SupportedLanguage)
        case resetValidation
    }
    
    public enum Output {
        case isLoading(Bool)
        case validationError(LocalizedError?)
        case loginSuccess(User)
        case loginFailure(AuthError)
        case biometricAvailable(Bool)
        case securityCheckFailed
    }
    
    // MARK: - Private Properties
    
    private let authService: AuthService
    private var cancellables = Set<AnyCancellable>()
    private let securityUtils: SecurityUtils
    private var loginAttempts: Int = 0
    private let maxLoginAttempts = 5
    private var lastLoginAttempt: Date?
    private var currentEmail = ""
    private var currentPassword = ""
    private let subject = PassthroughSubject<Output, Never>()
    private var currentLanguage: SupportedLanguage = .english
    
    // MARK: - Initialization
    
    public init() {
        self.authService = AuthService.shared
        self.securityUtils = SecurityUtils()
        
        // Check device security status on initialization
        checkDeviceSecurity()
        
        // Setup biometric authentication if available
        checkBiometricAvailability()
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(input: AnyPublisher<Input, Never>) -> AnyPublisher<Output, Never> {
        input.sink { [weak self] event in
            self?.handleInput(event)
        }.store(in: &cancellables)
        
        return subject.eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func handleInput(_ input: Input) {
        switch input {
        case .emailChanged(let email):
            currentEmail = email
            validateInput()
            
        case .passwordChanged(let password):
            currentPassword = password
            validateInput()
            
        case .loginTapped:
            performLogin()
            
        case .biometricLoginTapped:
            performBiometricLogin()
            
        case .languageChanged(let language):
            handleLanguageChange(language)
            
        case .resetValidation:
            resetValidationState()
        }
    }
    
    private func validateInput() {
        // Sanitize input
        let sanitizedEmail = currentEmail.trimmingCharacters(in: .whitespacesAndNewlines)
        let sanitizedPassword = currentPassword
        
        // Validate email format
        guard sanitizedEmail.range(of: ValidationConfig.emailPattern,
                                 options: .regularExpression) != nil else {
            subject.send(.validationError(ValidationError.invalidEmail))
            return
        }
        
        // Validate password requirements
        let passwordRules = ValidationConfig.PasswordValidationRules.self
        guard sanitizedPassword.count >= passwordRules.minLength,
              sanitizedPassword.count <= passwordRules.maxLength else {
            subject.send(.validationError(ValidationError.invalidPassword))
            return
        }
        
        // Clear validation errors if all checks pass
        subject.send(.validationError(nil))
    }
    
    private func performLogin() {
        guard checkRateLimiting() else {
            subject.send(.loginFailure(.tooManyAttempts))
            return
        }
        
        subject.send(.isLoading(true))
        
        authService.login(email: currentEmail, password: currentPassword)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.subject.send(.isLoading(false))
                    if case .failure(let error) = completion {
                        self?.handleLoginError(error)
                    }
                },
                receiveValue: { [weak self] user in
                    self?.handleLoginSuccess(user)
                }
            )
            .store(in: &cancellables)
    }
    
    private func performBiometricLogin() {
        subject.send(.isLoading(true))
        
        SecurityUtils.authenticateWithBiometrics()
            .flatMap { [weak self] _ -> AnyPublisher<User, AuthError> in
                guard let self = self else {
                    return Fail(error: AuthError.unknown).eraseToAnyPublisher()
                }
                return self.authService.biometricLogin()
            }
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.subject.send(.isLoading(false))
                    if case .failure(let error) = completion {
                        self?.subject.send(.loginFailure(error))
                    }
                },
                receiveValue: { [weak self] user in
                    self?.handleLoginSuccess(user)
                }
            )
            .store(in: &cancellables)
    }
    
    private func handleLoginSuccess(_ user: User) {
        loginAttempts = 0
        lastLoginAttempt = nil
        subject.send(.loginSuccess(user))
    }
    
    private func handleLoginError(_ error: AuthError) {
        loginAttempts += 1
        lastLoginAttempt = Date()
        subject.send(.loginFailure(error))
    }
    
    private func checkRateLimiting() -> Bool {
        guard loginAttempts < maxLoginAttempts else {
            // Calculate cooldown period using exponential backoff
            let cooldownPeriod = pow(2.0, Double(loginAttempts - maxLoginAttempts))
            
            if let lastAttempt = lastLoginAttempt,
               Date().timeIntervalSince(lastAttempt) < cooldownPeriod {
                return false
            }
            
            // Reset attempts after cooldown
            loginAttempts = 0
            return true
        }
        return true
    }
    
    private func checkDeviceSecurity() {
        if SecurityUtils.detectJailbreak() {
            subject.send(.securityCheckFailed)
        }
    }
    
    private func checkBiometricAvailability() {
        let context = LAContext()
        var error: NSError?
        
        let canUseBiometrics = context.canEvaluatePolicy(
            .deviceOwnerAuthenticationWithBiometrics,
            error: &error
        )
        
        subject.send(.biometricAvailable(canUseBiometrics))
    }
    
    private func handleLanguageChange(_ language: SupportedLanguage) {
        currentLanguage = language
        // Update localization bundle
        Bundle.setLanguage(language.rawValue)
    }
    
    private func resetValidationState() {
        currentEmail = ""
        currentPassword = ""
        subject.send(.validationError(nil))
    }
}

// MARK: - Error Types

private enum ValidationError: LocalizedError {
    case invalidEmail
    case invalidPassword
    case invalidInput
    
    var errorDescription: String? {
        switch self {
        case .invalidEmail:
            return NSLocalizedString(
                "login.error.invalid_email",
                tableName: "Login",
                bundle: .main,
                comment: "Invalid email format"
            )
        case .invalidPassword:
            return NSLocalizedString(
                "login.error.invalid_password",
                tableName: "Login",
                bundle: .main,
                comment: "Invalid password format"
            )
        case .invalidInput:
            return NSLocalizedString(
                "login.error.invalid_input",
                tableName: "Login",
                bundle: .main,
                comment: "Invalid input"
            )
        }
    }
}