//
// RegisterViewModel.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+

/// ViewModel handling secure user registration with comprehensive validation,
/// internationalization support, and error handling
@available(iOS 13.0, *)
final class RegisterViewModel: ViewModelType {
    
    // MARK: - Input/Output Types
    
    struct Input {
        let email: AnyPublisher<String, Never>
        let password: AnyPublisher<String, Never>
        let confirmPassword: AnyPublisher<String, Never>
        let firstName: AnyPublisher<String, Never>
        let lastName: AnyPublisher<String, Never>
        let phoneNumber: AnyPublisher<String?, Never>
        let submit: AnyPublisher<Void, Never>
        let language: AnyPublisher<SupportedLanguage, Never>
    }
    
    struct Output {
        let isLoading: AnyPublisher<Bool, Never>
        let validationState: AnyPublisher<ValidationState, Never>
        let error: AnyPublisher<String?, Never>
        let registrationComplete: AnyPublisher<User, Never>
    }
    
    // MARK: - Validation State
    
    enum ValidationState {
        case idle
        case validating
        case invalid([String: String])
        case valid
    }
    
    // MARK: - Properties
    
    private let emailSubject = PassthroughSubject<String, Never>()
    private let passwordSubject = PassthroughSubject<String, Never>()
    private let confirmPasswordSubject = PassthroughSubject<String, Never>()
    private let firstNameSubject = PassthroughSubject<String, Never>()
    private let lastNameSubject = PassthroughSubject<String, Never>()
    private let phoneNumberSubject = PassthroughSubject<String?, Never>()
    private let submitSubject = PassthroughSubject<Void, Never>()
    private let languageSubject = CurrentValueSubject<SupportedLanguage, Never>(.english)
    
    private let isLoadingSubject = CurrentValueSubject<Bool, Never>(false)
    private let validationStateSubject = CurrentValueSubject<ValidationState, Never>(.idle)
    private let errorSubject = CurrentValueSubject<String?, Never>(nil)
    private let registrationCompleteSubject = PassthroughSubject<User, Never>()
    
    private var cancellables = Set<AnyCancellable>()
    private var submissionAttempts = 0
    private let maxSubmissionAttempts = 3
    private let submissionThrottleInterval: TimeInterval = 60
    
    // MARK: - Transform
    
    func transform(input: Input) -> Output {
        // Bind input subjects
        input.email
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in self?.emailSubject.send($0) }
            .store(in: &cancellables)
        
