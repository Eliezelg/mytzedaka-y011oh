// UIKit version: iOS 13.0+
import UIKit
import Combine

@available(iOS 13.0, *)
final class AssociationsListViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: AssociationsListViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private lazy var tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .plain)
        table.translatesAutoresizingMaskIntoConstraints = false
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 120
        table.separatorStyle = .none
        table.backgroundColor = .background
        table.registerCell(AssociationCell.self)
        table.delegate = self
        table.dataSource = self
        return table
    }()
    
    private lazy var searchController: UISearchController = {
        let controller = UISearchController(searchResultsController: nil)
        controller.searchResultsUpdater = self
        controller.obscuresBackgroundDuringPresentation = false
        controller.searchBar.placeholder = NSLocalizedString("Search Associations", comment: "Search bar placeholder")
        return controller
    }()
    
    private lazy var loadingView: LoadingView = {
        let view = LoadingView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var emptyStateView: EmptyStateView = {
        let view = EmptyStateView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var refreshControl: UIRefreshControl = {
        let control = UIRefreshControl()
        control.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        return control
    }()
    
    private lazy var offlineIndicator: UIBarButtonItem = {
        let button = UIBarButtonItem(
            image: UIImage(systemName: "wifi.slash"),
            style: .plain,
            target: nil,
            action: nil
        )
        button.tintColor = .warning
        return button
    }()
    
    // MARK: - Initialization
    
    init(viewModel: AssociationsListViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        bindViewModel()
        configureAccessibility()
        
        // Initial data load
        viewModel.transform(input: .loadTrigger(Just(()).eraseToAnyPublisher()))
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        updateForLocalization()
    }
    
    override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.layoutDirection != previousTraitCollection?.layoutDirection {
            updateForRTL()
        }
        
        if traitCollection.preferredContentSizeCategory != previousTraitCollection?.preferredContentSizeCategory {
            updateForDynamicType()
        }
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Configure view
        view.backgroundColor = .background
        
        // Configure navigation
        navigationItem.searchController = searchController
        navigationItem.hidesSearchBarWhenScrolling = false
        
        // Add subviews
        view.addSubviews([tableView, loadingView, emptyStateView])
        tableView.refreshControl = refreshControl
        
        // Setup constraints
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            emptyStateView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            emptyStateView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            emptyStateView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
        
        updateForRTL()
    }
    
    // MARK: - View Model Binding
    
    private func bindViewModel() {
        // Loading state binding
        viewModel.transform(input: .loadTrigger(Just(()).eraseToAnyPublisher()))
            .loading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                if isLoading {
                    self?.loadingView.show(
                        message: NSLocalizedString("Loading Associations", comment: "Loading message"),
                        animated: true
                    )
                } else {
                    self?.loadingView.hide(animated: true)
                    self?.refreshControl.endRefreshing()
                }
            }
            .store(in: &cancellables)
        
        // Associations binding
        viewModel.transform(input: .loadTrigger(Just(()).eraseToAnyPublisher()))
            .associations
            .receive(on: DispatchQueue.main)
            .sink { [weak self] associations in
                self?.handleAssociationsUpdate(associations)
            }
            .store(in: &cancellables)
        
        // Error binding
        viewModel.transform(input: .loadTrigger(Just(()).eraseToAnyPublisher()))
            .error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
        
        // Offline state binding
        viewModel.transform(input: .loadTrigger(Just(()).eraseToAnyPublisher()))
            .syncState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleSyncState(state)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Private Methods
    
    private func handleAssociationsUpdate(_ associations: [Association]) {
        tableView.reloadData()
        
        if associations.isEmpty {
            showEmptyState()
        } else {
            emptyStateView.isHidden = true
        }
    }
    
    private func handleError(_ error: Error?) {
        guard let error = error else { return }
        
        let alert = UIAlertController(
            title: NSLocalizedString("Error", comment: "Error alert title"),
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(
            title: NSLocalizedString("Retry", comment: "Retry button title"),
            style: .default,
            handler: { [weak self] _ in
                self?.viewModel.transform(input: .loadTrigger(Just(()).eraseToAnyPublisher()))
            }
        ))
        
        present(alert, animated: true)
    }
    
    private func handleSyncState(_ state: AssociationsListViewModel.SyncState) {
        switch state {
        case .synced:
            navigationItem.rightBarButtonItem = nil
        case .needsSync, .error:
            navigationItem.rightBarButtonItem = offlineIndicator
        case .syncing:
            break
        }
    }
    
    private func showEmptyState() {
        emptyStateView.configure(
            image: UIImage(systemName: "building.2"),
            title: NSLocalizedString("No Associations Found", comment: "Empty state title"),
            message: NSLocalizedString("There are no associations available at the moment.", comment: "Empty state message"),
            shouldMirrorImage: true
        )
        emptyStateView.isHidden = false
    }
    
    @objc private func handleRefresh() {
        viewModel.transform(input: .refreshTrigger(Just(()).eraseToAnyPublisher()))
    }
    
    // MARK: - Localization and RTL Support
    
    private func updateForLocalization() {
        title = NSLocalizedString("Associations", comment: "Screen title")
        searchController.searchBar.placeholder = NSLocalizedString("Search Associations", comment: "Search bar placeholder")
        
        // Update empty state text
        if !emptyStateView.isHidden {
            showEmptyState()
        }
    }
    
    private func updateForRTL() {
        let isRTL = UIView.userInterfaceLayoutDirection(for: view.semanticContentAttribute) == .rightToLeft
        
        // Update semantic content attribute
        view.semanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
        tableView.semanticContentAttribute = view.semanticContentAttribute
        searchController.searchBar.semanticContentAttribute = view.semanticContentAttribute
        
        // Update loading view
        loadingView.semanticContentAttribute = view.semanticContentAttribute
    }
    
    private func updateForDynamicType() {
        tableView.rowHeight = UITableView.automaticDimension
        tableView.estimatedRowHeight = 120
    }
    
    // MARK: - Accessibility
    
    private func configureAccessibility() {
        // Configure navigation
        navigationItem.accessibilityLabel = NSLocalizedString("Associations List", comment: "Screen accessibility label")
        
        // Configure search
        searchController.searchBar.accessibilityLabel = NSLocalizedString("Search Associations", comment: "Search accessibility label")
        searchController.searchBar.accessibilityHint = NSLocalizedString("Double tap to search associations", comment: "Search accessibility hint")
        
        // Configure refresh control
        refreshControl.accessibilityLabel = NSLocalizedString("Refresh Associations", comment: "Refresh control accessibility label")
        refreshControl.accessibilityHint = NSLocalizedString("Pull down to refresh the list", comment: "Refresh control accessibility hint")
        
        // Configure offline indicator
        offlineIndicator.accessibilityLabel = NSLocalizedString("Offline Mode", comment: "Offline indicator accessibility label")
        offlineIndicator.accessibilityHint = NSLocalizedString("Some features may be limited while offline", comment: "Offline indicator accessibility hint")
    }
}

// MARK: - UITableViewDataSource

extension AssociationsListViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return viewModel.associations.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell: AssociationCell = tableView.dequeueCell(for: indexPath)
        let association = viewModel.associations[indexPath.row]
        cell.configure(with: association)
        return cell
    }
}

// MARK: - UITableViewDelegate

extension AssociationsListViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        let association = viewModel.associations[indexPath.row]
        // Handle association selection
    }
}

// MARK: - UISearchResultsUpdating

extension AssociationsListViewController: UISearchResultsUpdating {
    func updateSearchResults(for searchController: UISearchController) {
        guard let query = searchController.searchBar.text else { return }
        viewModel.transform(input: .searchTrigger(Just(query).eraseToAnyPublisher()))
    }
}