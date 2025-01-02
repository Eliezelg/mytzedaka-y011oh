import UIKit

/// Protocol defining the core requirements for implementing the coordinator pattern.
/// Provides centralized navigation management with support for hierarchical relationships,
/// deep linking, and state preservation.
///
/// Usage:
/// ```
/// class MainCoordinator: Coordinator {
///     var navigationController: UINavigationController
///     var childCoordinators: [Coordinator] = []
///     
///     init(navigationController: UINavigationController) {
///         self.navigationController = navigationController
///     }
///     
///     func start() {
///         // Implement navigation flow
///     }
/// }
/// ```
@available(iOS 13.0, *)
protocol Coordinator: AnyObject {
    
    /// The navigation controller used for managing view controller hierarchy and handling navigation transitions.
    /// Must be retained strongly by the implementing coordinator.
    var navigationController: UINavigationController { get }
    
    /// Array of child coordinators managed by this coordinator.
    /// Implements parent-child relationships for complex navigation flows and proper memory management.
    var childCoordinators: [Coordinator] { get set }
    
    /// Initiates the coordinator's flow and begins its navigation sequence.
    /// Responsible for initial view controller setup and any required state restoration.
    ///
    /// Implementation should:
    /// - Initialize and configure the initial view controller
    /// - Set up any required navigation bar appearance
    /// - Configure deep linking handlers if needed
    /// - Push or present the initial view controller
    /// - Set up any child coordinators if required
    /// - Handle state restoration if applicable
    func start()
}

extension Coordinator {
    /// Adds a child coordinator to the parent coordinator's hierarchy.
    /// - Parameter coordinator: The child coordinator to add
    func addChildCoordinator(_ coordinator: Coordinator) {
        childCoordinators.append(coordinator)
    }
    
    /// Removes a child coordinator from the parent coordinator's hierarchy.
    /// - Parameter coordinator: The child coordinator to remove
    func removeChildCoordinator(_ coordinator: Coordinator) {
        childCoordinators = childCoordinators.filter { $0 !== coordinator }
    }
    
    /// Removes all child coordinators from the hierarchy.
    func removeAllChildCoordinators() {
        childCoordinators.removeAll()
    }
}