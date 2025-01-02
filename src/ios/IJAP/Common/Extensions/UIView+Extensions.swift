// UIKit version: iOS 13.0+
import UIKit

// Internal imports
@_implementationOnly import LoadingView

@available(iOS 13.0, *)
extension UIView {
    
    // MARK: - Layout Methods
    
    /// Adds multiple subviews to the view in a single call
    /// - Parameter views: Array of UIView instances to add as subviews
    public func addSubviews(_ views: [UIView]) {
        views.forEach { addSubview($0) }
    }
    
    /// Applies Material Design corner radius to specified corners of the view
    /// - Parameters:
    ///   - radius: Corner radius value (defaults to Material Design standard 8pt)
    ///   - corners: Specific corners to round (defaults to all corners)
    public func roundCorners(radius: CGFloat = 8, corners: CACornerMask = .all) {
        layer.cornerRadius = radius
        layer.maskedCorners = corners
        layer.masksToBounds = true
        
        if #available(iOS 13.0, *) {
            layer.cornerCurve = .continuous
        }
    }
    
    /// Adds a semantic color border with specified width to the view
    /// - Parameters:
    ///   - width: Border width
    ///   - color: Border color (uses semantic colors for dark mode support)
    public func addBorder(width: CGFloat, color: UIColor) {
        layer.borderWidth = width
        layer.borderColor = color.resolvedColor(with: traitCollection).cgColor
    }
    
    // MARK: - Animation Methods
    
    /// Fades in view using Material Design timing curve
    /// - Parameters:
    ///   - duration: Animation duration (defaults to 0.3s)
    ///   - completion: Optional completion handler
    public func fadeIn(duration: TimeInterval = 0.3, completion: (() -> Void)? = nil) {
        // Check for reduced motion preference
        let animationDuration = UIAccessibility.isReduceMotionEnabled ? 0.1 : duration
        
        UIView.animate(
            withDuration: animationDuration,
            delay: 0,
            options: [.curveEaseOut, .beginFromCurrentState],
            animations: { [weak self] in
                self?.alpha = 1
            },
            completion: { _ in
                completion?()
            }
        )
    }
    
    /// Fades out view using Material Design timing curve
    /// - Parameters:
    ///   - duration: Animation duration (defaults to 0.3s)
    ///   - completion: Optional completion handler
    public func fadeOut(duration: TimeInterval = 0.3, completion: (() -> Void)? = nil) {
        // Check for reduced motion preference
        let animationDuration = UIAccessibility.isReduceMotionEnabled ? 0.1 : duration
        
        UIView.animate(
            withDuration: animationDuration,
            delay: 0,
            options: [.curveEaseIn, .beginFromCurrentState],
            animations: { [weak self] in
                self?.alpha = 0
            },
            completion: { _ in
                completion?()
            }
        )
    }
    
    /// Performs shake animation for error feedback with haptic feedback
    public func shake() {
        // Skip animation if reduce motion is enabled
        guard !UIAccessibility.isReduceMotionEnabled else {
            // Provide haptic feedback only
            let generator = UINotificationFeedbackGenerator()
            generator.notificationOccurred(.error)
            return
        }
        
        // Determine direction based on layout
        let isRTL = UIView.userInterfaceLayoutDirection(for: semanticContentAttribute) == .rightToLeft
        let translationX: CGFloat = isRTL ? 8 : -8
        
        let animation = CAKeyframeAnimation(keyPath: "transform.translation.x")
        animation.timingFunction = CAMediaTimingFunction(name: .easeInEaseOut)
        animation.duration = 0.6
        animation.values = [0, translationX, -translationX/2, translationX/4, 0]
        
        // Add haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
        
        layer.add(animation, forKey: "shake")
    }
    
    // MARK: - Loading State Methods
    
    /// Shows loading indicator with RTL support
    public func showLoading() {
        // Create and configure loading view if needed
        let loadingView = LoadingView(frame: bounds)
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        
        // Add to view hierarchy
        addSubview(loadingView)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            loadingView.topAnchor.constraint(equalTo: safeAreaLayoutGuide.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: safeAreaLayoutGuide.bottomAnchor)
        ])
        
        // Show loading view with animation
        loadingView.show(animated: true)
    }
    
    /// Hides loading indicator with cleanup
    public func hideLoading() {
        // Find and remove loading view
        subviews.compactMap { $0 as? LoadingView }.forEach { loadingView in
            loadingView.hide(animated: true)
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                loadingView.removeFromSuperview()
            }
        }
    }
}

// MARK: - Helper Extensions

private extension CACornerMask {
    static let all: CACornerMask = [
        .layerMinXMinYCorner,
        .layerMaxXMinYCorner,
        .layerMinXMaxYCorner,
        .layerMaxXMaxYCorner
    ]
}