// UIKit version: iOS 13.0+
import UIKit
// Combine version: iOS 13.0+
import Combine

/// Coordinator responsible for managing the donation flow navigation and screen transitions
/// with support for campaign-specific donations, multi-currency payments, and accessibility
@available(iOS 13.0, *)
public final class DonationCoordinator: Coordinator {
    
    // MARK: - Properties
    
    public let navigationController: UINavigationController
    public var childCoordinators: [Coordinator] = []
    
    private let selectedCampaign: Campaign?
    private let completionHandler: DonationCompletionHandler?
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    /// Initializes the donation coordinator with required dependencies
    /// - Parameters:
    ///   - navigationController: The navigation controller to manage view transitions
    ///   - campaign: Optional campaign for targeted donations
    ///   - completionHandler: Optional completion handler for donation flow
    public init(
        navigationController: UINavigationController,
        campaign: Campaign? = nil,
        completionHandler: DonationCompletionHandler? = nil
    ) {
        self.navigationController = navigationController
        self.selectedCampaign = campaign
        self.completionHandler = completionHandler
        
        // Configure navigation bar appearance
        navigationController.navigationBar.prefersLargeTitles = true
        navigationController.navigationBar.tintColor = .primary
    }
    
    // MARK: - Coordinator Methods
    
    public func start() {
        showDonationForm()
    }
    
    // MARK: - Private Methods
    
    private func showDonationForm() {
        // Create view model with dependencies
        let viewModel = DonationFormViewModel(
            donationService: DonationService.shared,
            associationId: selectedCampaign?.associationId ?? "",
            campaignId: selectedCampaign?.id
        )
        
        // Create and configure donation form view controller
        let donationFormVC = DonationFormViewController(viewModel: viewModel)
        donationFormVC.delegate = self
        
        // Configure campaign details if available
        if let campaign = selectedCampaign {
            donationFormVC.configureCampaign(campaign)
        }
        
        // Configure accessibility
        donationFormVC.accessibilityIdentifier = "DonationFormScreen"
        donationFormVC.navigationItem.accessibilityLabel = NSLocalizedString(
            "Make a Donation",
            comment: "Donation form screen title"
        )
        
        // Present view controller
        navigationController.pushViewController(donationFormVC, animated: true)
    }
    
    private func showDonationConfirmation(donationId: String) {
        // Create view model with dependencies
        let viewModel = DonationConfirmationViewModel(
            donationService: DonationService.shared,
            maxRetries: 3
        )
        
        // Create and configure confirmation view controller
        let confirmationVC = DonationConfirmationViewController(viewModel: viewModel)
        confirmationVC.delegate = self
        
        // Configure receipt handling
        confirmationVC.configureReceipt(donationId: donationId)
        
        // Configure accessibility
        confirmationVC.accessibilityIdentifier = "DonationConfirmationScreen"
        confirmationVC.navigationItem.accessibilityLabel = NSLocalizedString(
            "Donation Confirmation",
            comment: "Confirmation screen title"
        )
        
        // Configure navigation
        confirmationVC.navigationItem.hidesBackButton = true
        confirmationVC.navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .close,
            target: self,
            action: #selector(dismissFlow)
        )
        
        // Present view controller
        navigationController.pushViewController(confirmationVC, animated: true)
    }
    
    private func handleDonationError(_ error: Error) {
        let alert = UIAlertController(
            title: NSLocalizedString("Error", comment: "Error alert title"),
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(
            title: NSLocalizedString("Try Again", comment: "Retry button title"),
            style: .default,
            handler: { [weak self] _ in
                self?.navigationController.popViewController(animated: true)
            }
        ))
        
        alert.addAction(UIAlertAction(
            title: NSLocalizedString("Cancel", comment: "Cancel button title"),
            style: .cancel,
            handler: { [weak self] _ in
                self?.dismissFlow()
            }
        ))
        
        navigationController.present(alert, animated: true)
    }
    
    @objc private func dismissFlow() {
        completionHandler?(.cancelled)
        navigationController.dismiss(animated: true)
    }
}

// MARK: - DonationFormViewControllerDelegate

extension DonationCoordinator: DonationFormViewControllerDelegate {
    func donationFormDidComplete(with donationId: String) {
        showDonationConfirmation(donationId: donationId)
    }
    
    func donationFormDidFail(with error: Error) {
        handleDonationError(error)
    }
    
    func donationFormDidCancel() {
        dismissFlow()
    }
}

// MARK: - DonationConfirmationViewControllerDelegate

extension DonationCoordinator: DonationConfirmationViewControllerDelegate {
    func donationConfirmationDidComplete() {
        completionHandler?(.completed)
        navigationController.dismiss(animated: true)
    }
    
    func donationConfirmationDidFail(with error: Error) {
        handleDonationError(error)
    }
}

// MARK: - Supporting Types

public typealias DonationCompletionHandler = (DonationResult) -> Void

public enum DonationResult {
    case completed
    case cancelled
}