// Foundation v13.0+
import Foundation
// UIKit v13.0+
import UIKit
// Combine v13.0+
import Combine
// MaterialComponents v124.2.0
import MaterialComponents

/// View controller responsible for displaying and managing user's donation history
/// with enhanced accessibility, RTL support, and Material Design compliance
@available(iOS 13.0, *)
public class DonationHistoryViewController: UIViewController {
    
    // MARK: - UI Components
    
    private lazy var tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .grouped)
        table.translatesAutoresizingMaskIntoConstraints = false
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 120
        table.separatorStyle = .none
        table.backgroundColor = .systemBackground
        table.registerCell(DonationHistoryCell.self)
        table.delegate = self
        table.dataSource = self
        return table
    }()
    
    private lazy var emptyStateView: EmptyStateView = {
        let view = EmptyStateView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()
    
    private lazy var loadingView: MDCActivityIndicator = {
        let indicator = MDCActivityIndicator()
        indicator.translatesAutoresizingMaskIntoConstraints = false
        indicator.cycleColors = [.systemBlue]
        indicator.radius = 24.0
        indicator.strokeWidth = 3.0
        return indicator
    }()
    
    private lazy var refreshControl: UIRefreshControl = {
        let control = UIRefreshControl()
        control.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        return control
    }()
    
    // MARK: - Properties
    
    private let viewModel: DonationHistoryViewModel
    private var cancellables = Set<AnyCancellable>()
    private let networkMonitor = NetworkMonitor.shared
    private let hapticGenerator = UISelectionFeedbackGenerator()
    
    // Material Design Configuration
    private let typographyScheme = MDCTypographyScheme()
    private let containerScheme = MDCContainerScheme()
    
    // MARK: - Initialization
    
    public init(viewModel: DonationHistoryViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    public override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupBindings()
        configureAccessibility()
        
        // Start loading donations
        viewModel.transform(input: createInput())
    }
    
    public override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationItem.largeTitleDisplayMode = .always
        hapticGenerator.prepare()
    }
    
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        updateThemeForCurrentTraitCollection()
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Configure navigation
        title = NSLocalizedString("donation_history.title", comment: "Donation History")
        navigationController?.navigationBar.prefersLargeTitles = true
        
        // Configure view
        view.backgroundColor = .systemBackground
        
        // Add subviews
        view.addSubview(tableView)
        view.addSubview(emptyStateView)
        view.addSubview(loadingView)
        
        // Configure refresh control
        tableView.refreshControl = refreshControl
        
        // Setup constraints with RTL support
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            emptyStateView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            emptyStateView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            emptyStateView.widthAnchor.constraint(equalTo: view.widthAnchor, multiplier: 0.8),
            
            loadingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        // Apply Material Design styling
        applyMaterialDesign()
    }
    
    private func setupBindings() {
        // Bind donations data
        viewModel.output.donations
            .receive(on: DispatchQueue.main)
            .sink { [weak self] donations in
                self?.updateUI(with: donations)
            }
            .store(in: &cancellables)
        
        // Bind loading state
        viewModel.output.loadingState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleLoadingState(state)
            }
            .store(in: &cancellables)
        
        // Bind error handling
        viewModel.output.error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
        
        // Bind network status
        networkMonitor.isConnected
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isConnected in
                self?.handleNetworkStatus(isConnected)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Private Methods
    
    private func createInput() -> DonationHistoryViewModel.DonationHistoryInput {
        let actionSubject = PassthroughSubject<DonationHistoryViewModel.DonationHistoryAction, Never>()
        let cancellationSubject = PassthroughSubject<Void, Never>()
        
        return DonationHistoryViewModel.DonationHistoryInput(
            action: actionSubject.eraseToAnyPublisher(),
            cancellationToken: cancellationSubject.eraseToAnyPublisher()
        )
    }
    
    private func updateUI(with donations: [Donation]) {
        emptyStateView.isHidden = !donations.isEmpty
        tableView.reloadData()
        
        // Announce updates for VoiceOver
        if !donations.isEmpty {
            UIAccessibility.post(notification: .layoutChanged, argument: NSLocalizedString(
                "donation_history.updated",
                comment: "Donation history updated"
            ))
        }
    }
    
    private func handleLoadingState(_ state: DonationHistoryViewModel.LoadingState) {
        switch state {
        case .loading:
            loadingView.startAnimating()
        case .refreshing:
            refreshControl.beginRefreshing()
        case .idle:
            loadingView.stopAnimating()
            refreshControl.endRefreshing()
        case .error(let message):
            showError(message)
        }
    }
    
    private func handleError(_ error: LocalizedError?) {
        guard let error = error else { return }
        
        let alert = MDCAlertController(title: error.errorDescription,
                                     message: error.recoverySuggestion)
        
        let action = MDCAlertAction(title: "OK") { [weak self] _ in
            self?.hapticGenerator.selectionChanged()
        }
        
        alert.addAction(action)
        alert.applyTheme(withScheme: containerScheme)
        
        present(alert, animated: true)
    }
    
    private func handleNetworkStatus(_ isConnected: Bool) {
        if !isConnected {
            showOfflineBanner()
        }
    }
    
    @objc private func handleRefresh() {
        hapticGenerator.selectionChanged()
        viewModel.refreshDonations()
    }
    
    // MARK: - Accessibility
    
    private func configureAccessibility() {
        tableView.accessibilityLabel = NSLocalizedString(
            "donation_history.table.accessibility_label",
            comment: "Donation history list"
        )
        
        emptyStateView.accessibilityLabel = NSLocalizedString(
            "donation_history.empty.accessibility_label",
            comment: "No donations found"
        )
        
        // Configure dynamic type support
        tableView.cellLayoutMarginsFollowReadableWidth = true
    }
    
    // MARK: - Material Design
    
    private func applyMaterialDesign() {
        // Apply typography scheme
        typographyScheme.headline1 = UIFont.preferredFont(forTextStyle: .title1)
        typographyScheme.body1 = UIFont.preferredFont(forTextStyle: .body)
        
        // Configure container scheme
        containerScheme.typographyScheme = typographyScheme
        
        // Apply to navigation bar
        navigationController?.navigationBar.applySurfaceTheme(withScheme: containerScheme)
    }
    
    private func updateThemeForCurrentTraitCollection() {
        if traitCollection.userInterfaceStyle == .dark {
            containerScheme.colorScheme = MDCSemanticColorScheme(defaults: .material201907, traitCollection: traitCollection)
        } else {
            containerScheme.colorScheme = MDCSemanticColorScheme(defaults: .material201907, traitCollection: traitCollection)
        }
        applyMaterialDesign()
    }
}

