//
// ProfileEditViewModel.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+

/// ViewModel for handling secure profile editing with multi-language support
@available(iOS 13.0, *)
public final class ProfileEditViewModel: ViewModelType {
    
    // MARK: - Input/Output Types
    
    public struct Input {
        let firstName: AnyPublisher<String, Never>
        let lastName: AnyPublisher<String, Never>
        let phoneNumber: AnyPublisher<String?, Never>
        let language: AnyPublisher<SupportedLanguage, Never>
        let saveButtonTapped: AnyPublisher<Void, Never>
    }
    
    public struct Output {
        let isLoading: AnyPublisher<Bool, Never>
        let error: AnyPublisher<LocalizedError?, Never>
        let validationState: AnyPublisher<ValidationState, Never>
        let saveEnabled: AnyPublisher<Bool, Never>
        let saveSuccessful: AnyPublisher<Void, Never>
    }
    
    // MARK: - Validation State
    
    public struct ValidationState {
        let isValid: Bool
        let firstNameError: String?
        let lastNameError: String?
        let phoneNumberError: String?
        
        static var initial: ValidationState {
            return ValidationState(isValid: false, firstNameError: nil, lastNameError: nil, phoneNumberError: nil)
        }
    }
    
    // MARK: - Private Properties
    
    private let firstNameSubject = PassthroughSubject<String, Never>()
    private let lastNameSubject = PassthroughSubject<String, Never>()
    private let phoneNumberSubject = PassthroughSubject<String?, Never>()
    private let languageSubject = PassthroughSubject<SupportedLanguage, Never>()
    private let saveSubject = PassthroughSubject<Void, Never>()
    private let userSubject: CurrentValueSubject<User?, Never>
    private let validationState = CurrentValueSubject<ValidationState, Never>(.initial)
    private let isLoadingSubject = CurrentValueSubject<Bool, Never>(false)
    private let errorSubject = CurrentValueSubject<LocalizedError?, Never>(nil)
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Constants
    
    private enum Constants {
        static let nameMinLength = 2
        static let nameMaxLength = 50
        static let phoneRegex = "^\\+?[1-9]\\d{1,14}$"
    }
    
    // MARK: - Initialization
    
    public init(user: User) {
        self.userSubject = CurrentValueSubject<User?, Never>(user)
        
        // Initialize subjects with current user data
        firstNameSubject.send(user.firstName)
        lastNameSubject.send(user.lastName)
        phoneNumberSubject.send(user.phoneNumber)
        languageSubject.send(user.preferredLanguage)
        
        // Set up validation monitoring
        setupValidation()
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(input: Input) -> Output {
        // Bind input events to subjects
        input.firstName
            .sink { [weak self] in self?.firstNameSubject.send($0) }
            .store(in: &cancellables)
        
        input.lastName
            .sink { [weak self] in self?.lastNameSubject.send($0) }
            .store(in: &cancellables)
        
        input.phoneNumber
            .sink { [weak self] in self?.phoneNumberSubject.send($0) }
            .store(in: &cancellables)
        
        input.language
            .sink { [weak self] in self?.languageSubject.send($0) }
            .store(in: &cancellables)
        
        input.saveButtonTapped
            .sink { [weak self] in self?.handleSave() }
            .store(in: &cancellables)
        
        // Create save enabled publisher
        let saveEnabled = validationState
            .map { $0.isValid }
            .eraseToAnyPublisher()
        
        // Create save successful publisher
        let saveSuccessful = saveSubject
            .flatMap { [weak self] _ -> AnyPublisher<Void, Never> in
                guard let self = self,
                      let user = self.userSubject.value else {
                    return Empty().eraseToAnyPublisher()
                }
                
                return self.updateUserProfile(user)
                    .catch { error -> AnyPublisher<Void, Never> in
                        self.errorSubject.send(error as? LocalizedError)
                        return Empty().eraseToAnyPublisher()
                    }
                    .eraseToAnyPublisher()
            }
            .eraseToAnyPublisher()
        
        return Output(
            isLoading: isLoadingSubject.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher(),
            validationState: validationState.eraseToAnyPublisher(),
            saveEnabled: saveEnabled,
            saveSuccessful: saveSuccessful
        )
    }
    
    // MARK: - Private Methods
    
    private func setupValidation() {
        // Combine latest values for validation
        Publishers.CombineLatest3(
            firstNameSubject,
            lastNameSubject,
            phoneNumberSubject
        )
        .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
        .map { [weak self] firstName, lastName, phone in
            self?.validateInput(
                firstName: firstName,
                lastName: lastName,
                phoneNumber: phone
            ) ?? .initial
        }
        .sink { [weak self] state in
            self?.validationState.send(state)
        }
        .store(in: &cancellables)
    }
    
    private func validateInput(
        firstName: String,
        lastName: String,
        phoneNumber: String?
    ) -> ValidationState {
        var firstNameError: String?
        var lastNameError: String?
        var phoneNumberError: String?
        
        // Validate first name
        if firstName.count < Constants.nameMinLength {
            firstNameError = NSLocalizedString(
                "error.firstname.too_short",
                comment: "First name too short error"
            )
        } else if firstName.count > Constants.nameMaxLength {
            firstNameError = NSLocalizedString(
                "error.firstname.too_long",
                comment: "First name too long error"
            )
        }
        
        // Validate last name
        if lastName.count < Constants.nameMinLength {
            lastNameError = NSLocalizedString(
                "error.lastname.too_short",
                comment: "Last name too short error"
            )
        } else if lastName.count > Constants.nameMaxLength {
            lastNameError = NSLocalizedString(
                "error.lastname.too_long",
                comment: "Last name too long error"
            )
        }
        
        // Validate phone number if provided
        if let phone = phoneNumber, !phone.isEmpty {
            let phoneRegex = try? NSRegularExpression(pattern: Constants.phoneRegex)
            if phoneRegex?.firstMatch(
                in: phone,
                range: NSRange(location: 0, length: phone.count)
            ) == nil {
                phoneNumberError = NSLocalizedString(
                    "error.phone.invalid",
                    comment: "Invalid phone number error"
                )
            }
        }
        
        let isValid = firstNameError == nil &&
                     lastNameError == nil &&
                     phoneNumberError == nil
        
        return ValidationState(
            isValid: isValid,
            firstNameError: firstNameError,
            lastNameError: lastNameError,
            phoneNumberError: phoneNumberError
        )
    }
    
    private func handleSave() {
        guard validationState.value.isValid else { return }
        saveSubject.send(())
    }
    
    private func updateUserProfile(_ user: User) -> AnyPublisher<Void, Error> {
        isLoadingSubject.send(true)
        
        return UserService.shared.updateProfile(
            firstName: firstNameSubject.value,
            lastName: lastNameSubject.value,
            phoneNumber: phoneNumberSubject.value
        )
        .flatMap { [weak self] _ -> AnyPublisher<Void, Error> in
            guard let self = self else { return Empty().eraseToAnyPublisher() }
            return self.updateLanguagePreference()
        }
        .handleEvents(
            receiveCompletion: { [weak self] _ in
                self?.isLoadingSubject.send(false)
            }
        )
        .eraseToAnyPublisher()
    }
    
    private func updateLanguagePreference() -> AnyPublisher<Void, Error> {
        return UserService.shared.updateLanguagePreference(languageSubject.value)
            .map { _ in () }
            .eraseToAnyPublisher()
    }
}