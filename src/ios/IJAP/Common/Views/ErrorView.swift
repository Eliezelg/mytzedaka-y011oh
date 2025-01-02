// UIKit version: iOS 13.0+
import UIKit

@available(iOS 13.0, *)
public final class ErrorView: UIView {
    
    // MARK: - UI Components
    
    private let iconImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .error
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    private let titleLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.textColor = .textPrimary
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let messageLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .body)
        label.textColor = .textSecondary
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var retryButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .medium)
        button.addTarget(self, action: #selector(retryButtonTapped), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private let stackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    // MARK: - Properties
    
    private var retryAction: (() -> Void)?
    public var isRTLEnabled: Bool {
        return UIView.userInterfaceLayoutDirection(for: semanticContentAttribute) == .rightToLeft
    }
    
    // MARK: - Initialization
    
    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
        setupConstraints()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
        setupConstraints()
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        backgroundColor = .background
        
        // Configure icon
        if let errorImage = UIImage(systemName: "exclamationmark.triangle.fill") {
            iconImageView.image = errorImage
        }
        
        // Add subviews to stack
        stackView.addArrangedSubview(iconImageView)
        stackView.addArrangedSubview(titleLabel)
        stackView.addArrangedSubview(messageLabel)
        stackView.addArrangedSubview(retryButton)
        addSubview(stackView)
        
        // Configure accessibility
        isAccessibilityElement = false
        accessibilityIdentifier = "ErrorView"
        
        iconImageView.isAccessibilityElement = false
        titleLabel.accessibilityTraits = .header
        retryButton.accessibilityTraits = .button
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            iconImageView.heightAnchor.constraint(equalToConstant: 48),
            iconImageView.widthAnchor.constraint(equalToConstant: 48),
            
            stackView.centerYAnchor.constraint(equalTo: centerYAnchor),
            stackView.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            stackView.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            
            retryButton.heightAnchor.constraint(equalToConstant: 44),
            retryButton.widthAnchor.constraint(greaterThanOrEqualToConstant: 120)
        ])
    }
    
    // MARK: - Public Methods
    
    public func configure(title: String, message: String, retryAction: (() -> Void)? = nil) {
        titleLabel.text = title
        messageLabel.text = message
        self.retryAction = retryAction
        
        // Configure retry button visibility
        retryButton.isHidden = retryAction == nil
        if retryAction != nil {
            retryButton.setTitle(NSLocalizedString("Retry", comment: "Retry button title"), for: .normal)
        }
        
        // Update text alignment for RTL
        let textAlignment: NSTextAlignment = isRTLEnabled ? .right : .center
        titleLabel.textAlignment = textAlignment
        messageLabel.textAlignment = textAlignment
        
        // Configure accessibility
        let accessibilityMessage = "\(title}. \(message)"
        if let retryAction = retryAction {
            accessibilityValue = "\(accessibilityMessage). \(NSLocalizedString("Double tap to retry", comment: "Retry accessibility hint"))"
        } else {
            accessibilityValue = accessibilityMessage
        }
        
        UIAccessibility.post(notification: .screenChanged, argument: self)
    }
    
    // MARK: - Actions
    
    @objc private func retryButtonTapped() {
        retryAction?()
    }
    
    // MARK: - Trait Collection
    
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            iconImageView.tintColor = .error
            titleLabel.textColor = .textPrimary
            messageLabel.textColor = .textSecondary
        }
        
        // Update text alignment for RTL changes
        let textAlignment: NSTextAlignment = isRTLEnabled ? .right : .center
        titleLabel.textAlignment = textAlignment
        messageLabel.textAlignment = textAlignment
    }
}