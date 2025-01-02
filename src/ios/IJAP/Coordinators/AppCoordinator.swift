// UIKit v14.0+
import UIKit
import Combine
import LocalAuthentication

/// Root coordinator responsible for managing the entire application's navigation flow
/// with enhanced state management, biometric support, and analytics tracking
@available(iOS 14.0, *)
final class AppCoordinator: Coordinator {
    
    // MARK: - Properties
    
    var navigationController: UINavigationController
    var childCoordinators: [Coordinator] = []
    private let window: UIWindow
    private var subscriptions = Set<AnyCancellable>()
    
    // State Management
    private let authEventSubject = PassthroughSubject<AuthEvent, Never>()
    private let appStateSubject = CurrentValueSubject<AppState, Never>(.initializing)
    private let stateRestorationKey = "AppCoordinatorState"
    
    // Biometric Support
    private let biometricContext = LAContext()
    
    // MARK: - Types
    
    private enum AppState {
        case initializing
        case unauthenticated
        case authenticating
        case authenticated
        case error(Error)
    }
    
    private enum AuthEvent {
        case login
        case logout
        case biometricSuccess
        case biometricFailure(Error)
    }
    
    // MARK: - Initialization
    
    /// Initializes the app coordinator with a window instance
    /// - Parameter window: The main application window
    init(window: UIWindow) {
        self.window = window
        
        // Configure navigation controller with appearance
        let appearance = UINavigationBarAppearance()
        appearance.configureWithOpaqueBackground()
        
        self.navigationController = UINavigationController()
        self.navigationController.navigationBar.standardAppearance = appearance
        self.navigationController.navigationBar.scrollEdgeAppearance = appearance
        
        // Set as root view controller
        window.rootViewController = navigationController
        window.makeKeyAndVisible()
        
        setupStateManagement()
    }
    
    // MARK: - Coordinator Protocol
    
    func start() {
        // Check for saved state
        if let savedState = UserDefaults.standard.string(forKey: stateRestorationKey) {
            handleSavedState(savedState)
        } else {
            appStateSubject.send(.unauthenticated)
        }
        
        // Configure state observation
        setupStateObservation()
        
        // Configure deep link handling
        setupDeepLinkHandling()
        
        // Start analytics tracking
        trackAppStart()
    }
    
    // MARK: - Flow Management
    
    private func showAuthFlow() {
        let authCoordinator = AuthCoordinator(
            window: window,
            navigationController: navigationController
        )
        
        addChildCoordinator(authCoordinator)
        
        // Handle auth completion
        authCoordinator.authEventSubject
            .sink { [weak self] event in
                switch event {
                case .login:
                    self?.handleSuccessfulAuth()
                case .biometricSuccess:
                    self?.showMainFlow()
                case .biometricFailure(let error):
                    self?.handleAuthError(error)
                case .logout:
                    self?.handleLogout()
                }
            }
            .store(in: &subscriptions)
        
        authCoordinator.start()
        
        // Track auth flow start
        AnalyticsManager.shared.trackEvent("auth_flow_started")
    }
    
    private func showMainFlow() {
        let mainCoordinator = MainCoordinator(
            navigationController: navigationController,
            logoutHandler: { [weak self] in
                self?.handleLogout()
            },
            stateRestorationHandler: { [weak self] state in
                self?.saveState(state)
            },
            deepLinkHandler: { [weak self] url in
                self?.handleDeepLink(url) ?? false
            }
        )
        
        addChildCoordinator(mainCoordinator)
        mainCoordinator.start()
        
        // Restore previous state if available
        if let savedState = UserDefaults.standard.string(forKey: stateRestorationKey) {
            mainCoordinator.restoreState(savedState)
        }
        
        // Track main flow start
        AnalyticsManager.shared.trackEvent("main_flow_started")
    }
    
    // MARK: - State Management
    
    private func setupStateManagement() {
        appStateSubject
            .sink { [weak self] state in
                self?.handleStateChange(state)
            }
            .store(in: &subscriptions)
    }
    
    private func setupStateObservation() {
        NotificationCenter.default.publisher(for: .authenticationStateChanged)
            .sink { [weak self] _ in
                self?.validateAuthenticationState()
            }
            .store(in: &subscriptions)
    }
    
    private func handleStateChange(_ state: AppState) {
        switch state {
        case .initializing:
            // Initial app setup
            break
        case .unauthenticated:
            showAuthFlow()
        case .authenticating:
            // Show loading state
            break
        case .authenticated:
            showMainFlow()
        case .error(let error):
            handleError(error)
        }
    }
    
    // MARK: - Deep Link Handling
    
    private func setupDeepLinkHandling() {
        NotificationCenter.default.publisher(for: .handleDeepLink)
            .compactMap { $0.object as? URL }
            .sink { [weak self] url in
                self?.handleDeepLink(url)
            }
            .store(in: &subscriptions)
    }
    
    @discardableResult
    func handleDeepLink(_ url: URL) -> Bool {
        guard let currentMainCoordinator = childCoordinators.first(where: { $0 is MainCoordinator }) as? MainCoordinator else {
            // Cache deep link for later handling
            return false
        }
        
        return currentMainCoordinator.handleDeepLink(url)
    }
    
    // MARK: - Helper Methods
    
    private func handleSuccessfulAuth() {
        appStateSubject.send(.authenticated)
        saveState("authenticated")
    }
    
    private func handleLogout() {
        // Clear state and subscriptions
        UserDefaults.standard.removeObject(forKey: stateRestorationKey)
        subscriptions.removeAll()
        
        // Remove child coordinators
        removeAllChildCoordinators()
        
        // Reset state
        appStateSubject.send(.unauthenticated)
        
        // Track logout
        AnalyticsManager.shared.trackEvent("user_logged_out")
    }
    
    private func handleError(_ error: Error) {
        // Log error
        print("AppCoordinator error: \(error.localizedDescription)")
        
        // Track error
        AnalyticsManager.shared.trackError(error)
        
        // Show error UI
        // Implementation depends on error handling strategy
    }
    
    private func saveState(_ state: String) {
        UserDefaults.standard.set(state, forKey: stateRestorationKey)
    }
    
    private func handleSavedState(_ state: String) {
        if state == "authenticated" {
            appStateSubject.send(.authenticated)
        } else {
            appStateSubject.send(.unauthenticated)
        }
    }
    
    private func validateAuthenticationState() {
        // Implement authentication state validation logic
        // This could include token validation, biometric checks, etc.
    }
    
    private func trackAppStart() {
        AnalyticsManager.shared.trackEvent(
            "app_started",
            parameters: [
                "version": AppInfo.version,
                "build": AppInfo.build
            ]
        )
    }
}