        input.password
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in self?.passwordSubject.send($0) }
            .store(in: &cancellables)
        
        input.confirmPassword
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in self?.confirmPasswordSubject.send($0) }
            .store(in: &cancellables)
        
        input.firstName
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in self?.firstNameSubject.send($0) }
            .store(in: &cancellables)
        
        input.lastName
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in self?.lastNameSubject.send($0) }
            .store(in: &cancellables)
        
        input.phoneNumber
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] in self?.phoneNumberSubject.send($0) }
            .store(in: &cancellables)
        
        input.language
            .sink { [weak self] in self?.languageSubject.send($0) }
            .store(in: &cancellables)
        
        // Setup form validation
        setupFormValidation()
        
        // Handle submission
        input.submit
            .throttle(for: .seconds(submissionThrottleInterval), scheduler: RunLoop.main, latest: true)
            .sink { [weak self] in self?.handleSubmission() }
            .store(in: &cancellables)
        
        return Output(
            isLoading: isLoadingSubject.eraseToAnyPublisher(),
            validationState: validationStateSubject.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher(),
            registrationComplete: registrationCompleteSubject.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func setupFormValidation() {
        Publishers.CombineLatest4(
            emailSubject,
            passwordSubject,
            confirmPasswordSubject,
            Publishers.CombineLatest(firstNameSubject, lastNameSubject)
        )
        .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
        .map { [weak self] email, password, confirmPassword, names in
            self?.validateForm(
                email: email,
                password: password,
                confirmPassword: confirmPassword,
                firstName: names.0,
                lastName: names.1
            ) ?? .invalid(["error": "Validation failed"])
        }
        .sink { [weak self] state in
            self?.validationStateSubject.send(state)
        }
        .store(in: &cancellables)
    }
    
    private func validateForm(
        email: String,
        password: String,
        confirmPassword: String,
        firstName: String,
        lastName: String
    ) -> ValidationState {
        var errors = [String: String]()
        
        // Email validation
        if !isValidEmail(email) {
            errors["email"] = NSLocalizedString(
                "registration.error.invalid_email",
                comment: "Invalid email format"
            )
        }
        
        // Password validation
        let passwordValidation = validatePassword(password, confirmPassword: confirmPassword)
        if !passwordValidation.0 {
            errors["password"] = passwordValidation.1
        }
        
        // Name validation
        if firstName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors["firstName"] = NSLocalizedString(
                "registration.error.first_name_required",
                comment: "First name is required"
            )
        }
        
        if lastName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            errors["lastName"] = NSLocalizedString(
                "registration.error.last_name_required",
                comment: "Last name is required"
            )
        }
        
        return errors.isEmpty ? .valid : .invalid(errors)
    }
    
    private func isValidEmail(_ email: String) -> Bool {
        let emailRegex = ValidationConfig.emailPattern
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        return emailPredicate.evaluate(with: email)
    }
    
    private func validatePassword(_ password: String, confirmPassword: String) -> (Bool, String) {
        let rules = ValidationConfig.PasswordValidationRules.self
        
        // Length check
        if password.count < rules.minLength {
            return (false, NSLocalizedString(
                "registration.error.password_too_short",
                comment: "Password is too short"
            ))
        }
        
        if password.count > rules.maxLength {
            return (false, NSLocalizedString(
                "registration.error.password_too_long",
                comment: "Password is too long"
            ))
        }
        
        // Complexity checks
        let hasUppercase = password.contains(where: { $0.isUppercase })
        let hasLowercase = password.contains(where: { $0.isLowercase })
        let hasNumbers = password.contains(where: { $0.isNumber })
        let hasSpecialCharacters = password.contains(where: { rules.specialCharacters.contains($0) })
        
        if rules.requiresUppercase && !hasUppercase {
            return (false, NSLocalizedString(
                "registration.error.password_requires_uppercase",
                comment: "Password must contain uppercase letters"
            ))
        }
        
        if rules.requiresLowercase && !hasLowercase {
            return (false, NSLocalizedString(
                "registration.error.password_requires_lowercase",
                comment: "Password must contain lowercase letters"
            ))
        }
        
        if rules.requiresNumbers && !hasNumbers {
            return (false, NSLocalizedString(
                "registration.error.password_requires_numbers",
                comment: "Password must contain numbers"
            ))
        }
        
        if rules.requiresSpecialCharacters && !hasSpecialCharacters {
            return (false, NSLocalizedString(
                "registration.error.password_requires_special",
                comment: "Password must contain special characters"
            ))
        }
        
        // Password match check
        if password != confirmPassword {
            return (false, NSLocalizedString(
                "registration.error.passwords_dont_match",
                comment: "Passwords do not match"
            ))
        }
        
        return (true, "")
    }
    
    private func handleSubmission() {
        guard submissionAttempts < maxSubmissionAttempts else {
            errorSubject.send(NSLocalizedString(
                "registration.error.too_many_attempts",
                comment: "Too many registration attempts"
            ))
            return
        }
        
        guard case .valid = validationStateSubject.value else {
            errorSubject.send(NSLocalizedString(
                "registration.error.invalid_form",
                comment: "Please fix validation errors"
            ))
            return
        }
        
        isLoadingSubject.send(true)
        submissionAttempts += 1
        
        // Create registration profile
        var profile: [String: Any] = [
            "firstName": firstNameSubject.value,
            "lastName": lastNameSubject.value,
            "preferredLanguage": languageSubject.value.rawValue,
            "role": UserRole.donor.rawValue
        ]
        
        if let phone = phoneNumberSubject.value {
            profile["phoneNumber"] = phone
        }
        
        // Perform registration
        AuthService.shared.register(
            email: emailSubject.value,
            password: passwordSubject.value,
            profile: profile
        )
        .receive(on: DispatchQueue.main)
        .sink(
            receiveCompletion: { [weak self] completion in
                self?.isLoadingSubject.send(false)
                if case .failure(let error) = completion {
                    self?.errorSubject.send(error.localizedDescription)
                }
            },
            receiveValue: { [weak self] user in
                self?.registrationCompleteSubject.send(user)
            }
        )
        .store(in: &cancellables)
    }
}