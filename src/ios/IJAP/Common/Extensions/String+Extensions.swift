// Foundation v13.0+
import Foundation

// MARK: - String Extensions
extension String {
    
    // MARK: - Email Validation
    /// Validates if the string is a properly formatted email address using comprehensive validation rules
    /// - Returns: Boolean indicating if the string is a valid email address
    var isValidEmail: Bool {
        guard !self.isEmpty else { return false }
        
        let emailRegex = ValidationConfig.emailPattern
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        
        // Basic format validation
        guard emailPredicate.evaluate(with: self) else { return false }
        
        // Additional validation checks
        let components = self.components(separatedBy: "@")
        guard components.count == 2,
              let domain = components.last,
              domain.contains("."),
              domain.components(separatedBy: ".").last?.count ?? 0 >= 2 else {
            return false
        }
        
        return true
    }
    
    // MARK: - Password Validation
    /// Validates if the string meets password complexity requirements
    /// - Returns: Boolean indicating if the string is a valid password
    var isValidPassword: Bool {
        let rules = ValidationConfig.PasswordValidationRules.self
        
        // Length validation
        guard self.count >= rules.minLength,
              self.count <= rules.maxLength else {
            return false
        }
        
        // Character type validation
        let hasUppercase = rules.requiresUppercase ? self.contains(where: { $0.isUppercase }) : true
        let hasLowercase = rules.requiresLowercase ? self.contains(where: { $0.isLowercase }) : true
        let hasNumbers = rules.requiresNumbers ? self.contains(where: { $0.isNumber }) : true
        let hasSpecialCharacters = rules.requiresSpecialCharacters ?
            self.contains(where: { rules.specialCharacters.contains($0) }) : true
        
        // Check for consecutive repeated characters
        let hasConsecutiveChars = zip(self, self.dropFirst())
            .contains(where: { $0 == $1 })
        
        return hasUppercase && hasLowercase && hasNumbers &&
               hasSpecialCharacters && !hasConsecutiveChars
    }
    
    // MARK: - Currency Formatting
    /// Formats the string as a localized currency amount
    /// - Parameter currencyCode: The currency code to use for formatting (default is USD)
    /// - Returns: A properly formatted currency string
    func formatAsCurrency(currencyCode: String = CurrencyConfig.Currency.usd.rawValue) -> String {
        guard let number = Decimal(string: self) else { return self }
        
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        
        // Configure locale-specific formatting
        if let currency = CurrencyConfig.Currency(rawValue: currencyCode) {
            formatter.currencySymbol = CurrencyConfig.currencySymbols[currency] ?? ""
        }
        
        // Handle RTL formatting for specific currencies
        if currencyCode == CurrencyConfig.Currency.ils.rawValue {
            formatter.locale = Locale(identifier: "he_IL")
        }
        
        // Configure decimal places and grouping
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.usesGroupingSeparator = true
        
        return formatter.string(from: NSDecimalNumber(decimal: number)) ?? self
    }
    
    // MARK: - Localization
    /// Returns the localized version of the string with support for format arguments
    /// - Returns: The localized string from the appropriate language bundle
    var localized: String {
        let currentLanguage = LocalizationKeys.Language.english // Default to English
        
        // Get the appropriate bundle for the current language
        guard let bundle = LocalizationKeys.localizationBundles[currentLanguage] else {
            return self
        }
        
        // Get localized string
        let localizedString = NSLocalizedString(self, bundle: bundle, comment: "")
        
        // Handle RTL languages
        if LocalizationKeys.rtlLanguages.contains(currentLanguage) {
            return "\u{200F}" + localizedString + "\u{200F}" // Add RTL markers
        }
        
        return localizedString
    }
    
    // MARK: - Helper Methods
    
    /// Removes all whitespace and newlines from the string
    var trimmed: String {
        return self.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    /// Checks if the string contains only numbers
    var isNumeric: Bool {
        return !isEmpty && rangeOfCharacter(from: CharacterSet.decimalDigits.inverted) == nil
    }
    
    /// Checks if the string is a valid donation amount within configured limits
    var isValidDonationAmount: Bool {
        guard let amount = Decimal(string: self) else { return false }
        let limits = ValidationConfig.DonationValidationRules.self
        return amount >= limits.minAmount && amount <= limits.maxAmount
    }
    
    /// Returns a string with HTML tags removed
    var stripHTML: String {
        return self.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
    }
}