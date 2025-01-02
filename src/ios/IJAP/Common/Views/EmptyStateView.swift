// UIKit version: iOS 13.0+
import UIKit

@available(iOS 13.0, *)
public final class EmptyStateView: UIView {
    
    // MARK: - UI Components
    
    private let imageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .textSecondary
        imageView.translatesAutoresizingMaskIntoConstraints = false
        return imageView
    }()
    
    private let titleLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .title2, compatibleWith: nil)
        label.textColor = .textPrimary
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let messageLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .body, compatibleWith: nil)
        label.textColor = .textSecondary
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var actionButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .medium)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private let contentStack: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    // MARK: - Properties
    
    private let accessibilityGuide = UILayoutGuide()
    private var isRTL: Bool {
        return UIView.userInterfaceLayoutDirection(for: semanticContentAttribute) == .rightToLeft
    }
    
    // MARK: - Initialization
    
    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        // Add layout guide for accessibility
        addLayoutGuide(accessibilityGuide)
        
        // Configure stack view
        contentStack.addArrangedSubview(imageView)
        contentStack.addArrangedSubview(titleLabel)
        contentStack.addArrangedSubview(messageLabel)
        contentStack.addArrangedSubview(actionButton)
        
        // Add to view hierarchy
        addSubviews([contentStack])
        
        // Setup constraints
        NSLayoutConstraint.activate([
            contentStack.centerYAnchor.constraint(equalTo: centerYAnchor),
            contentStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 24),
            contentStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -24),
            
            imageView.heightAnchor.constraint(equalToConstant: 120),
            imageView.widthAnchor.constraint(equalToConstant: 120),
            
            actionButton.widthAnchor.constraint(lessThanOrEqualTo: contentStack.widthAnchor, multiplier: 0.8),
            
            // Accessibility guide constraints
            accessibilityGuide.topAnchor.constraint(equalTo: contentStack.topAnchor),
            accessibilityGuide.leadingAnchor.constraint(equalTo: contentStack.leadingAnchor),
            accessibilityGuide.trailingAnchor.constraint(equalTo: contentStack.trailingAnchor),
            accessibilityGuide.bottomAnchor.constraint(equalTo: contentStack.bottomAnchor)
        ])
        
        // Configure accessibility
        isAccessibilityElement = false
        accessibilityGuide.isAccessibilityElement = true
        accessibilityGuide.accessibilityTraits = .staticText
        
        // Configure semantic content attribute for RTL support
        contentStack.semanticContentAttribute = .unspecified
        imageView.semanticContentAttribute = .unspecified
        titleLabel.semanticContentAttribute = .unspecified
        messageLabel.semanticContentAttribute = .unspecified
        actionButton.semanticContentAttribute = .unspecified
        
        updateLayout()
    }
    
    // MARK: - Public Methods
    
    public func configure(
        image: UIImage? = nil,
        title: String,
        message: String,
        action: (() -> Void)? = nil,
        shouldMirrorImage: Bool = false
    ) {
        // Configure image
        imageView.image = image?.withRenderingMode(.alwaysTemplate)
        imageView.isHidden = image == nil
        
        // Apply RTL image mirroring if needed
        if shouldMirrorImage && isRTL {
            imageView.transform = CGAffineTransform(scaleX: -1, y: 1)
        } else {
            imageView.transform = .identity
        }
        
        // Configure text
        titleLabel.text = title
        messageLabel.text = message
        
        // Configure button
        actionButton.isHidden = action == nil
        if let action = action {
            actionButton.addTarget(self, action: #selector(handleAction), for: .touchUpInside)
            actionButton.actionHandler = action
        }
        
        // Configure accessibility
        accessibilityGuide.accessibilityLabel = title
        accessibilityGuide.accessibilityHint = message
        if action != nil {
            accessibilityGuide.accessibilityTraits.insert(.button)
        }
        
        updateLayout()
    }
    
    // MARK: - Private Methods
    
    private func updateLayout() {
        // Update text alignment for RTL
        let textAlignment: NSTextAlignment = isRTL ? .right : .center
        titleLabel.textAlignment = textAlignment
        messageLabel.textAlignment = textAlignment
        
        // Update stack view spacing for RTL
        contentStack.spacing = isRTL ? 20 : 16
        
        // Update accessibility reading order
        if isRTL {
            accessibilityGuide.accessibilityElements = [messageLabel, titleLabel, imageView, actionButton].compactMap { $0 }
        } else {
            accessibilityGuide.accessibilityElements = [imageView, titleLabel, messageLabel, actionButton].compactMap { $0 }
        }
    }
    
    @objc private func handleAction() {
        (actionButton.actionHandler as? () -> Void)?()
    }
    
    // MARK: - Override Methods
    
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.layoutDirection != previousTraitCollection?.layoutDirection {
            updateLayout()
        }
    }
}

// MARK: - Private Extensions

private extension CustomButton {
    var actionHandler: Any? {
        get { return objc_getAssociatedObject(self, &AssociatedKeys.actionHandler) }
        set { objc_setAssociatedObject(self, &AssociatedKeys.actionHandler, newValue, .OBJC_ASSOCIATION_RETAIN) }
    }
}

private struct AssociatedKeys {
    static var actionHandler = "actionHandler"
}