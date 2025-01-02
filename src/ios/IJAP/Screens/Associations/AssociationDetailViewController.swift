// UIKit version: iOS 13.0+
// Combine version: iOS 13.0+
import UIKit
import Combine

@available(iOS 13.0, *)
public final class AssociationDetailViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: AssociationDetailViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private lazy var scrollView: UIScrollView = {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.showsVerticalScrollIndicator = true
        scrollView.alwaysBounceVertical = true
        return scrollView
    }()
    
    private lazy var contentStackView: UIStackView = {
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 16
        stack.alignment = .fill
        stack.distribution = .fill
        stack.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stack.isLayoutMarginsRelativeArrangement = true
        return stack
    }()
    
    private lazy var headerView: UIView = {
        let view = UIView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.backgroundColor = .background
        return view
    }()
    
    private lazy var nameLabel: UILabel = {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = .preferredFont(forTextStyle: .title1)
        label.textColor = .textPrimary
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private lazy var descriptionLabel: UILabel = {
        let label = UILabel()
        label.translatesAutoresizingMaskIntoConstraints = false
        label.font = .preferredFont(forTextStyle: .body)
        label.textColor = .textSecondary
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private lazy var verificationBadge: UIImageView = {
        let imageView = UIImageView()
        imageView.translatesAutoresizingMaskIntoConstraints = false
        imageView.contentMode = .scaleAspectFit
        imageView.tintColor = .success
        return imageView
    }()
    
    private lazy var donateButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .large)
        button.translatesAutoresizingMaskIntoConstraints = false
        button.addTarget(self, action: #selector(donateButtonTapped), for: .touchUpInside)
        return button
    }()
    
    private lazy var loadingView: LoadingView = {
        let view = LoadingView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private lazy var errorView: ErrorView = {
        let view = ErrorView()
        view.translatesAutoresizingMaskIntoConstraints = false
        view.isHidden = true
        return view
    }()
    
    // MARK: - Initialization
    
    public init(viewModel: AssociationDetailViewModel) {
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
        setupConstraints()
        setupBindings()
        setupAccessibility()
        configureNavigationBar()
    }
    
    public override func viewDidLayoutSubviews() {
        super.viewDidLayoutSubviews()
        updateLayoutForDirection()
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .background
        
        // Add subviews
        view.addSubview(scrollView)
        scrollView.addSubview(contentStackView)
        
        // Configure header
        headerView.addSubview(nameLabel)
        headerView.addSubview(verificationBadge)
        contentStackView.addArrangedSubview(headerView)
        
        // Add content views
        contentStackView.addArrangedSubview(descriptionLabel)
        contentStackView.addArrangedSubview(donateButton)
        
        // Add loading and error views
        view.addSubview(loadingView)
        view.addSubview(errorView)
    }
    
    private func setupConstraints() {
        NSLayoutConstraint.activate([
            // Scroll view
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            // Content stack
            contentStackView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentStackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentStackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentStackView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentStackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor),
            
            // Header components
            nameLabel.topAnchor.constraint(equalTo: headerView.topAnchor, constant: 16),
            nameLabel.leadingAnchor.constraint(equalTo: headerView.leadingAnchor, constant: 16),
            nameLabel.trailingAnchor.constraint(equalTo: verificationBadge.leadingAnchor, constant: -8),
            
            verificationBadge.centerYAnchor.constraint(equalTo: nameLabel.centerYAnchor),
            verificationBadge.trailingAnchor.constraint(equalTo: headerView.trailingAnchor, constant: -16),
            verificationBadge.widthAnchor.constraint(equalToConstant: 24),
            verificationBadge.heightAnchor.constraint(equalToConstant: 24),
            
            // Loading view
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            // Error view
            errorView.topAnchor.constraint(equalTo: view.topAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            errorView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
    }
    
    private func setupBindings() {
        let input = AssociationDetailViewModel.Input(
            loadTrigger: Just("").eraseToAnyPublisher(),
            refreshTrigger: NotificationCenter.default.publisher(
                for: UIApplication.didBecomeActiveNotification
            ).map { _ in () }.eraseToAnyPublisher(),
            verifyTrigger: NotificationCenter.default.publisher(
                for: .init("AssociationVerificationRequested")
            ).map { _ in () }.eraseToAnyPublisher()
        )
        
        let output = viewModel.transform(input)
        
        // Bind association data
        output.association
            .receive(on: DispatchQueue.main)
            .sink { [weak self] association in
                self?.updateUI(with: association)
            }
            .store(in: &cancellables)
        
        // Bind loading state
        output.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        // Bind error state
        output.error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                self?.handleError(error)
            }
            .store(in: &cancellables)
        
        // Bind offline state
        output.isOffline
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isOffline in
                self?.handleOfflineState(isOffline)
            }
            .store(in: &cancellables)
    }
    
    private func setupAccessibility() {
        // Configure accessibility for header
        nameLabel.isAccessibilityElement = true
        nameLabel.accessibilityTraits = .header
        
        verificationBadge.isAccessibilityElement = true
        verificationBadge.accessibilityLabel = NSLocalizedString(
            "Verified Association",
            comment: "Verification badge accessibility label"
        )
        
        // Configure accessibility for action buttons
        donateButton.accessibilityLabel = NSLocalizedString(
            "Donate to Association",
            comment: "Donate button accessibility label"
        )
        
        // Configure scroll view accessibility
        scrollView.accessibilityLabel = NSLocalizedString(
            "Association Details",
            comment: "Scroll view accessibility label"
        )
    }
    
    private func configureNavigationBar() {
        navigationItem.largeTitleDisplayMode = .never
        
        // Add share button
        let shareButton = UIBarButtonItem(
            image: UIImage(systemName: "square.and.arrow.up"),
            style: .plain,
            target: self,
            action: #selector(shareButtonTapped)
        )
        navigationItem.rightBarButtonItem = shareButton
    }
    
    // MARK: - UI Update Methods
    
    private func updateUI(with association: Association?) {
        guard let association = association else {
            errorView.configure(
                title: NSLocalizedString("Error", comment: "Error title"),
                message: NSLocalizedString("Association not found", comment: "Association not found message"),
                retryAction: { [weak self] in
                    self?.viewModel.transform(.init(
                        loadTrigger: Just("").eraseToAnyPublisher(),
                        refreshTrigger: Empty().eraseToAnyPublisher(),
                        verifyTrigger: Empty().eraseToAnyPublisher()
                    ))
                }
            )
            return
        }
        
        // Update title and description
        nameLabel.text = association.name
        
        // Get localized description based on current locale
        let currentLocale = Locale.current.languageCode ?? "en"
        descriptionLabel.text = association.description[currentLocale] ?? association.description["en"]
        
        // Update verification badge
        verificationBadge.image = association.isVerified ?
            UIImage(systemName: "checkmark.seal.fill") :
            UIImage(systemName: "exclamationmark.triangle.fill")
        verificationBadge.tintColor = association.isVerified ? .success : .warning
        
        // Update donate button
        donateButton.setTitle(
            NSLocalizedString("Donate Now", comment: "Donate button title"),
            for: .normal
        )
        donateButton.isEnabled = association.status == "ACTIVE"
        
        // Update accessibility
        updateAccessibilityLabels(for: association)
    }
    
    private func updateLoadingState(_ isLoading: Bool) {
        if isLoading {
            loadingView.show(
                message: NSLocalizedString(
                    "Loading Association Details",
                    comment: "Loading message"
                )
            )
        } else {
            loadingView.hide()
        }
    }
    
    private func handleError(_ error: LocalizedError?) {
        guard let error = error else {
            errorView.isHidden = true
            return
        }
        
        errorView.isHidden = false
        errorView.configure(
            title: NSLocalizedString("Error", comment: "Error title"),
            message: error.localizedDescription,
            retryAction: { [weak self] in
                self?.viewModel.transform(.init(
                    loadTrigger: Just("").eraseToAnyPublisher(),
                    refreshTrigger: Empty().eraseToAnyPublisher(),
                    verifyTrigger: Empty().eraseToAnyPublisher()
                ))
            }
        )
    }
    
    private func handleOfflineState(_ isOffline: Bool) {
        // Update UI for offline mode
        donateButton.isEnabled = !isOffline
        
        if isOffline {
            let offlineMessage = NSLocalizedString(
                "You're offline. Some features may be limited.",
                comment: "Offline message"
            )
            
            // Show offline banner
            let banner = UILabel()
            banner.text = offlineMessage
            banner.textAlignment = .center
            banner.backgroundColor = .warning
            banner.textColor = .background
            banner.font = .preferredFont(forTextStyle: .footnote)
            banner.padding = UIEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
            
            navigationItem.titleView = banner
        } else {
            navigationItem.titleView = nil
        }
    }
    
    private func updateLayoutForDirection() {
        // Update layout for RTL support
        let isRTL = UIView.userInterfaceLayoutDirection(for: view.semanticContentAttribute) == .rightToLeft
        
        // Update content alignment
        contentStackView.alignment = isRTL ? .trailing : .leading
        
        // Update text alignment
        nameLabel.textAlignment = isRTL ? .right : .left
        descriptionLabel.textAlignment = isRTL ? .right : .left
        
        // Update verification badge position
        verificationBadge.transform = isRTL ? CGAffineTransform(scaleX: -1, y: 1) : .identity
    }
    
    private func updateAccessibilityLabels(for association: Association) {
        // Update verification badge accessibility
        verificationBadge.accessibilityLabel = association.isVerified ?
            NSLocalizedString("Verified Association", comment: "Verified accessibility label") :
            NSLocalizedString("Unverified Association", comment: "Unverified accessibility label")
        
        // Update donate button accessibility
        donateButton.accessibilityHint = association.status == "ACTIVE" ?
            NSLocalizedString("Double tap to make a donation", comment: "Donate button accessibility hint") :
            NSLocalizedString("Donations are currently disabled", comment: "Disabled donate button accessibility hint")
    }
    
    // MARK: - Action Methods
    
    @objc private func donateButtonTapped() {
        // Handle donation action
        NotificationCenter.default.post(
            name: .init("DonationRequested"),
            object: nil
        )
    }
    
    @objc private func shareButtonTapped() {
        guard let association = viewModel.association.value else { return }
        
        let activityItems = [
            association.name,
            URL(string: association.website ?? "https://ijap.org")
        ].compactMap { $0 }
        
        let activityViewController = UIActivityViewController(
            activityItems: activityItems,
            applicationActivities: nil
        )
        
        if let popoverController = activityViewController.popoverPresentationController {
            popoverController.barButtonItem = navigationItem.rightBarButtonItem
        }
        
        present(activityViewController, animated: true)
    }
    
    // MARK: - Override Methods
    
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            view.backgroundColor = .background
            headerView.backgroundColor = .background
        }
        
        if traitCollection.preferredContentSizeCategory != previousTraitCollection?.preferredContentSizeCategory {
            // Update font sizes for dynamic type
            nameLabel.font = .preferredFont(forTextStyle: .title1)
            descriptionLabel.font = .preferredFont(forTextStyle: .body)
        }
    }
}