// UIKit version: iOS 13.0+
import UIKit

@available(iOS 13.0, *)
public final class LoadingView: UIView {
    
    // MARK: - Private Properties
    private let activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.hidesWhenStopped = true
        indicator.color = .label
        return indicator
    }()
    
    private let messageLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .body)
        label.textColor = .label
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private let stackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.distribution = .fill
        return stack
    }()
    
    private let containerView: UIView = {
        let view = UIView()
        view.backgroundColor = .systemBackground.withAlphaComponent(0.95)
        view.layer.cornerRadius = 12
        view.clipsToBounds = true
        return view
    }()
    
    private var centerYConstraint: NSLayoutConstraint!
    private var centerXConstraint: NSLayoutConstraint!
    private var minimumPresentationWorkItem: DispatchWorkItem?
    private var presentationDate: Date?
    
    // MARK: - Public Properties
    public private(set) var isAnimating: Bool = false
    
    // MARK: - Initialization
    public override init(frame: CGRect) {
        super.init(frame: frame)
        setupUI()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupUI()
    }
    
    // MARK: - Private Methods
    private func setupUI() {
        backgroundColor = .clear
        
        // Add subviews
        addSubview(containerView)
        containerView.addSubview(stackView)
        stackView.addArrangedSubview(activityIndicator)
        stackView.addArrangedSubview(messageLabel)
        
        // Configure accessibility
        isAccessibilityElement = false
        containerView.isAccessibilityElement = true
        containerView.accessibilityTraits = .updatesFrequently
        containerView.accessibilityIdentifier = "LoadingView.Container"
        
        // Setup constraints with layout margins
        containerView.translatesAutoresizingMaskIntoConstraints = false
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        centerYConstraint = containerView.centerYAnchor.constraint(equalTo: centerYAnchor)
        centerXConstraint = containerView.centerXAnchor.constraint(equalTo: centerXAnchor)
        
        NSLayoutConstraint.activate([
            centerYConstraint,
            centerXConstraint,
            
            containerView.widthAnchor.constraint(lessThanOrEqualTo: widthAnchor, multiplier: 0.8),
            containerView.heightAnchor.constraint(lessThanOrEqualTo: heightAnchor, multiplier: 0.8),
            
            stackView.topAnchor.constraint(equalTo: containerView.topAnchor, constant: 24),
            stackView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor, constant: 24),
            stackView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor, constant: -24),
            stackView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor, constant: -24)
        ])
        
        // Initial state
        alpha = 0
        isHidden = true
    }
    
    // MARK: - Public Methods
    public func show(message: String? = nil, minimumPresentationTime: TimeInterval = 0.5, animated: Bool = true) {
        minimumPresentationWorkItem?.cancel()
        
        messageLabel.text = message
        messageLabel.isHidden = message == nil
        
        // Update layout for RTL if needed
        if UIView.userInterfaceLayoutDirection(for: semanticContentAttribute) == .rightToLeft {
            messageLabel.textAlignment = .right
        }
        
        // Start animation
        activityIndicator.startAnimating()
        isAnimating = true
        presentationDate = Date()
        
        // Show with animation
        let show = { [weak self] in
            self?.isHidden = false
            self?.alpha = 1
        }
        
        if animated {
            UIView.animate(withDuration: 0.3, delay: 0, options: .beginFromCurrentState) {
                show()
            }
        } else {
            show()
        }
        
        // Update accessibility
        containerView.accessibilityLabel = message ?? NSLocalizedString("Loading", comment: "Loading view accessibility label")
        UIAccessibility.post(notification: .screenChanged, argument: containerView)
        
        // Handle minimum presentation time
        if minimumPresentationTime > 0 {
            let workItem = DispatchWorkItem { [weak self] in
                self?.minimumPresentationWorkItem = nil
            }
            minimumPresentationWorkItem = workItem
            DispatchQueue.main.asyncAfter(deadline: .now() + minimumPresentationTime, execute: workItem)
        }
    }
    
    public func hide(animated: Bool = true) {
        // Check minimum presentation time
        if let presentationDate = presentationDate,
           let minimumWorkItem = minimumPresentationWorkItem {
            let timeElapsed = Date().timeIntervalSince(presentationDate)
            if timeElapsed < 0.5 {
                DispatchQueue.main.asyncAfter(deadline: .now() + (0.5 - timeElapsed)) { [weak self] in
                    self?.hide(animated: animated)
                }
                return
            }
        }
        
        // Stop animation
        activityIndicator.stopAnimating()
        isAnimating = false
        presentationDate = nil
        minimumPresentationWorkItem?.cancel()
        minimumPresentationWorkItem = nil
        
        // Hide with animation
        let hide = { [weak self] in
            self?.alpha = 0
        }
        
        let completion = { [weak self] (_: Bool) in
            self?.isHidden = true
        }
        
        if animated {
            UIView.animate(withDuration: 0.3, delay: 0, options: .beginFromCurrentState, animations: {
                hide()
            }, completion: completion)
        } else {
            hide()
            completion(true)
        }
        
        // Update accessibility
        UIAccessibility.post(notification: .screenChanged, argument: nil)
    }
    
    // MARK: - Override Methods
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        // Update colors for current theme
        containerView.backgroundColor = .systemBackground.withAlphaComponent(0.95)
        activityIndicator.color = .label
        messageLabel.textColor = .label
        
        // Update layout for RTL if needed
        if UIView.userInterfaceLayoutDirection(for: semanticContentAttribute) == .rightToLeft {
            messageLabel.textAlignment = .right
        } else {
            messageLabel.textAlignment = .center
        }
    }
}