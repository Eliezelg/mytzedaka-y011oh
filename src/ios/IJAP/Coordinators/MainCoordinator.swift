// UIKit v14.0+
import UIKit
import Combine

/// Main coordinator responsible for managing the application flow after authentication
/// Handles tab-based navigation, deep linking, state preservation, and analytics tracking
@available(iOS 13.0, *)
final class MainCoordinator: Coordinator {
    
    // MARK: - Properties
    var navigationController: UINavigationController
    var childCoordinators: [Coordinator] = []
    private var tabBarController: MainTabBarController
    private var logoutHandler: (() -> Void)?
    private var stateRestorationHandler: StateRestorationHandler
    private var deepLinkHandler: DeepLinkHandler
    private var subscriptions = Set<AnyCancellable>()
    
    // MARK: - Types
    typealias StateRestorationHandler = (String) -> Void
    typealias DeepLinkHandler = (URL) -> Bool
    
    // MARK: - Initialization
    init(
        navigationController: UINavigationController,
        logoutHandler: (() -> Void)? = nil,
        stateRestorationHandler: @escaping StateRestorationHandler,
        deepLinkHandler: @escaping DeepLinkHandler
    ) {
        self.navigationController = navigationController
        self.logoutHandler = logoutHandler
        self.stateRestorationHandler = stateRestorationHandler
        self.deepLinkHandler = deepLinkHandler
        self.tabBarController = MainTabBarController()
        
        setupTabBarController()
    }
    
    // MARK: - Coordinator Methods
    func start() {
        // Configure navigation controller
        navigationController.setNavigationBarHidden(true, animated: false)
        navigationController.viewControllers = [tabBarController]
        
        // Initialize child coordinators for each tab
        setupChildCoordinators()
        
        // Start child coordinators
        childCoordinators.forEach { $0.start() }
        
        // Configure state restoration
        configureStateRestoration()
        
        // Set up deep link handling
        setupDeepLinkHandling()
    }
    
    // MARK: - Setup Methods
    private func setupTabBarController() {
        // Configure tab bar appearance
        if #available(iOS 15.0, *) {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            tabBarController.tabBar.standardAppearance = appearance
            tabBarController.tabBar.scrollEdgeAppearance = appearance
        }
        
        // Set restoration identifier for state preservation
        tabBarController.restorationIdentifier = Constants.NavigationKeys.mainTabBar
    }
    
    private func setupChildCoordinators() {
        // Create child coordinators for each tab
        let homeCoordinator = HomeCoordinator(navigationController: UINavigationController())
        let campaignsCoordinator = CampaignsCoordinator(navigationController: UINavigationController())
        let donationsCoordinator = DonationsCoordinator(navigationController: UINavigationController())
        let profileCoordinator = ProfileCoordinator(
            navigationController: UINavigationController(),
            logoutHandler: { [weak self] in
                self?.handleLogout()
            }
        )
        
        // Add child coordinators
        addChildCoordinator(homeCoordinator)
        addChildCoordinator(campaignsCoordinator)
        addChildCoordinator(donationsCoordinator)
        addChildCoordinator(profileCoordinator)
        
        // Configure tab bar view controllers
        tabBarController.viewControllers = [
            homeCoordinator.navigationController,
            campaignsCoordinator.navigationController,
            donationsCoordinator.navigationController,
            profileCoordinator.navigationController
        ]
    }
    
    private func configureStateRestoration() {
        // Set up state restoration handler
        tabBarController.tabBar.items?.enumerated().forEach { index, item in
            item.restorationIdentifier = "Tab\(index)"
        }
        
        // Observe tab selection for state preservation
        NotificationCenter.default.publisher(for: UITabBarController.didSelectViewController)
            .sink { [weak self] notification in
                guard let tabBarController = notification.object as? UITabBarController else { return }
                self?.stateRestorationHandler("Tab\(tabBarController.selectedIndex)")
            }
            .store(in: &subscriptions)
    }
    
    private func setupDeepLinkHandling() {
        // Set up notification observer for deep links
        NotificationCenter.default.publisher(for: .handleDeepLink)
            .compactMap { $0.object as? URL }
            .sink { [weak self] url in
                self?.handleDeepLink(url)
            }
            .store(in: &subscriptions)
    }
    
    // MARK: - Deep Link Handling
    func handleDeepLink(_ url: URL) -> Bool {
        guard let components = URLComponents(url: url, resolvingAgainstBaseURL: true),
              let host = components.host else {
            return false
        }
        
        // Parse deep link parameters
        let queryItems = components.queryItems ?? []
        let parameters = Dictionary(
            uniqueKeysWithValues: queryItems.map { ($0.name, $0.value ?? "") }
        )
        
        // Handle different deep link types
        switch host {
        case "campaign":
            guard let campaignId = parameters["id"] else { return false }
            return navigateToCampaign(campaignId)
            
        case "donation":
            guard let donationId = parameters["id"] else { return false }
            return navigateToDonation(donationId)
            
        case "profile":
            return navigateToProfile()
            
        default:
            return false
        }
    }
    
    // MARK: - Navigation Methods
    private func navigateToCampaign(_ campaignId: String) -> Bool {
        tabBarController.selectedIndex = 1 // Campaigns tab
        guard let campaignsNav = tabBarController.selectedViewController as? UINavigationController,
              let campaignsCoordinator = childCoordinators[1] as? CampaignsCoordinator else {
            return false
        }
        
        campaignsCoordinator.showCampaign(withId: campaignId)
        return true
    }
    
    private func navigateToDonation(_ donationId: String) -> Bool {
        tabBarController.selectedIndex = 2 // Donations tab
        guard let donationsNav = tabBarController.selectedViewController as? UINavigationController,
              let donationsCoordinator = childCoordinators[2] as? DonationsCoordinator else {
            return false
        }
        
        donationsCoordinator.showDonation(withId: donationId)
        return true
    }
    
    private func navigateToProfile() -> Bool {
        tabBarController.selectedIndex = 3 // Profile tab
        return true
    }
    
    // MARK: - Logout Handling
    func handleLogout() {
        // Clean up state and subscriptions
        subscriptions.forEach { $0.cancel() }
        subscriptions.removeAll()
        
        // Remove child coordinators
        removeAllChildCoordinators()
        
        // Execute logout handler
        logoutHandler?()
    }
}