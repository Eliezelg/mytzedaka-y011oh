//
// ProfileViewModel.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+
import Combine // iOS 13.0+

/// ViewModel for managing user profile data with comprehensive security, offline support,
/// and internationalization features
@available(iOS 13.0, *)
public final class ProfileViewModel {
    
    // MARK: - Types
    
    /// Input events from the view
    public struct Input {
        let updateProfile: AnyPublisher<ProfileUpdateData, Never>
        let updateLanguage: AnyPublisher<SupportedLanguage, Never>
        let toggleTwoFactor: AnyPublisher<Bool, Never>
        let syncRequest: AnyPublisher<Void, Never>
    }
    
    /// Output events to the view
    public struct Output {
        let profileState: AnyPublisher<ProfileState, Never>
        let validationErrors: AnyPublisher<[ValidationError], Never>
        let isLoading: AnyPublisher<Bool, Never>
        let offlineStatus: AnyPublisher<OfflineStatus, Never>
    }
    
    /// Profile update data structure
    public struct ProfileUpdateData {
        let firstName: String
        let lastName: String
        let phoneNumber: String?
    }
    
    /// Profile state representation
    public struct ProfileState {
        let user: User
        let hasOfflineChanges: Bool
        let lastSyncTimestamp: Date?
    }
    
    /// Offline operation status
    public enum OfflineStatus {
        case online
        case offline(pendingChanges: Int)
    }
    
    /// Validation error types
    public enum ValidationError: LocalizedError {
        case invalidFirstName
        case invalidLastName
        case invalidPhoneNumber
        
        public var errorDescription: String? {
            switch self {
            case .invalidFirstName:
                return NSLocalizedString(
                    "error.invalid_first_name",
                    tableName: "Profile",
                    bundle: .main,
                    comment: "Invalid first name error message"
                )
            case .invalidLastName:
                return NSLocalizedString(
                    "error.invalid_last_name",
                    tableName: "Profile",
                    bundle: .main,
                    comment: "Invalid last name error message"
                )
            case .invalidPhoneNumber:
                return NSLocalizedString(
                    "error.invalid_phone",
                    tableName: "Profile",
                    bundle: .main,
                    comment: "Invalid phone number error message"
                )
            }
        }
    }
    
    // MARK: - Properties
    
    private let userService: UserService
    private var cancellables = Set<AnyCancellable>()
    private let profileStateSubject = CurrentValueSubject<ProfileState?, Never>(nil)
    private let validationErrorsSubject = PassthroughSubject<[ValidationError], Never>()
    private let loadingSubject = CurrentValueSubject<Bool, Never>(false)
    private let offlineStatusSubject = CurrentValueSubject<OfflineStatus, Never>(.online)
    
    // MARK: - Private Properties
    
    private let offlineQueue: OperationQueue = {
        let queue = OperationQueue()
        queue.maxConcurrentOperationCount = 1
        queue.qualityOfService = .utility
        return queue
    }()
    
    private let validationRules: ProfileValidationRules = {
        let rules = ProfileValidationRules()
        rules.configure()
        return rules
    }()
    
    // MARK: - Initialization
    
    public init(userService: UserService = .shared) {
        self.userService = userService
        setupOfflineSupport()
        setupNetworkMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Transforms input events into output events
    public func transform(_ input: Input) -> Output {
        // Handle profile updates
        input.updateProfile
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] updateData in
                self?.handleProfileUpdate(updateData)
            }
            .store(in: &cancellables)
        
        // Handle language preference updates
        input.updateLanguage
            .sink { [weak self] language in
                self?.handleLanguageUpdate(language)
            }
            .store(in: &cancellables)
        
        // Handle two-factor authentication toggle
        input.toggleTwoFactor
            .sink { [weak self] enabled in
                self?.handleTwoFactorToggle(enabled)
            }
            .store(in: &cancellables)
        
        // Handle sync requests
        input.syncRequest
            .sink { [weak self] in
                self?.syncOfflineChanges()
            }
            .store(in: &cancellables)
        
