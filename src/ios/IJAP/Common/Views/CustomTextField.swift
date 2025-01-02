// UIKit version: iOS 13.0+
import UIKit

@IBDesignable
final class CustomTextField: UITextField {
    
    // MARK: - Types
    enum TextFieldType {
        case email
        case password
        case amount
        case general
        case phone
    }
    
    // MARK: - Constants
    private let defaultPadding: CGFloat = 12.0
    private let defaultCornerRadius: CGFloat = 8.0
    private let defaultBorderWidth: CGFloat = 1.0
    private let defaultAnimationDuration: TimeInterval = 0.3
    private let maxPasswordLength: Int = 32
    private let minPasswordLength: Int = 8
    
    // MARK: - Properties
    private(set) var textFieldType: TextFieldType = .general
    private(set) var isValid: Bool = true
    private var errorMessage: String?
    private var padding: UIEdgeInsets
    
    private lazy var validationRules: [TextFieldType: (String) -> Bool] = [
        .email: { $0.isValidEmail },
        .password: { $0.isValidPassword },
        .amount: { $0.isValidDonationAmount },
        .phone: validatePhoneNumber
    ]
    
    private lazy var formatters: [TextFieldType: (String) -> String] = [
        .amount: { $0.formatAsCurrency() },
        .phone: formatPhoneNumber
    ]
    
    // MARK: - Initialization
    override init(frame: CGRect) {
        self.padding = UIEdgeInsets(top: defaultPadding, left: defaultPadding, bottom: defaultPadding, right: defaultPadding)
        super.init(frame: frame)
        setupTextField()
    }
    
    required init?(coder: NSCoder) {
        self.padding = UIEdgeInsets(top: defaultPadding, left: defaultPadding, bottom: defaultPadding, right: defaultPadding)
        super.init(coder: coder)
        setupTextField()
    }
    
    convenience init(type: TextFieldType) {
        self.init(frame: .zero)
        self.textFieldType = type
        configureForType()
    }
    
    // MARK: - Setup
    private func setupTextField() {
        delegate = self
        backgroundColor = .systemBackground
        textColor = .label
        font = .preferredFont(forTextStyle: .body)
        adjustsFontForContentSizeCategory = true
        
        roundCorners(radius: defaultCornerRadius)
        addBorder(width: defaultBorderWidth, color: .systemGray4)
        
        // Configure RTL support
        if UIView.userInterfaceLayoutDirection(for: semanticContentAttribute) == .rightToLeft {
            textAlignment = .right
        }
        
        // Configure accessibility
        isAccessibilityElement = true
        accessibilityTraits = .textField
        
        // Add target for text changes
        addTarget(self, action: #selector(textFieldDidChange), for: .editingChanged)
    }
    
    private func configureForType() {
        switch textFieldType {
        case .email:
            keyboardType = .emailAddress
            autocapitalizationType = .none
            autocorrectionType = .no
            textContentType = .emailAddress
            accessibilityIdentifier = "EmailTextField"
            
        case .password:
            isSecureTextEntry = true
            autocapitalizationType = .none
            autocorrectionType = .no
            textContentType = .newPassword
            accessibilityIdentifier = "PasswordTextField"
            
        case .amount:
            keyboardType = .decimalPad
            textAlignment = .right
            accessibilityIdentifier = "AmountTextField"
            
        case .phone:
            keyboardType = .phonePad
            textContentType = .telephoneNumber
            accessibilityIdentifier = "PhoneTextField"
            
        case .general:
            autocapitalizationType = .sentences
            autocorrectionType = .default
            accessibilityIdentifier = "GeneralTextField"
        }
    }
    
    // MARK: - Validation
    @discardableResult
    func validate() -> Bool {
        guard let text = text?.trimmed else {
            showError(message: "Field cannot be empty".localized)
            return false
        }
        
        if let validationRule = validationRules[textFieldType] {
            isValid = validationRule(text)
            if !isValid {
                showError(message: getErrorMessage())
            }
        }
        
        return isValid
    }
    
    private func validatePhoneNumber(_ number: String) -> Bool {
        // Get current region from app configuration
        let region = ValidationConfig.Region.israel // Default to Israel
        guard let pattern = ValidationConfig.phonePatterns[region] else { return false }
        
        let predicate = NSPredicate(format: "SELF MATCHES %@", pattern)
        return predicate.evaluate(with: number)
    }
    
    // MARK: - Error Handling
    func showError(message: String) {
        errorMessage = message
        addBorder(width: defaultBorderWidth, color: .systemRed)
        shake()
        
        // Update accessibility
        accessibilityLabel = "\(placeholder ?? ""), \(message)"
        UIAccessibility.post(notification: .announcement, argument: message)
    }
    
    func clearError() {
        errorMessage = nil
        addBorder(width: defaultBorderWidth, color: .systemGray4)
        
        // Update accessibility
        accessibilityLabel = placeholder
    }
    
    private func getErrorMessage() -> String {
        switch textFieldType {
        case .email:
            return "Please enter a valid email address".localized
        case .password:
            return "Password must be at least 8 characters with uppercase, lowercase, number and special character".localized
        case .amount:
            return "Please enter a valid donation amount".localized
        case .phone:
            return "Please enter a valid phone number".localized
        case .general:
            return "Please enter valid text".localized
        }
    }
    
    // MARK: - Formatting
    private func formatPhoneNumber(_ number: String) -> String {
        // Format based on region
        let region = ValidationConfig.Region.israel // Default to Israel
        var formatted = number.replacingOccurrences(of: "[^0-9+]", with: "", options: .regularExpression)
        
        switch region {
        case .israel:
            if !formatted.hasPrefix("+972") {
                formatted = "+972" + formatted
            }
        default:
            break
        }
        
        return formatted
    }
    
    // MARK: - UITextField Overrides
    override func textRect(forBounds bounds: CGRect) -> CGRect {
        return bounds.inset(by: padding)
    }
    
    override func editingRect(forBounds bounds: CGRect) -> CGRect {
        return bounds.inset(by: padding)
    }
    
    override func placeholderRect(forBounds bounds: CGRect) -> CGRect {
        return bounds.inset(by: padding)
    }
    
    // MARK: - Actions
    @objc private func textFieldDidChange() {
        if isValid {
            clearError()
        }
        
        if let formatter = formatters[textFieldType] {
            let formatted = formatter(text ?? "")
            if formatted != text {
                text = formatted
            }
        }
    }
}

// MARK: - UITextFieldDelegate
extension CustomTextField: UITextFieldDelegate {
    func textField(_ textField: UITextField, shouldChangeCharactersIn range: NSRange, replacementString string: String) -> Bool {
        let currentText = textField.text ?? ""
        guard let stringRange = Range(range, in: currentText) else { return false }
        let updatedText = currentText.replacingCharacters(in: stringRange, with: string)
        
        switch textFieldType {
        case .password:
            return updatedText.count <= maxPasswordLength
        case .amount:
            let allowedCharacters = CharacterSet(charactersIn: "0123456789.")
            return string.rangeOfCharacter(from: allowedCharacters.inverted) == nil
        default:
            return true
        }
    }
    
    func textFieldDidEndEditing(_ textField: UITextField) {
        validate()
    }
}