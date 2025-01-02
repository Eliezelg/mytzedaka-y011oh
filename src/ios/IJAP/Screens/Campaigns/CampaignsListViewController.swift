// UIKit version: iOS 13.0+
// Combine version: iOS 13.0+
// Network version: iOS 13.0+

import UIKit
import Combine
import Network

@available(iOS 13.0, *)
final class CampaignsListViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: CampaignsListViewModel
    private var cancellables = Set<AnyCancellable>()
    private let imageCache = NSCache<NSString, UIImage>()
    private let refreshControl = UIRefreshControl()
    private var isRTL: Bool
    
    // MARK: - UI Components
    
    private lazy var tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .plain)
        table.translatesAutoresizingMaskIntoConstraints = false
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 120
        table.separatorStyle = .none
        table.backgroundColor = .background
        return table
    }()
    
    private lazy var searchController: UISearchController = {
        let controller = UISearchController(searchResultsController: nil)
        controller.obscuresBackgroundDuringPresentation = false
        controller.searchBar.placeholder = NSLocalizedString("Search campaigns", comment: "")
        return controller
    }()
    
    private let loadingView = LoadingView()
    private let emptyStateView = EmptyStateView()
    
    // MARK: - Input/Output
    
    private let viewDidLoadSubject = PassthroughSubject<Void, Never>()
    private let refreshSubject = PassthroughSubject<Void, Never>()
    private let searchTextSubject = PassthroughSubject<String?, Never>()
    
    // MARK: - Initialization
    
    init(viewModel: CampaignsListViewModel) {
        self.viewModel = viewModel
        self.isRTL = UIView.userInterfaceLayoutDirection(for: .unspecified) == .rightToLeft
        super.init(nibName: nil, bundle: nil)
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupBindings()
        configureAccessibility()
        viewDidLoadSubject.send(())
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.navigationBar.prefersLargeTitles = true
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        // Configure view
        view.backgroundColor = .background
        
        // Configure navigation
        title = NSLocalizedString("Campaigns", comment: "")
        navigationItem.searchController = searchController
        navigationItem.hidesSearchBarWhenScrolling = false
        
        // Configure refresh control
        refreshControl.tintColor = .primary
        
        // Configure table view
        tableView.refreshControl = refreshControl
        tableView.delegate = self
        tableView.dataSource = self
        tableView.register(CampaignCell.self, forCellReuseIdentifier: CampaignCell.reuseIdentifier)
        
        // Add subviews
        view.addSubview(tableView)
        view.addSubview(loadingView)
        view.addSubview(emptyStateView)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Configure RTL support
        configureRTLSupport()
    }
    
    private func setupBindings() {
        let input = CampaignsListViewModel.Input(
            viewDidLoad: viewDidLoadSubject,
            refresh: refreshSubject,
            searchText: searchTextSubject,
            activeFilter: PassthroughSubject<Bool, Never>(),
            currencySelection: PassthroughSubject<String, Never>(),
            sortOption: PassthroughSubject<CampaignSortOption, Never>()
        )
        
        let output = viewModel.transform(input: input)
        
        // Bind campaigns
        output.campaigns
            .receive(on: DispatchQueue.main)
            .sink { [weak self] campaigns in
                self?.handleCampaignsUpdate(campaigns)
            }
            .store(in: &cancellables)
        
        // Bind loading state
        output.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.handleLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        // Bind error state
        output.error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
        
        // Bind search
        searchController.searchBar.textDidChangePublisher
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] text in
                self?.searchTextSubject.send(text)
            }
            .store(in: &cancellables)
        
        // Bind refresh control
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
        
        // Monitor network status
        NetworkMonitor.shared.isConnected
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isConnected in
                self?.handleConnectivityChange(isConnected)
            }
            .store(in: &cancellables)
    }
    
    private func configureAccessibility() {
        tableView.accessibilityLabel = NSLocalizedString("Campaigns list", comment: "")
        searchController.searchBar.accessibilityLabel = NSLocalizedString("Search campaigns", comment: "")
        refreshControl.accessibilityLabel = NSLocalizedString("Refresh campaigns", comment: "")
    }
    
    private func configureRTLSupport() {
        view.semanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
        tableView.semanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
        searchController.searchBar.semanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
    }
    
    // MARK: - Event Handlers
    
    @objc private func handleRefresh() {
        refreshSubject.send(())
    }
    
    private func handleCampaignsUpdate(_ campaigns: [Campaign]) {
        refreshControl.endRefreshing()
        
        if campaigns.isEmpty {
            showEmptyState()
        } else {
            hideEmptyState()
        }
        
        tableView.reloadData()
    }
    
    private func handleLoadingState(_ isLoading: Bool) {
        if isLoading {
            loadingView.show(message: NSLocalizedString("Loading campaigns...", comment: ""))
        } else {
            loadingView.hide()
        }
    }
    
    private func handleError(_ error: Error?) {
        guard let error = error else { return }
        
        let alert = UIAlertController(
            title: NSLocalizedString("Error", comment: ""),
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(
            title: NSLocalizedString("Retry", comment: ""),
            style: .default,
            handler: { [weak self] _ in
                self?.viewDidLoadSubject.send(())
            }
        ))
        
        present(alert, animated: true)
    }
    
    private func handleConnectivityChange(_ isConnected: Bool) {
        if !isConnected {
            let message = NSLocalizedString("You're offline. Showing cached campaigns.", comment: "")
            showOfflineBanner(with: message)
        } else {
            hideOfflineBanner()
        }
    }
    
    // MARK: - Helper Methods
    
    private func showEmptyState() {
        emptyStateView.configure(
            image: UIImage(systemName: "list.bullet.rectangle"),
            title: NSLocalizedString("No Campaigns Found", comment: ""),
            message: NSLocalizedString("There are no active campaigns at the moment.", comment: ""),
            shouldMirrorImage: true
        )
        emptyStateView.isHidden = false
        tableView.isHidden = true
    }
    
    private func hideEmptyState() {
        emptyStateView.isHidden = true
        tableView.isHidden = false
    }
    
    private func showOfflineBanner(with message: String) {
        // Implementation for showing offline banner
    }
    
    private func hideOfflineBanner() {
        // Implementation for hiding offline banner
    }
}

// MARK: - UITableViewDelegate & UITableViewDataSource

extension CampaignsListViewController: UITableViewDelegate, UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        // Implementation for number of rows
        return 0
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        // Implementation for cell configuration
        return UITableViewCell()
    }
}

// MARK: - UISearchResultsUpdating

extension CampaignsListViewController: UISearchResultsUpdating {
    func updateSearchResults(for searchController: UISearchController) {
        searchTextSubject.send(searchController.searchBar.text)
    }
}