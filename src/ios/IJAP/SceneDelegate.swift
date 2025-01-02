// UIKit v14.0+
import UIKit

/// SceneDelegate responsible for managing scene lifecycle, window setup, and state preservation
/// with enhanced security and state management capabilities.
@available(iOS 13.0, *)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    
    // MARK: - Properties
    
    /// Main application window with secure memory allocation
    private var window: UIWindow?
    
    /// Root coordinator for managing application flow and navigation
    private var appCoordinator: AppCoordinator?
    
    // MARK: - Scene Lifecycle
    
    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = (scene as? UIWindowScene) else { return }
        
        // Configure window with secure frame setup
        window = UIWindow(windowScene: windowScene)
        window?.overrideUserInterfaceStyle = .light
        
        // Configure window security settings
        window?.layer.allowsGroupOpacity = false
        window?.layer.allowsEdgeAntialiasing = true
        window?.layer.isOpaque = true
        
        // Initialize app coordinator with secure state management
        appCoordinator = AppCoordinator(window: window!)
        
        // Handle any deep links passed on launch
        if let urlContext = connectionOptions.urlContexts.first {
            appCoordinator?.handleDeepLink(urlContext.url)
        }
        
        // Start coordinator and make window visible
        appCoordinator?.start()
        window?.makeKeyAndVisible()
        
        // Configure scene security settings
        scene.title = Bundle.main.object(forInfoDictionaryKey: "CFBundleName") as? String
        windowScene.sizeRestrictions?.minimumSize = CGSize(width: 320, height: 480)
    }
    
    func sceneDidDisconnect(_ scene: UIScene) {
        // Perform secure cleanup
        appCoordinator?.preserveState("disconnected")
        
        // Clear sensitive data
        window?.rootViewController = nil
        window = nil
        appCoordinator = nil
        
        // Force memory cleanup
        autoreleasepool {
            NSURLCache.shared.removeAllCachedResponses()
        }
    }
    
    func sceneDidBecomeActive(_ scene: UIScene) {
        guard let appCoordinator = appCoordinator else { return }
        
        // Validate scene integrity
        if window?.rootViewController == nil {
            window?.rootViewController = appCoordinator.navigationController
        }
        
        // Restore secure application state
        appCoordinator.handleAuthenticationState()
        
        // Update UI state
        window?.overrideUserInterfaceStyle = .light
        window?.makeKeyAndVisible()
    }
    
    func sceneWillResignActive(_ scene: UIScene) {
        // Secure current application state
        appCoordinator?.preserveState("background")
        
        // Protect sensitive UI elements
        window?.resignKey()
        
        // Clear clipboard if it contains sensitive data
        if UIPasteboard.general.hasStrings {
            UIPasteboard.general.string = ""
        }
    }
    
    func sceneWillEnterForeground(_ scene: UIScene) {
        // Validate authentication session
        appCoordinator?.handleAuthenticationState()
        
        // Refresh security tokens if needed
        appCoordinator?.restoreState("foreground")
        
        // Update UI state
        window?.makeKeyAndVisible()
    }
    
    func sceneDidEnterBackground(_ scene: UIScene) {
        // Secure sensitive data
        appCoordinator?.preserveState("background")
        
        // Clear sensitive UI state
        window?.resignKey()
        
        // Prepare for background state
        if let windowScene = scene as? UIWindowScene {
            windowScene.title = ""
        }
    }
    
    // MARK: - State Restoration
    
    func stateRestorationActivity(for scene: UIScene) -> NSUserActivity? {
        // Create activity for state restoration
        let activity = NSUserActivity(activityType: "org.ijap.stateRestoration")
        activity.persistentIdentifier = scene.session.persistentIdentifier
        
        // Add state restoration data
        if let window = window {
            activity.addUserInfoEntries(from: [
                "windowFrame": NSStringFromCGRect(window.frame)
            ])
        }
        
        return activity
    }
    
    func scene(_ scene: UIScene, restoreInteractionStateWith stateRestorationActivity: NSUserActivity) {
        guard let windowFrame = stateRestorationActivity.userInfo?["windowFrame"] as? String,
              let frame = CGRectFromString(windowFrame) else { return }
        
        // Restore window frame
        window?.frame = frame
        
        // Restore application state
        appCoordinator?.restoreState("restored")
    }
}