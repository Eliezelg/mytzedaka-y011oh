// UIKit v14.0+
import UIKit

/// Main application delegate responsible for managing application lifecycle and scene configuration
/// Implements coordinator pattern for navigation management and supports multi-window functionality
@main
@available(iOS 13.0, *)
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    // MARK: - Properties
    
    /// Main application window for legacy support (pre-iOS 13)
    private var window: UIWindow?
    
    /// Root coordinator managing application navigation flow
    private var coordinator: AppCoordinator?
    
    // MARK: - UIApplicationDelegate
    
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        // Configure appearance
        configureGlobalAppearance()
        
        // Configure analytics
        configureAnalytics()
        
        // Configure legacy window support (pre-iOS 13)
        if #available(iOS 13.0, *) {
            // Scene-based lifecycle is used
        } else {
            window = UIWindow(frame: UIScreen.main.bounds)
            coordinator = AppCoordinator(window: window!)
            coordinator?.start()
        }
        
        return true
    }
    
    // MARK: - UISceneSession Lifecycle
    
    func application(
        _ application: UIApplication,
        configurationForConnecting connectingSceneSession: UISceneSession,
        options: UIScene.ConnectionOptions
    ) -> UISceneConfiguration {
        // Create scene configuration for the application
        let configuration = UISceneConfiguration(
            name: "Default Configuration",
            sessionRole: connectingSceneSession.role
        )
        
        // Set scene delegate class
        configuration.delegateClass = SceneDelegate.self
        
        // Configure scene-specific settings
        if connectingSceneSession.role == .windowApplication {
            configuration.sceneClass = UIWindowScene.self
        }
        
        return configuration
    }
    
    func application(
        _ application: UIApplication,
        didDiscardSceneSessions sceneSessions: Set<UISceneSession>
    ) {
        // Clean up resources when scenes are discarded
        sceneSessions.forEach { session in
            // Clear cached data for discarded scenes
            clearCachedData(for: session)
            
            // Remove associated coordinator instances
            if let userInfo = session.stateRestorationActivity?.userInfo,
               let coordinatorId = userInfo["coordinatorId"] as? String {
                removeCoordinator(with: coordinatorId)
            }
        }
    }
    
    // MARK: - Private Methods
    
    /// Configures global appearance settings for the application
    private func configureGlobalAppearance() {
        if #available(iOS 15.0, *) {
            // Configure navigation bar appearance
            let navigationBarAppearance = UINavigationBarAppearance()
            navigationBarAppearance.configureWithOpaqueBackground()
            UINavigationBar.appearance().standardAppearance = navigationBarAppearance
            UINavigationBar.appearance().scrollEdgeAppearance = navigationBarAppearance
            
            // Configure tab bar appearance
            let tabBarAppearance = UITabBarAppearance()
            tabBarAppearance.configureWithOpaqueBackground()
            UITabBar.appearance().standardAppearance = tabBarAppearance
            UITabBar.appearance().scrollEdgeAppearance = tabBarAppearance
        }
        
        // Configure RTL support based on localization
        if LocalizationKeys.rtlLanguages.contains(
            LocalizationKeys.Language(rawValue: Locale.current.languageCode ?? "") ?? .english
        ) {
            UIView.appearance().semanticContentAttribute = .forceRightToLeft
        }
    }
    
    /// Configures analytics tracking for the application
    private func configureAnalytics() {
        // Track app launch
        AnalyticsManager.shared.trackEvent(
            "app_launched",
            parameters: [
                "version": AppInfo.version,
                "build": AppInfo.build,
                "device_type": UIDevice.current.model,
                "os_version": UIDevice.current.systemVersion
            ]
        )
    }
    
    /// Clears cached data for a discarded scene session
    /// - Parameter session: The discarded UISceneSession
    private func clearCachedData(for session: UISceneSession) {
        guard let sessionId = session.persistentIdentifier else { return }
        
        // Clear scene-specific user defaults
        if let bundleId = Bundle.main.bundleIdentifier {
            UserDefaults.standard.removePersistentDomain(forName: "\(bundleId).\(sessionId)")
        }
        
        // Clear scene-specific cached files
        if let cachePath = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
            try? FileManager.default.removeItem(at: cachePath.appendingPathComponent(sessionId))
        }
    }
    
    /// Removes coordinator associated with a scene
    /// - Parameter coordinatorId: Unique identifier for the coordinator
    private func removeCoordinator(with coordinatorId: String) {
        // Implementation depends on coordinator management strategy
        coordinator?.childCoordinators.removeAll { coordinator in
            // Remove coordinator based on identifier
            return false // Placeholder implementation
        }
    }
}