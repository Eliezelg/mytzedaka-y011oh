// UIKit v14.0+
import UIKit
import Constants

@available(iOS 13.0, *)
class MainTabBarController: UITabBarController {
    
    // MARK: - Properties
    private var selectedTintColor: UIColor = .systemBlue
    private var unselectedTintColor: UIColor = .systemGray
    private var isRTLEnabled: Bool = false
    private var currentStyle: UIUserInterfaceStyle = .light
    private var tabBarHeightConstraint: NSLayoutConstraint?
    
    // MARK: - Lifecycle
    override init(nibName nibNameOrNil: String?, bundle nibBundleOrNil: Bundle?) {
        super.init(nibName: nibNameOrNil, bundle: nibBundleOrNil)
        setupInitialConfiguration()
    }
    
    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setupInitialConfiguration()
    }
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        setupTabBarItems()
        configureAppearance()
        setupAccessibility()
        setupObservers()
    }
    
    // MARK: - Setup Methods
    private func setupInitialConfiguration() {
        isRTLEnabled = UIApplication.shared.userInterfaceLayoutDirection == .rightToLeft
        currentStyle = traitCollection.userInterfaceStyle
        delegate = self
    }
    
    private func setupTabBarItems() {
        let homeVC = UINavigationController(rootViewController: HomeViewController())
        let campaignsVC = UINavigationController(rootViewController: CampaignsViewController())
        let donationsVC = UINavigationController(rootViewController: DonationsViewController())
        let profileVC = UINavigationController(rootViewController: ProfileViewController())
        
        // Configure home tab
        homeVC.tabBarItem = UITabBarItem(
            title: NSLocalizedString("tab_home", comment: "Home tab"),
            image: UIImage(systemName: "house"),
            selectedImage: UIImage(systemName: "house.fill")
        )
        
        // Configure campaigns tab
        campaignsVC.tabBarItem = UITabBarItem(
            title: NSLocalizedString("tab_campaigns", comment: "Campaigns tab"),
            image: UIImage(systemName: "heart"),
            selectedImage: UIImage(systemName: "heart.fill")
        )
        
        // Configure donations tab
        donationsVC.tabBarItem = UITabBarItem(
            title: NSLocalizedString("tab_donations", comment: "Donations tab"),
            image: UIImage(systemName: "creditcard"),
            selectedImage: UIImage(systemName: "creditcard.fill")
        )
        
        // Configure profile tab
        profileVC.tabBarItem = UITabBarItem(
            title: NSLocalizedString("tab_profile", comment: "Profile tab"),
            image: UIImage(systemName: "person"),
            selectedImage: UIImage(systemName: "person.fill")
        )
        
        viewControllers = [homeVC, campaignsVC, donationsVC, profileVC]
        
        // Configure RTL layout if needed
        if isRTLEnabled {
            viewControllers = viewControllers?.reversed()
        }
    }
    
    private func configureAppearance() {
        if #available(iOS 15.0, *) {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = .systemBackground
            
            appearance.stackedLayoutAppearance.normal.titleTextAttributes = [
                .foregroundColor: unselectedTintColor,
                .font: UIFont.preferredFont(forTextStyle: .caption1)
            ]
            
            appearance.stackedLayoutAppearance.selected.titleTextAttributes = [
                .foregroundColor: selectedTintColor,
                .font: UIFont.preferredFont(forTextStyle: .caption1)
            ]
            
            tabBar.standardAppearance = appearance
            tabBar.scrollEdgeAppearance = appearance
        } else {
            tabBar.barTintColor = .systemBackground
            tabBar.tintColor = selectedTintColor
            tabBar.unselectedItemTintColor = unselectedTintColor
        }
        
        tabBar.isTranslucent = true
        updateTabBarHeight()
    }
    
    private func setupAccessibility() {
        tabBar.items?.forEach { item in
            item.accessibilityLabel = item.title
            item.accessibilityTraits = .tabBar
            item.accessibilityHint = NSLocalizedString(
                "accessibility_tab_hint",
                comment: "Double tap to switch to this tab"
            )
        }
    }
    
    private func setupObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleContentSizeCategoryChange),
            name: UIContentSizeCategory.didChangeNotification,
            object: nil
        )
    }
    
    // MARK: - Helper Methods
    private func updateTabBarHeight() {
        let defaultHeight: CGFloat = 49
        let bottomSafeArea = view.safeAreaInsets.bottom
        
        tabBarHeightConstraint?.isActive = false
        tabBarHeightConstraint = tabBar.heightAnchor.constraint(
            equalToConstant: defaultHeight + bottomSafeArea
        )
        tabBarHeightConstraint?.isActive = true
    }
    
    @objc private func handleContentSizeCategoryChange() {
        configureAppearance()
        setupAccessibility()
    }
    
    // MARK: - Trait Collection
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.userInterfaceStyle != previousTraitCollection?.userInterfaceStyle {
            currentStyle = traitCollection.userInterfaceStyle
            configureAppearance()
        }
        
        if traitCollection.preferredContentSizeCategory != previousTraitCollection?.preferredContentSizeCategory {
            handleContentSizeCategoryChange()
        }
    }
}

// MARK: - UITabBarControllerDelegate
extension MainTabBarController: UITabBarControllerDelegate {
    func tabBarController(_ tabBarController: UITabBarController, shouldSelect viewController: UIViewController) -> Bool {
        // Add any tab selection validation logic here
        return true
    }
    
    func tabBarController(_ tabBarController: UITabBarController, didSelect viewController: UIViewController) {
        // Handle tab selection analytics or other tracking
        let tabIndex = tabBarController.selectedIndex
        let tabName = tabBar.items?[tabIndex].title ?? ""
        
        // Example analytics tracking
        AnalyticsManager.shared.trackEvent(
            "tab_selected",
            parameters: ["tab_name": tabName, "tab_index": tabIndex]
        )
    }
}