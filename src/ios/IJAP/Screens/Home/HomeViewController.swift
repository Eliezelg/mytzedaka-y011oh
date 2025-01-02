//
// HomeViewController.swift
// IJAP
//
// Foundation version: iOS 13.0+
// UIKit version: iOS 13.0+
// Combine version: iOS 13.0+
//

import UIKit
import Combine

@available(iOS 13.0, *)
@MainActor
public final class HomeViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: HomeViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private lazy var scrollView: UIScrollView = {
        let scrollView = UIScrollView()
        scrollView.backgroundColor = .background
        scrollView.alwaysBounceVertical = true
        scrollView.showsVerticalScrollIndicator = true
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        return scrollView
    }()
    
    private lazy var contentStackView: UIStackView = {
        let stackView = UIStackView()
        stackView.axis = .vertical
        stackView.spacing = 24
        stackView.alignment = .fill
        stackView.distribution = .fill
        stackView.translatesAutoresizingMaskIntoConstraints = false
        return stackView
    }()
    
    private lazy var featuredCampaignsCollectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.minimumInteritemSpacing = 16
        layout.minimumLineSpacing = 16
        layout.sectionInset = UIEdgeInsets(top: 0, left: 24, bottom: 0, right: 24)
        
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.showsHorizontalScrollIndicator = false
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        return collectionView
    }()
    
    private lazy var recentAssociationsCollectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .vertical
        layout.minimumInteritemSpacing = 16
        layout.minimumLineSpacing = 16
        layout.sectionInset = UIEdgeInsets(top: 0, left: 24, bottom: 0, right: 24)
        
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.isScrollEnabled = false
        collectionView.translatesAutoresizingMaskIntoConstraints = false
        return collectionView
    }()
    
    private lazy var refreshControl: UIRefreshControl = {
        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = .primary
        return refreshControl
    }()
    
    private lazy var loadingView: LoadingView = {
        let view = LoadingView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var emptyStateView: EmptyStateView = {
        let view = EmptyStateView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()
    
    // MARK: - Input/Output
    
    private let viewAppeared = PassthroughSubject<Void, Never>()
    private let refreshTriggered = PassthroughSubject<Void, Never>()
    private let retryTriggered = PassthroughSubject<Void, Never>()
    
    // MARK: - Initialization
    
    public init(viewModel: HomeViewModel) {
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
        setupCollectionViews()
        setupRefreshControl()
        setupAccessibility()
        bindViewModel()
        
        // Initial data load
        viewAppeared.send()
    }
    
    public override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(false, animated: animated)
    }
    
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            updateColors()
        }
        
        if traitCollection.layoutDirection != previousTraitCollection?.layoutDirection {
            updateLayoutDirection()
        }
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .background
        
        // Add subviews
        view.addSubview(scrollView)
        scrollView.addSubview(contentStackView)
        view.addSubview(loadingView)
        view.addSubview(emptyStateView)
        
        // Add content to stack view
        contentStackView.addArrangedSubview(featuredCampaignsCollectionView)
        contentStackView.addArrangedSubview(recentAssociationsCollectionView)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            contentStackView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentStackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentStackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentStackView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentStackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            featuredCampaignsCollectionView.heightAnchor.constraint(equalToConstant: 200),
            recentAssociationsCollectionView.heightAnchor.constraint(equalToConstant: 400),
            
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            emptyStateView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            emptyStateView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            emptyStateView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            emptyStateView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func setupCollectionViews() {
        // Register cells
        featuredCampaignsCollectionView.register(CampaignCell.self, forCellWithReuseIdentifier: "CampaignCell")
        recentAssociationsCollectionView.register(AssociationCell.self, forCellWithReuseIdentifier: "AssociationCell")
        
        // Set delegates
        featuredCampaignsCollectionView.delegate = self
        featuredCampaignsCollectionView.dataSource = self
        recentAssociationsCollectionView.delegate = self
        recentAssociationsCollectionView.dataSource = self
    }
    
    private func setupRefreshControl() {
        scrollView.refreshControl = refreshControl
        refreshControl.addTarget(self, action: #selector(handleRefresh), for: .valueChanged)
    }
    
    private func setupAccessibility() {
        scrollView.accessibilityIdentifier = "HomeScrollView"
        featuredCampaignsCollectionView.accessibilityIdentifier = "FeaturedCampaignsCollectionView"
        recentAssociationsCollectionView.accessibilityIdentifier = "RecentAssociationsCollectionView"
        
        // VoiceOver grouping
        featuredCampaignsCollectionView.accessibilityLabel = NSLocalizedString("Featured Campaigns", comment: "")
        recentAssociationsCollectionView.accessibilityLabel = NSLocalizedString("Recent Associations", comment: "")
    }
    
    private func bindViewModel() {
        let input = HomeViewModel.Input(
            viewAppeared: viewAppeared,
            refreshTriggered: refreshTriggered,
            retryTriggered: retryTriggered
        )
        
        let output = viewModel.transform(input: input)
        
        // Bind featured campaigns
        output.featuredCampaigns
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                if case .failure(let error) = completion {
                    self?.handleError(error)
                }
            } receiveValue: { [weak self] campaigns in
                self?.updateFeaturedCampaigns(campaigns)
            }
            .store(in: &cancellables)
        
        // Bind recent associations
        output.recentAssociations
            .receive(on: DispatchQueue.main)
            .sink { [weak self] completion in
                if case .failure(let error) = completion {
                    self?.handleError(error)
                }
            } receiveValue: { [weak self] associations in
                self?.updateRecentAssociations(associations)
            }
            .store(in: &cancellables)
        
        // Bind loading state
        output.viewState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.updateViewState(state)
            }
            .store(in: &cancellables)
        
        // Bind offline state
        output.isOffline
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isOffline in
                self?.updateOfflineState(isOffline)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - Update Methods
    
    private func updateViewState(_ state: ViewState) {
        switch state {
        case .loading:
            loadingView.show(message: NSLocalizedString("Loading content...", comment: ""))
            emptyStateView.isHidden = true
        case .loaded:
            loadingView.hide()
            refreshControl.endRefreshing()
        case .error(let error):
            loadingView.hide()
            refreshControl.endRefreshing()
            handleError(error)
        }
    }
    
    private func updateOfflineState(_ isOffline: Bool) {
        if isOffline {
            let message = NSLocalizedString("You're offline. Showing cached content.", comment: "")
            showOfflineBanner(message: message)
        } else {
            hideOfflineBanner()
        }
    }
    
    private func updateColors() {
        view.backgroundColor = .background
        scrollView.backgroundColor = .background
    }
    
    private func updateLayoutDirection() {
        let isRTL = traitCollection.layoutDirection == .rightToLeft
        
        featuredCampaignsCollectionView.semanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
        recentAssociationsCollectionView.semanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
        
        if let layout = featuredCampaignsCollectionView.collectionViewLayout as? UICollectionViewFlowLayout {
            layout.scrollDirection = .horizontal
        }
    }
    
    // MARK: - Error Handling
    
    private func handleError(_ error: Error) {
        emptyStateView.configure(
            image: UIImage(systemName: "exclamationmark.triangle"),
            title: NSLocalizedString("Oops!", comment: ""),
            message: error.localizedDescription,
            action: { [weak self] in
                self?.retryTriggered.send()
            }
        )
        emptyStateView.isHidden = false
    }
    
    // MARK: - Actions
    
    @objc private func handleRefresh() {
        refreshTriggered.send()
    }
}

// MARK: - UICollectionViewDataSource

extension HomeViewController: UICollectionViewDataSource {
    public func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        // Implementation based on collection view type
        return 0
    }
    
    public func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        // Implementation based on collection view type
        return UICollectionViewCell()
    }
}

// MARK: - UICollectionViewDelegate

extension HomeViewController: UICollectionViewDelegate {
    public func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        // Implementation based on collection view type
    }
}

// MARK: - UICollectionViewDelegateFlowLayout

extension HomeViewController: UICollectionViewDelegateFlowLayout {
    public func collectionView(_ collectionView: UICollectionView, layout collectionViewLayout: UICollectionViewLayout, sizeForItemAt indexPath: IndexPath) -> CGSize {
        // Implementation based on collection view type
        return .zero
    }
}