// Foundation v13.0+
import Foundation
// Combine v13.0+
import Combine

/// Thread-safe view model for managing application settings and user preferences
/// with comprehensive error handling and reactive updates.
@available(iOS 13.0, *)
final class SettingsViewModel: ViewModelType {
    // MARK: - Type Definitions
    
    /// Input events for settings changes
    enum Input {
        case changeLanguage(String)
        case changeTheme(ThemeMode)
        case toggleNotifications(Bool)
        case toggleBiometrics(Bool)
    }
    
    /// Output events from settings changes
    enum Output {
        case settingsUpdated(SettingsState)
        case error(SettingsError)
    }
    
    /// Comprehensive error types for settings operations
    enum SettingsError: LocalizedError {
        case invalidLanguage(String)
        case themePersistenceFailure
        case notificationPermissionDenied
        case biometricsUnavailable
        case persistenceFailure
        
        var errorDescription: String? {
            switch self {
            case .invalidLanguage(let code):
                return "Invalid language code: \(code)"
            case .themePersistenceFailure:
                return "Failed to persist theme setting"
            case .notificationPermissionDenied:
                return "Notification permissions are denied"
            case .biometricsUnavailable:
                return "Biometric authentication is not available"
            case .persistenceFailure:
                return "Failed to persist settings"
            }
        }
    }
    
    /// Thread-safe current state of application settings
    struct SettingsState {
        let language: String
        let theme: ThemeMode
        let notificationsEnabled: Bool
        let biometricsEnabled: Bool
    }
    
    // MARK: - Private Properties
    
    private let userDefaults: UserDefaultsManager
    private var cancellables = Set<AnyCancellable>()
    private let queue: DispatchQueue
    private let settingsSubject: CurrentValueSubject<SettingsState, Never>
    private let errorSubject = PassthroughSubject<SettingsError, Never>()
    
    // MARK: - Initialization
    
    init() {
        self.queue = DispatchQueue(label: "org.ijap.settings", qos: .userInitiated)
        self.userDefaults = UserDefaultsManager.shared
        
        // Initialize settings state
        let initialState = SettingsState(
            language: LocaleUtils.getCurrentLanguage(),
            theme: userDefaults.getTheme(),
            notificationsEnabled: userDefaults.areNotificationsEnabled(),
            biometricsEnabled: userDefaults.isBiometricsEnabled()
        )
        self.settingsSubject = CurrentValueSubject<SettingsState, Never>(initialState)
    }
    
    // MARK: - ViewModelType Implementation
    
    func transform(input: AnyPublisher<Input, Never>) -> AnyPublisher<Output, Never> {
        // Set up input handlers
        let languageUpdates = input
            .filter { if case .changeLanguage = $0 { return true } else { return false } }
            .compactMap { if case .changeLanguage(let code) = $0 { return code } else { return nil } }
            .debounce(for: .milliseconds(300), scheduler: queue)
            .flatMap { [weak self] languageCode -> AnyPublisher<Output, Never> in
                guard let self = self else { return Empty().eraseToAnyPublisher() }
                
                guard LocaleUtils.supportedLanguages.contains(languageCode) else {
                    return Just(.error(.invalidLanguage(languageCode))).eraseToAnyPublisher()
                }
                
                return self.queue.sync {
                    if LocaleUtils.setLanguage(languageCode) {
                        let newState = self.updateSettingsState(language: languageCode)
                        return Just(.settingsUpdated(newState)).eraseToAnyPublisher()
                    } else {
                        return Just(.error(.persistenceFailure)).eraseToAnyPublisher()
                    }
                }
            }
        
        let themeUpdates = input
            .filter { if case .changeTheme = $0 { return true } else { return false } }
            .compactMap { if case .changeTheme(let theme) = $0 { return theme } else { return nil } }
            .flatMap { [weak self] theme -> AnyPublisher<Output, Never> in
                guard let self = self else { return Empty().eraseToAnyPublisher() }
                
                return self.queue.sync {
                    switch self.userDefaults.setTheme(theme) {
                    case .success:
                        let newState = self.updateSettingsState(theme: theme)
                        return Just(.settingsUpdated(newState)).eraseToAnyPublisher()
                    case .failure:
                        return Just(.error(.themePersistenceFailure)).eraseToAnyPublisher()
                    }
                }
            }
        
        let notificationUpdates = input
            .filter { if case .toggleNotifications = $0 { return true } else { return false } }
            .compactMap { if case .toggleNotifications(let enabled) = $0 { return enabled } else { return nil } }
            .flatMap { [weak self] enabled -> AnyPublisher<Output, Never> in
                guard let self = self else { return Empty().eraseToAnyPublisher() }
                
                return self.queue.sync {
                    self.userDefaults.setNotificationsEnabled(enabled)
                    let newState = self.updateSettingsState(notifications: enabled)
                    return Just(.settingsUpdated(newState)).eraseToAnyPublisher()
                }
            }
        
        let biometricUpdates = input
            .filter { if case .toggleBiometrics = $0 { return true } else { return false } }
            .compactMap { if case .toggleBiometrics(let enabled) = $0 { return enabled } else { return nil } }
            .flatMap { [weak self] enabled -> AnyPublisher<Output, Never> in
                guard let self = self else { return Empty().eraseToAnyPublisher() }
                
                return self.queue.sync {
                    self.userDefaults.setBiometricsEnabled(enabled)
                    let newState = self.updateSettingsState(biometrics: enabled)
                    return Just(.settingsUpdated(newState)).eraseToAnyPublisher()
                }
            }
        
        // Merge all update streams
        return Publishers.MergeMany([
            languageUpdates,
            themeUpdates,
            notificationUpdates,
            biometricUpdates
        ])
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }
    
    // MARK: - Public Methods
    
    /// Thread-safe retrieval of current settings state
    func getCurrentSettings() -> SettingsState {
        return queue.sync {
            return settingsSubject.value
        }
    }
    
    // MARK: - Private Methods
    
    private func updateSettingsState(
        language: String? = nil,
        theme: ThemeMode? = nil,
        notifications: Bool? = nil,
        biometrics: Bool? = nil
    ) -> SettingsState {
        let currentState = settingsSubject.value
        let newState = SettingsState(
            language: language ?? currentState.language,
            theme: theme ?? currentState.theme,
            notificationsEnabled: notifications ?? currentState.notificationsEnabled,
            biometricsEnabled: biometrics ?? currentState.biometricsEnabled
        )
        settingsSubject.send(newState)
        return newState
    }
}