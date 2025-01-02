// Foundation v13.0+
import Foundation

/// Supported currencies for the application
@objc public enum SupportedCurrencies: String {
    case usd = "USD"
    case eur = "EUR"
    case ils = "ILS"
}

/// Currency-related error types
@objc public enum CurrencyError: Int, Error {
    case invalidCurrency
    case invalidAmount
    case conversionFailed
    case staleExchangeRates
    case networkError
}

/// Result of currency amount validation
@objc public enum ValidationResult: Int {
    case valid
    case belowMinimum
    case unsupportedCurrency
}

/// Utility class providing comprehensive currency functionality
@objc public class CurrencyUtils: NSObject {
    
    // MARK: - Private Properties
    
    private static var exchangeRates: [String: Decimal] = [:]
    private static var lastRateUpdate: Date?
    private static var formattingCache: [String: String] = [:]
    
    private static let rateUpdateInterval: TimeInterval = CurrencyConfig.rateUpdateInterval
    private static let notificationCenter = NotificationCenter.default
    
    // MARK: - Public Methods
    
    /// Formats a decimal amount with proper currency symbol and locale-specific formatting
    /// - Parameters:
    ///   - amount: The amount to format
    ///   - currencyCode: The currency code (USD, EUR, ILS)
    /// - Returns: Formatted currency string or error
    @objc public static func formatAmount(_ amount: Decimal, currencyCode: String) -> Result<String, CurrencyError> {
        // Validate currency
        guard let _ = SupportedCurrencies(rawValue: currencyCode) else {
            return .failure(.invalidCurrency)
        }
        
        // Check cache
        let cacheKey = "\(amount)-\(currencyCode)"
        if let cachedFormat = formattingCache[cacheKey] {
            return .success(cachedFormat)
        }
        
        // Create formatter
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = currencyCode
        formatter.locale = LocaleManager.shared.currentLocale
        
        // Format amount
        guard let formattedString = formatter.string(from: NSDecimalNumber(decimal: amount)) else {
            return .failure(.invalidAmount)
        }
        
        // Cache result
        formattingCache[cacheKey] = formattedString
        
        return .success(formattedString)
    }
    
    /// Validates if an amount meets minimum donation requirements
    /// - Parameters:
    ///   - amount: The amount to validate
    ///   - currencyCode: The currency code
    /// - Returns: Validation result
    @objc public static func validateAmount(_ amount: Decimal, currencyCode: String) -> ValidationResult {
        guard let currency = SupportedCurrencies(rawValue: currencyCode) else {
            return .unsupportedCurrency
        }
        
        let minimumAmount = CurrencyConfig.minimumDonations[CurrencyConfig.Currency(rawValue: currencyCode)!] ?? 0
        
        if amount < minimumAmount {
            return .belowMinimum
        }
        
        return .valid
    }
    
    /// Converts an amount between currencies
    /// - Parameters:
    ///   - amount: The amount to convert
    ///   - fromCurrency: Source currency code
    ///   - toCurrency: Target currency code
    /// - Returns: Converted amount or error
    @objc public static func convertAmount(_ amount: Decimal, 
                                         fromCurrency: String, 
                                         toCurrency: String) -> Result<Decimal, CurrencyError> {
        // Validate currencies
        guard let _ = SupportedCurrencies(rawValue: fromCurrency),
              let _ = SupportedCurrencies(rawValue: toCurrency) else {
            return .failure(.invalidCurrency)
        }
        
        // Check if rates need update
        if needsRateUpdate() {
            let updateResult = updateExchangeRates()
            switch updateResult {
            case .failure(let error):
                return .failure(error)
            case .success:
                break
            }
        }
        
        // Get conversion rate
        guard let rate = getConversionRate(from: fromCurrency, to: toCurrency) else {
            return .failure(.conversionFailed)
        }
        
        // Perform conversion
        let convertedAmount = amount * rate
        
        // Validate result
        if case .belowMinimum = validateAmount(convertedAmount, currencyCode: toCurrency) {
            return .failure(.invalidAmount)
        }
        
        return .success(convertedAmount)
    }
    
    /// Updates exchange rates from remote service
    /// - Returns: Success or error status
    @objc public static func updateExchangeRates() -> Result<Void, CurrencyError> {
        // Implementation would include API call to fetch rates
        // For now, using mock implementation
        exchangeRates = [
            "USD_EUR": 0.85,
            "USD_ILS": 3.5,
            "EUR_USD": 1.18,
            "EUR_ILS": 4.12,
            "ILS_USD": 0.29,
            "ILS_EUR": 0.24
        ].mapValues { Decimal($0) }
        
        lastRateUpdate = Date()
        formattingCache.removeAll()
        
        notificationCenter.post(name: Notification.Name("ExchangeRatesUpdated"), object: nil)
        
        return .success(())
    }
    
    // MARK: - Private Methods
    
    private static func needsRateUpdate() -> Bool {
        guard let lastUpdate = lastRateUpdate else {
            return true
        }
        return Date().timeIntervalSince(lastUpdate) > rateUpdateInterval
    }
    
    private static func getConversionRate(from: String, to: String) -> Decimal? {
        if from == to {
            return 1
        }
        return exchangeRates["\(from)_\(to)"]
    }
}