// Foundation v13.0+
import Foundation
// UIKit v13.0+
import UIKit

@objc class LocaleUtils: NSObject {
    // MARK: - Static Properties
    
    /// Supported language codes based on Constants configuration
    static let supportedLanguages: [String] = LocalizationKeys.Language.allCases.map { $0.rawValue }
    
    /// Notification posted when language changes
    static let languageChangedNotification = Notification.Name("IJAPLanguageChanged")
    
    // MARK: - Private Properties
    
    /// Cache for storing localized strings to improve performance
    private static let stringCache = NSCache<NSString, NSString>()
    
    /// Cache for storing RTL status of languages
    private static let rtlCache = NSCache<NSString, NSNumber>()
    
    // MARK: - Private Initialization
    
    private override init() {
        super.init()
        // Prevent instantiation
    }
    
    // MARK: - Language Management
    
    /// Gets the currently selected application language
    /// - Returns: Current language code (en, fr, or he) with default to en
    @objc static func getCurrentLanguage() -> String {
        let defaults = UserDefaults.standard
        let savedLanguage = defaults.string(forKey: "IJAPSelectedLanguage")
        
        guard let language = savedLanguage,
              supportedLanguages.contains(language) else {
            return LocalizationKeys.Language.english.rawValue
        }
        
        return language
    }
    
    /// Sets the application language with comprehensive UI updates
    /// - Parameter languageCode: The language code to set (en, fr, or he)
    /// - Returns: Success status of language change operation
    @objc static func setLanguage(_ languageCode: String) -> Bool {
        guard supportedLanguages.contains(languageCode) else {
            return false
        }
        
        // Save language preference
        UserDefaults.standard.set(languageCode, forKey: "IJAPSelectedLanguage")
        
        // Update semantic content attribute for RTL support
        if languageCode == LocalizationKeys.Language.hebrew.rawValue {
            UIView.appearance().semanticContentAttribute = .forceRightToLeft
        } else {
            UIView.appearance().semanticContentAttribute = .forceLeftToRight
        }
        
        // Clear caches
        stringCache.removeAllObjects()
        rtlCache.removeAllObjects()
        
        // Update bundle
        if let languageBundle = LocalizationKeys.localizationBundles[LocalizationKeys.Language(rawValue: languageCode) ?? .english] {
            Bundle.main.preferredLocalizations = [languageCode]
            UserDefaults.standard.set([languageCode], forKey: "AppleLanguages")
        }
        
        // Post notification for UI updates
        NotificationCenter.default.post(name: languageChangedNotification, object: nil)
        
        return true
    }
    
    // MARK: - RTL Support
    
    /// Determines if current language requires RTL layout
    /// - Returns: true if current language is RTL (Hebrew)
    @objc static func isRTL() -> Bool {
        let currentLanguage = getCurrentLanguage() as NSString
        
        // Check cache first
        if let cachedResult = rtlCache.object(forKey: currentLanguage) {
            return cachedResult.boolValue
        }
        
        // Calculate RTL status
        let isRTL = LocalizationKeys.rtlLanguages.contains(LocalizationKeys.Language(rawValue: currentLanguage as String) ?? .english)
        
        // Cache result
        rtlCache.setObject(NSNumber(value: isRTL), forKey: currentLanguage)
        
        return isRTL
    }
    
    // MARK: - String Localization
    
    /// Retrieves localized string with caching
    /// - Parameters:
    ///   - key: The localization key
    ///   - defaultValue: Optional default value if key is not found
    /// - Returns: Localized string value with fallback handling
    @objc static func getLocalizedString(_ key: String, defaultValue: String? = nil) -> String {
        let nsKey = key as NSString
        
        // Check cache first
        if let cachedString = stringCache.object(forKey: nsKey) {
            return cachedString as String
        }
        
        // Get current language
        let currentLanguage = getCurrentLanguage()
        
        // Get appropriate bundle
        let bundle = LocalizationKeys.localizationBundles[LocalizationKeys.Language(rawValue: currentLanguage) ?? .english] ?? Bundle.main
        
        // Get localized string
        let localizedString = bundle.localizedString(forKey: key, value: defaultValue, table: nil)
        
        // Cache successful translation if it's not the key itself
        if localizedString != key {
            stringCache.setObject(localizedString as NSString, forKey: nsKey)
        }
        
        return localizedString
    }
    
    // MARK: - Date Formatting
    
    /// Formats date according to current locale
    /// - Parameters:
    ///   - date: The date to format
    ///   - dateStyle: The date formatting style
    ///   - timeStyle: The time formatting style
    /// - Returns: Locale-formatted date string
    @objc static func formatDate(_ date: Date, dateStyle: DateFormatter.Style, timeStyle: DateFormatter.Style) -> String {
        let formatter = DateFormatter()
        
        // Set locale based on current language
        let currentLanguage = getCurrentLanguage()
        formatter.locale = Locale(identifier: currentLanguage)
        
        // Configure formatter
        formatter.dateStyle = dateStyle
        formatter.timeStyle = timeStyle
        
        // Set calendar for proper date handling
        if currentLanguage == LocalizationKeys.Language.hebrew.rawValue {
            formatter.calendar = Calendar(identifier: .hebrew)
        } else {
            formatter.calendar = Calendar(identifier: .gregorian)
        }
        
        // Set timezone to current
        formatter.timeZone = TimeZone.current
        
        return formatter.string(from: date)
    }
}