        return Output(
            profileState: profileStateSubject.compactMap { $0 }.eraseToAnyPublisher(),
            validationErrors: validationErrorsSubject.eraseToAnyPublisher(),
            isLoading: loadingSubject.eraseToAnyPublisher(),
            offlineStatus: offlineStatusSubject.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func handleProfileUpdate(_ updateData: ProfileUpdateData) {
        // Validate input data
        let validationErrors = validateProfileData(updateData)
        
        guard validationErrors.isEmpty else {
            validationErrorsSubject.send(validationErrors)
            return
        }
        
        loadingSubject.send(true)
        
        // Check network connectivity
        if NetworkMonitor.shared.isConnected.value {
            updateProfile(updateData)
        } else {
            queueOfflineOperation(.updateProfile(updateData))
        }
    }
    
    private func handleLanguageUpdate(_ language: SupportedLanguage) {
        loadingSubject.send(true)
        
        userService.updateLanguagePreference(language)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.loadingSubject.send(false)
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                },
                receiveValue: { [weak self] user in
                    self?.updateProfileState(user)
                }
            )
            .store(in: &cancellables)
    }
    
    private func handleTwoFactorToggle(_ enabled: Bool) {
        loadingSubject.send(true)
        
        userService.toggleTwoFactorAuth(enabled: enabled)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.loadingSubject.send(false)
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                },
                receiveValue: { [weak self] user in
                    self?.updateProfileState(user)
                }
            )
            .store(in: &cancellables)
    }
    
    private func updateProfile(_ data: ProfileUpdateData) {
        userService.updateProfile(
            firstName: data.firstName,
            lastName: data.lastName,
            phoneNumber: data.phoneNumber
        )
        .receive(on: DispatchQueue.main)
        .sink(
            receiveCompletion: { [weak self] completion in
                self?.loadingSubject.send(false)
                if case .failure(let error) = completion {
                    self?.handleError(error)
                }
            },
            receiveValue: { [weak self] user in
                self?.updateProfileState(user)
            }
        )
        .store(in: &cancellables)
    }
    
    private func validateProfileData(_ data: ProfileUpdateData) -> [ValidationError] {
        var errors: [ValidationError] = []
        
        if !validationRules.isValidName(data.firstName) {
            errors.append(.invalidFirstName)
        }
        
        if !validationRules.isValidName(data.lastName) {
            errors.append(.invalidLastName)
        }
        
        if let phone = data.phoneNumber, !validationRules.isValidPhone(phone) {
            errors.append(.invalidPhoneNumber)
        }
        
        return errors
    }
    
    private func setupOfflineSupport() {
        offlineQueue.maxConcurrentOperationCount = 1
        offlineQueue.qualityOfService = .utility
    }
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] isConnected in
                if isConnected {
                    self?.syncOfflineChanges()
                }
                self?.updateOfflineStatus()
            }
            .store(in: &cancellables)
    }
    
    private func queueOfflineOperation(_ operation: OfflineOperation) {
        // Store operation in Core Data
        let context = CoreDataManager.shared.viewContext
        // Implementation of offline operation storage
        
        updateOfflineStatus()
    }
    
    private func syncOfflineChanges() {
        guard NetworkMonitor.shared.isConnected.value else { return }
        
        loadingSubject.send(true)
        
        // Fetch and process offline operations
        let context = CoreDataManager.shared.viewContext
        // Implementation of offline operation processing
        
        loadingSubject.send(false)
        updateOfflineStatus()
    }
    
    private func updateProfileState(_ user: User) {
        let hasOfflineChanges = offlineQueue.operationCount > 0
        let state = ProfileState(
            user: user,
            hasOfflineChanges: hasOfflineChanges,
            lastSyncTimestamp: Date()
        )
        profileStateSubject.send(state)
    }
    
    private func updateOfflineStatus() {
        let isOnline = NetworkMonitor.shared.isConnected.value
        let pendingChanges = offlineQueue.operationCount
        
        let status: OfflineStatus = isOnline ? .online : .offline(pendingChanges: pendingChanges)
        offlineStatusSubject.send(status)
    }
    
    private func handleError(_ error: Error) {
        // Implement error handling logic
    }
}

// MARK: - Supporting Types

private struct ProfileValidationRules {
    private var nameRegex = "^[\\p{L}\\s'-]{2,50}$"
    private var phoneRegex = "^\\+?[1-9]\\d{1,14}$"
    
    mutating func configure() {
        // Configure validation rules
    }
    
    func isValidName(_ name: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: nameRegex) else { return false }
        let range = NSRange(location: 0, length: name.utf16.count)
        return regex.firstMatch(in: name, range: range) != nil
    }
    
    func isValidPhone(_ phone: String) -> Bool {
        guard let regex = try? NSRegularExpression(pattern: phoneRegex) else { return false }
        let range = NSRange(location: 0, length: phone.utf16.count)
        return regex.firstMatch(in: phone, range: range) != nil
    }
}

private enum OfflineOperation {
    case updateProfile(ProfileViewModel.ProfileUpdateData)
    case updateLanguage(SupportedLanguage)
    case toggleTwoFactor(Bool)
}