// UIKit version: iOS 13.0+
import UIKit

@available(iOS 13.0, *)
@IBDesignable
public class CustomButton: UIButton {
    
    // MARK: - Enums
    
    public enum ButtonStyle {
        case primary
        case secondary
        case outline
        case text
    }
    
    public enum ButtonSize {
        case small
        case medium
        case large
        
        var height: CGFloat {
            switch self {
            case .small: return 32
            case .medium: return 44
            case .large: return 56
            }
        }
        
        var cornerRadius: CGFloat {
            switch self {
            case .small: return 8
            case .medium: return 12
            case .large: return 16
            }
        }
        
        var contentPadding: UIEdgeInsets {
            switch self {
            case .small: return UIEdgeInsets(top: 6, left: 12, bottom: 6, right: 12)
            case .medium: return UIEdgeInsets(top: 8, left: 16, bottom: 8, right: 16)
            case .large: return UIEdgeInsets(top: 12, left: 24, bottom: 12, right: 24)
            }
        }
    }
    
    // MARK: - Properties
    
    public var style: ButtonStyle = .primary {
        didSet { setupAppearance() }
    }
    
    public var size: ButtonSize = .medium {
        didSet { setupAppearance() }
    }
    
    public override var isEnabled: Bool {
        didSet { updateState() }
    }
    
    private(set) public var isLoading: Bool = false {
        didSet { updateLoadingState() }
    }
    
    private lazy var loadingIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        indicator.translatesAutoresizingMaskIntoConstraints = false
        return indicator
    }()
    
    private let feedbackGenerator = UIImpactFeedbackGenerator(style: .medium)
    
    // MARK: - Initialization
    
    public init(style: ButtonStyle = .primary, size: ButtonSize = .medium) {
        self.style = style
        self.size = size
        super.init(frame: .zero)
        commonInit()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        commonInit()
    }
    
    private func commonInit() {
        // Configure base properties
        adjustsImageWhenHighlighted = false
        adjustsImageWhenDisabled = true
        
        // Setup for dynamic type
        titleLabel?.adjustsFontForContentSizeCategory = true
        titleLabel?.adjustsFontSizeToFitWidth = true
        titleLabel?.minimumScaleFactor = 0.75
        
        // Configure for RTL support
        semanticContentAttribute = .unspecified
        
        // Add loading indicator
        addSubview(loadingIndicator)
        NSLayoutConstraint.activate([
            loadingIndicator.centerYAnchor.constraint(equalTo: centerYAnchor),
            loadingIndicator.centerXAnchor.constraint(equalTo: centerXAnchor)
        ])
        
        // Setup initial appearance
        setupAppearance()
        
        // Configure accessibility
        isAccessibilityElement = true
        accessibilityTraits = .button
        
        // Add touch handlers
        addTarget(self, action: #selector(touchDown), for: .touchDown)
        addTarget(self, action: #selector(touchUp), for: [.touchUpInside, .touchUpOutside, .touchCancel])
    }
    
    // MARK: - Public Methods
    
    public func setLoading(_ loading: Bool) {
        guard loading != isLoading else { return }
        isLoading = loading
    }
    
    // MARK: - Private Methods
    
    private func setupAppearance() {
        // Configure size constraints
        constraints.forEach { constraint in
            if constraint.firstAttribute == .height {
                removeConstraint(constraint)
            }
        }
        
        heightAnchor.constraint(equalToConstant: size.height).isActive = true
        
        // Configure corner radius
        roundCorners(radius: size.cornerRadius)
        
        // Configure content padding
        contentEdgeInsets = size.contentPadding
        
        // Configure font
        let fontMetrics = UIFontMetrics(forTextStyle: .body)
        let baseFont: UIFont = .systemFont(ofSize: size == .large ? 17 : 15, weight: .semibold)
        titleLabel?.font = fontMetrics.scaledFont(for: baseFont)
        
        updateState()
    }
    
    private func updateState() {
        // Configure colors based on style and state
        switch style {
        case .primary:
            backgroundColor = isEnabled ? .primary : .primary.withAlphaComponent(0.5)
            setTitleColor(.background, for: .normal)
            setTitleColor(.background.withAlphaComponent(0.7), for: .highlighted)
            setTitleColor(.background.withAlphaComponent(0.5), for: .disabled)
            layer.borderWidth = 0
            
        case .secondary:
            backgroundColor = isEnabled ? .secondary : .secondary.withAlphaComponent(0.5)
            setTitleColor(.background, for: .normal)
            setTitleColor(.background.withAlphaComponent(0.7), for: .highlighted)
            setTitleColor(.background.withAlphaComponent(0.5), for: .disabled)
            layer.borderWidth = 0
            
        case .outline:
            backgroundColor = .clear
            setTitleColor(.primary, for: .normal)
            setTitleColor(.primary.withAlphaComponent(0.7), for: .highlighted)
            setTitleColor(.primary.withAlphaComponent(0.5), for: .disabled)
            addBorder(width: 2, color: isEnabled ? .primary : .primary.withAlphaComponent(0.5))
            
        case .text:
            backgroundColor = .clear
            setTitleColor(.primary, for: .normal)
            setTitleColor(.primary.withAlphaComponent(0.7), for: .highlighted)
            setTitleColor(.primary.withAlphaComponent(0.5), for: .disabled)
            layer.borderWidth = 0
        }
        
        // Update accessibility
        accessibilityLabel = titleLabel?.text
        accessibilityTraits = isEnabled ? .button : [.button, .notEnabled]
    }
    
    private func updateLoadingState() {
        isUserInteractionEnabled = !isLoading
        
        if isLoading {
            loadingIndicator.startAnimating()
            titleLabel?.layer.opacity = 0
            imageView?.layer.opacity = 0
        } else {
            loadingIndicator.stopAnimating()
            titleLabel?.layer.opacity = 1
            imageView?.layer.opacity = 1
        }
        
        // Update accessibility
        if isLoading {
            accessibilityValue = NSLocalizedString("Loading", comment: "Loading state accessibility value")
            accessibilityTraits.insert(.updatesFrequently)
        } else {
            accessibilityValue = nil
            accessibilityTraits.remove(.updatesFrequently)
        }
    }
    
    // MARK: - Touch Handlers
    
    @objc private func touchDown() {
        guard isEnabled && !isLoading else { return }
        feedbackGenerator.prepare()
        feedbackGenerator.impactOccurred()
    }
    
    @objc private func touchUp() {
        guard isEnabled && !isLoading else { return }
        feedbackGenerator.impactOccurred(intensity: 0.7)
    }
    
    // MARK: - Layout
    
    public override func layoutSubviews() {
        super.layoutSubviews()
        
        // Update loading indicator position for RTL
        if effectiveUserInterfaceLayoutDirection == .rightToLeft {
            loadingIndicator.transform = CGAffineTransform(scaleX: -1, y: 1)
        } else {
            loadingIndicator.transform = .identity
        }
    }
    
    // MARK: - Trait Collection
    
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            updateState()
        }
    }
}