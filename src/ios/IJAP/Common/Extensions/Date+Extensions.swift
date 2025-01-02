// Foundation v13.0+
import Foundation

// MARK: - Date Extension
extension Date {
    // Thread-safe formatter cache to improve performance
    private static let dateFormatterCache = NSCache<NSString, DateFormatter>()
    
    // MARK: - Private Helper Methods
    private static func getCachedFormatter(format: String, locale: Locale = .current) -> DateFormatter {
        let cacheKey = "\(format)_\(locale.identifier)" as NSString
        
        if let cachedFormatter = dateFormatterCache.object(forKey: cacheKey) {
            return cachedFormatter
        }
        
        let formatter = DateFormatter()
        formatter.dateFormat = format
        formatter.locale = locale
        dateFormatterCache.setObject(formatter, forKey: cacheKey)
        
        return formatter
    }
    
    // MARK: - Date Formatting Methods
    
    /// Converts date to string using specified format and locale
    /// - Parameters:
    ///   - format: The date format string
    ///   - locale: Optional locale for formatting (defaults to current)
    /// - Returns: Formatted date string
    func toString(format: String, locale: Locale? = nil) -> String {
        let formatter = Date.getCachedFormatter(format: format, locale: locale ?? .current)
        return formatter.string(from: self)
    }
    
    /// Converts date to short date string format
    /// - Parameter locale: Optional locale for formatting
    /// - Returns: Short formatted date string
    func toShortDateString(locale: Locale? = nil) -> String {
        let formatter = Date.getCachedFormatter(format: "dd/MM/yyyy", locale: locale ?? .current)
        return formatter.string(from: self)
    }
    
    /// Converts date to long date string format
    /// - Parameter locale: Optional locale for formatting
    /// - Returns: Long formatted date string
    func toLongDateString(locale: Locale? = nil) -> String {
        let formatter = Date.getCachedFormatter(format: "EEEE, MMMM dd, yyyy", locale: locale ?? .current)
        return formatter.string(from: self)
    }
    
    /// Converts date to relative string format (e.g., "2 hours ago")
    /// - Returns: Relative time string
    func toRelativeString() -> String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: self, relativeTo: Date())
    }
    
    // MARK: - Date Manipulation Methods
    
    /// Returns date set to start of day (00:00:00)
    /// - Returns: Date object set to start of current day
    func startOfDay() -> Date {
        let calendar = Calendar.current
        let components = calendar.dateComponents([.year, .month, .day], from: self)
        return calendar.date(from: components) ?? self
    }
    
    /// Returns date set to end of day (23:59:59)
    /// - Returns: Date object set to end of current day
    func endOfDay() -> Date {
        let calendar = Calendar.current
        var components = calendar.dateComponents([.year, .month, .day], from: self)
        components.hour = 23
        components.minute = 59
        components.second = 59
        return calendar.date(from: components) ?? self
    }
    
    /// Adds specified number of days to date
    /// - Parameter days: Number of days to add
    /// - Returns: New date with days added
    func addDays(_ days: Int) -> Date {
        let calendar = Calendar.current
        return calendar.date(byAdding: .day, value: days, to: self) ?? self
    }
    
    /// Adds specified number of months to date
    /// - Parameter months: Number of months to add
    /// - Returns: New date with months added
    func addMonths(_ months: Int) -> Date {
        let calendar = Calendar.current
        return calendar.date(byAdding: .month, value: months, to: self) ?? self
    }
    
    // MARK: - Date Comparison Methods
    
    /// Checks if date is in the past
    /// - Returns: Boolean indicating if date is in the past
    var isInPast: Bool {
        return self < Date()
    }
    
    /// Checks if date is in the future
    /// - Returns: Boolean indicating if date is in the future
    var isInFuture: Bool {
        return self > Date()
    }
    
    /// Checks if date is the same day as another date
    /// - Parameter date: Date to compare with
    /// - Returns: Boolean indicating if dates are the same day
    func isSameDay(as date: Date) -> Date {
        let calendar = Calendar.current
        return calendar.isDate(self, inSameDayAs: date)
    }
}