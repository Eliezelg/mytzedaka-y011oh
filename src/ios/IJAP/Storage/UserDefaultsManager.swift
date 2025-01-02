// Foundation v13.0+
import Foundation

// MARK: - Error Types
enum UserDefaultsError: Error {
    case invalidLanguageCode
    case invalidCurrencyCode
    case invalidValue
    case migrationFailed
}

// MARK: - UserDefaults Keys
enum UserDefaultsKeys: String {
    case language
    case theme
    case currency
    case notificationsEnabled
    case biometricsEnabled
    case lastUpdateVersion
}

// MARK: - Theme Mode
enum ThemeMode: String {
    case light
    case dark
    case system
}

// MARK: - UserDefaults Manager
final class UserDefaultsManager {
    // MARK: - Singleton Instance
    static let shared = UserDefaultsManager()
    
    // MARK: - Properties
    private let defaults: UserDefaults
    private let queue: DispatchQueue
    private let supportedLanguages: [String]
    private let supportedCurrencies: [String]
    private var cache: [String: Any]
    
    // MARK: - Notification Names
    static let languageDidChangeNotification = Notification.Name("UserDefaultsManagerLanguageDidChange")
    static let themeDidChangeNotification = Notification.Name("UserDefaultsManagerThemeDidChange")
    static let currencyDidChangeNotification = Notification.Name("UserDefaultsManagerCurrencyDidChange")
    
    // MARK: - Initialization
    private init() {
        self.defaults = UserDefaults.standard
        self.queue = DispatchQueue(label: "org.ijap.userdefaults", qos: .userInitiated)
        self.cache = [:]
        
        // Initialize supported languages from Constants
        self.supportedLanguages = LocalizationKeys.supportedLanguages.map { $0.rawValue }
        
        // Initialize supported currencies from Constants
        self.supportedCurrencies = CurrencyConfig.supportedCurrencies.map { $0.rawValue }
        
        // Register defaults
        let defaultValues: [String: Any] = [
            UserDefaultsKeys.language.rawValue: LocalizationKeys.defaultLanguage.rawValue,
            UserDefaultsKeys.theme.rawValue: ThemeMode.system.rawValue,
            UserDefaultsKeys.currency.rawValue: CurrencyConfig.defaultCurrency.rawValue,
            UserDefaultsKeys.notificationsEnabled.rawValue: true,
            UserDefaultsKeys.biometricsEnabled.rawValue: false,
            UserDefaultsKeys.lastUpdateVersion.rawValue: AppInfo.version
        ]
        
        defaults.register(defaults: defaultValues)
        performMigrationIfNeeded()
        initializeCache()
    }
    
    // MARK: - Private Methods
    private func performMigrationIfNeeded() {
        let currentVersion = AppInfo.version
        let lastVersion = defaults.string(forKey: UserDefaultsKeys.lastUpdateVersion.rawValue)
        
        guard currentVersion != lastVersion else { return }
        
        // Perform version-specific migrations here
        defaults.set(currentVersion, forKey: UserDefaultsKeys.lastUpdateVersion.rawValue)
    }
    
    private func initializeCache() {
        queue.sync {
            for key in UserDefaultsKeys.allCases {
                if let value = defaults.object(forKey: key.rawValue) {
                    cache[key.rawValue] = value
                }
            }
        }
    }
    
    // MARK: - Language Management
    func setLanguage(_ languageCode: String) -> Result<Void, UserDefaultsError> {
        guard supportedLanguages.contains(languageCode) else {
            return .failure(.invalidLanguageCode)
        }
        
        return queue.sync {
            defaults.set(languageCode, forKey: UserDefaultsKeys.language.rawValue)
            cache[UserDefaultsKeys.language.rawValue] = languageCode
            NotificationCenter.default.post(name: UserDefaultsManager.languageDidChangeNotification, object: nil)
            return .success(())
        }
    }
    
    func getLanguage() -> String {
        return queue.sync {
            return cache[UserDefaultsKeys.language.rawValue] as? String
                ?? LocalizationKeys.defaultLanguage.rawValue
        }
    }
    
    // MARK: - Theme Management
    func setTheme(_ theme: ThemeMode) -> Result<Void, UserDefaultsError> {
        return queue.sync {
            defaults.set(theme.rawValue, forKey: UserDefaultsKeys.theme.rawValue)
            cache[UserDefaultsKeys.theme.rawValue] = theme.rawValue
            NotificationCenter.default.post(name: UserDefaultsManager.themeDidChangeNotification, object: nil)
            return .success(())
        }
    }
    
    func getTheme() -> ThemeMode {
        return queue.sync {
            guard let themeString = cache[UserDefaultsKeys.theme.rawValue] as? String,
                  let theme = ThemeMode(rawValue: themeString) else {
                return .system
            }
            return theme
        }
    }
    
    // MARK: - Currency Management
    func setCurrency(_ currencyCode: String) -> Result<Void, UserDefaultsError> {
        guard supportedCurrencies.contains(currencyCode) else {
            return .failure(.invalidCurrencyCode)
        }
        
        return queue.sync {
            defaults.set(currencyCode, forKey: UserDefaultsKeys.currency.rawValue)
            cache[UserDefaultsKeys.currency.rawValue] = currencyCode
            NotificationCenter.default.post(name: UserDefaultsManager.currencyDidChangeNotification, object: nil)
            return .success(())
        }
    }
    
    func getCurrency() -> String {
        return queue.sync {
            return cache[UserDefaultsKeys.currency.rawValue] as? String
                ?? CurrencyConfig.defaultCurrency.rawValue
        }
    }
    
    // MARK: - Notification Preferences
    func setNotificationsEnabled(_ enabled: Bool) {
        queue.sync {
            defaults.set(enabled, forKey: UserDefaultsKeys.notificationsEnabled.rawValue)
            cache[UserDefaultsKeys.notificationsEnabled.rawValue] = enabled
        }
    }
    
    func areNotificationsEnabled() -> Bool {
        return queue.sync {
            return cache[UserDefaultsKeys.notificationsEnabled.rawValue] as? Bool ?? true
        }
    }
    
    // MARK: - Biometric Authentication
    func setBiometricsEnabled(_ enabled: Bool) {
        queue.sync {
            defaults.set(enabled, forKey: UserDefaultsKeys.biometricsEnabled.rawValue)
            cache[UserDefaultsKeys.biometricsEnabled.rawValue] = enabled
        }
    }
    
    func isBiometricsEnabled() -> Bool {
        return queue.sync {
            return cache[UserDefaultsKeys.biometricsEnabled.rawValue] as? Bool ?? false
        }
    }
    
    // MARK: - Cache Management
    func clearCache() {
        queue.sync {
            cache.removeAll()
            initializeCache()
        }
    }
    
    // MARK: - Reset
    func resetToDefaults() {
        queue.sync {
            let domain = Bundle.main.bundleIdentifier!
            defaults.removePersistentDomain(forName: domain)
            defaults.synchronize()
            clearCache()
        }
    }
}

// MARK: - UserDefaultsKeys Extension
extension UserDefaultsKeys: CaseIterable {}