// MARK: - UITableViewDataSource

extension DonationHistoryViewController: UITableViewDataSource {
    public func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return viewModel.output.donations.value.count
    }
    
    public func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(DonationHistoryCell.self, for: indexPath)
        let donation = viewModel.output.donations.value[indexPath.row]
        cell.configure(with: donation, containerScheme: containerScheme)
        return cell
    }
}

// MARK: - UITableViewDelegate

extension DonationHistoryViewController: UITableViewDelegate {
    public func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        hapticGenerator.selectionChanged()
        
        let donation = viewModel.output.donations.value[indexPath.row]
        // Handle donation selection
    }
    
    public func tableView(_ tableView: UITableView, trailingSwipeActionsConfigurationForRowAt indexPath: IndexPath) -> UISwipeActionsConfiguration? {
        let donation = viewModel.output.donations.value[indexPath.row]
        
        if donation.isRecurring {
            let cancelAction = UIContextualAction(style: .destructive, title: "Cancel") { [weak self] _, _, completion in
                self?.viewModel.cancelRecurringDonation(donation.id)
                completion(true)
            }
            
            cancelAction.backgroundColor = .systemRed
            return UISwipeActionsConfiguration(actions: [cancelAction])
        }
        
        return nil
    }
    
    public func scrollViewDidScroll(_ scrollView: UIScrollView) {
        // Implement infinite scrolling if needed
    }
}