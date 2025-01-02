// Foundation v13.0+
import Foundation

// MARK: - App Information
struct AppInfo {
    static let version = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
    static let build = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
}

// MARK: - API Configuration
struct APIConfig {
    // Base configuration
    static let baseURL = "https://api.ijap.org"
    static let apiVersion = "v1"
    static let timeoutInterval: TimeInterval = 30.0
    static let retryAttempts = 3
    
    // Environment-specific URLs
    enum Environment: String {
        case development
        case staging
        case production
    }
    
    static let environmentURLs: [Environment: String] = [
        .development: "https://dev-api.ijap.org",
        .staging: "https://staging-api.ijap.org",
        .production: "https://api.ijap.org"
    ]
}

// MARK: - Localization Configuration
struct LocalizationKeys {
    enum Language: String {
        case english = "en"
        case hebrew = "he"
        case french = "fr"
    }
    
    static let supportedLanguages: [Language] = [.english, .hebrew, .french]
    static let defaultLanguage: Language = .english
    static let rtlLanguages: Set<Language> = [.hebrew]
    
    static let localizationBundles: [Language: Bundle] = [
        .english: Bundle(for: LocalizationKeys.self),
        .hebrew: Bundle(for: LocalizationKeys.self),
        .french: Bundle(for: LocalizationKeys.self)
    ]
}

// MARK: - Security Configuration
struct SecurityConfig {
    struct BiometricConfiguration {
        static let allowedTypes: [BiometricType] = [.faceID, .touchID]
        static let fallbackToPasscode = true
        static let evaluationPolicy = LAPolicy.deviceOwnerAuthenticationWithBiometrics
    }
    
    static let biometricReason = "Authenticate to access your account"
    static let keychainService = "org.ijap.keychain"
    static let sessionTimeout: TimeInterval = 15 * 60 // 15 minutes
    static let encryptionKeySize = 256
    static let biometricConfig = BiometricConfiguration()
    
    enum BiometricType {
        case faceID
        case touchID
    }
}

// MARK: - Validation Configuration
struct ValidationConfig {
    struct PasswordValidationRules {
        static let minLength = 8
        static let maxLength = 64
        static let requiresUppercase = true
        static let requiresLowercase = true
        static let requiresNumbers = true
        static let requiresSpecialCharacters = true
        static let specialCharacters = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    }
    
    struct DonationValidationRules {
        static let minAmount: Decimal = 1.0
        static let maxAmount: Decimal = 1_000_000.0
        static let maxDailyTransactions = 50
    }
    
    static let passwordRules = PasswordValidationRules()
    static let emailPattern = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
    
    enum Region: String {
        case israel = "IL"
        case usa = "US"
        case france = "FR"
    }
    
    static let phonePatterns: [Region: String] = [
        .israel: "^\\+972\\d{9}$",
        .usa: "^\\+1\\d{10}$",
        .france: "^\\+33\\d{9}$"
    ]
    
    static let donationLimits = DonationValidationRules()
}

// MARK: - Currency Configuration
struct CurrencyConfig {
    enum Currency: String {
        case usd = "USD"
        case ils = "ILS"
        case eur = "EUR"
    }
    
    static let supportedCurrencies: [Currency] = [.usd, .ils, .eur]
    static let defaultCurrency: Currency = .usd
    
    static let currencySymbols: [Currency: String] = [
        .usd: "$",
        .ils: "₪",
        .eur: "€"
    ]
    
    static let minimumDonations: [Currency: Decimal] = [
        .usd: 18.0,
        .ils: 50.0,
        .eur: 15.0
    ]
    
    static let rateUpdateInterval: TimeInterval = 15 * 60 // 15 minutes
}