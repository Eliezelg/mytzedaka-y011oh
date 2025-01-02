// UIKit version: iOS 13.0+
import UIKit
// Combine version: iOS 13.0+
import Combine

/// View controller responsible for displaying donation confirmation status and managing secure tax receipt downloads
@available(iOS 13.0, *)
public final class DonationConfirmationViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: DonationConfirmationViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private let loadingView = LoadingView()
    private let errorView = ErrorView()
    
    private let statusLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .headline)
        label.textColor = .textPrimary
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private let amountLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .title2)
        label.textColor = .textPrimary
        label.textAlignment = .center
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        return label
    }()
    
    private lazy var receiptButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .medium)
        button.setTitle(NSLocalizedString("Download Receipt", comment: "Receipt download button"), for: .normal)
        button.addTarget(self, action: #selector(downloadReceipt), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private lazy var doneButton: CustomButton = {
        let button = CustomButton(style: .secondary, size: .medium)
        button.setTitle(NSLocalizedString("Done", comment: "Done button"), for: .normal)
        button.addTarget(self, action: #selector(dismissView), for: .touchUpInside)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private let stackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 24
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    private let progressView: UIProgressView = {
        let progress = UIProgressView(progressViewStyle: .default)
        progress.progressTintColor = .primary
        progress.translatesAutoresizingMaskIntoConstraints = false
        progress.isHidden = true
        return progress
    }()
    
    // MARK: - Initialization
    
    public init(viewModel: DonationConfirmationViewModel) {
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
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        view.backgroundColor = .background
        
        // Add subviews
        view.addSubview(stackView)
        stackView.addArrangedSubview(statusLabel)
        stackView.addArrangedSubview(amountLabel)
        stackView.addArrangedSubview(receiptButton)
        stackView.addArrangedSubview(progressView)
        stackView.addArrangedSubview(doneButton)
        
        view.addSubview(loadingView)
        view.addSubview(errorView)
        
        // Configure RTL support
        view.semanticContentAttribute = LocaleUtils.isRTL() ? .forceRightToLeft : .forceLeftToRight
        stackView.semanticContentAttribute = view.semanticContentAttribute
        
        // Setup constraints
        NSLayoutConstraint.activate([
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stackView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor, constant: 24),
            stackView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor, constant: -24),
            
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            errorView.topAnchor.constraint(equalTo: view.topAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            errorView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            progressView.leadingAnchor.constraint(equalTo: stackView.leadingAnchor),
            progressView.trailingAnchor.constraint(equalTo: stackView.trailingAnchor),
            progressView.heightAnchor.constraint(equalToConstant: 2)
        ])
        
        // Hide views initially
        errorView.isHidden = true
        loadingView.isHidden = true
    }
    
    private func setupBindings() {
        let input = DonationConfirmationViewModel.Input()
        let output = viewModel.transform(input: input)
        
        // Bind donation status updates
        output.donation
            .receive(on: DispatchQueue.main)
            .sink { [weak self] donation in
                guard let self = self, let donation = donation else { return }
                self.updateUI(with: donation)
            }
            .store(in: &cancellables)
        
        // Bind loading state
        output.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                if isLoading {
                    self?.loadingView.show(message: NSLocalizedString("Processing donation...", comment: "Loading message"))
                } else {
                    self?.loadingView.hide()
                }
            }
            .store(in: &cancellables)
        
        // Bind error state
        output.error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                if let error = error {
                    self?.showError(error)
                } else {
                    self?.errorView.isHidden = true
                }
            }
            .store(in: &cancellables)
    }
    
    private func configureAccessibility() {
        // Configure accessibility labels and traits
        statusLabel.isAccessibilityElement = true
        statusLabel.accessibilityTraits = .updatesFrequently
        
        amountLabel.isAccessibilityElement = true
        amountLabel.accessibilityTraits = .staticText
        
        receiptButton.accessibilityHint = NSLocalizedString(
            "Downloads donation receipt to your device",
            comment: "Receipt button accessibility hint"
        )
        
        doneButton.accessibilityHint = NSLocalizedString(
            "Closes the confirmation screen",
            comment: "Done button accessibility hint"
        )
    }
    
    // MARK: - UI Updates
    
    private func updateUI(with donation: Donation) {
        // Update status label
        let statusText: String
        switch donation.paymentStatus {
        case .completed:
            statusText = NSLocalizedString("Donation Successful", comment: "Success status")
            statusLabel.textColor = .success
        case .failed:
            statusText = NSLocalizedString("Donation Failed", comment: "Failed status")
            statusLabel.textColor = .error
        default:
            statusText = NSLocalizedString("Processing Donation", comment: "Processing status")
            statusLabel.textColor = .textPrimary
        }
        statusLabel.text = statusText
        
        // Update amount label with proper formatting
        if case .success(let formattedAmount) = CurrencyUtils.formatAmount(donation.amount, currencyCode: donation.currency) {
            amountLabel.text = formattedAmount
        }
        
        // Configure receipt button visibility
        receiptButton.isHidden = !donation.taxReceiptRequired || donation.paymentStatus != .completed
        
        // Update accessibility
        let accessibilityText = "\(statusText). \(amountLabel.text ?? "")"
        UIAccessibility.post(notification: .announcement, argument: accessibilityText)
    }
    
    private func showError(_ error: Error) {
        errorView.configure(
            title: NSLocalizedString("Error", comment: "Error title"),
            message: error.localizedDescription,
            retryAction: { [weak self] in
                self?.viewModel.transform(input: DonationConfirmationViewModel.Input())
            }
        )
        errorView.isHidden = false
    }
    
    // MARK: - Actions
    
    @objc private func downloadReceipt() {
        progressView.isHidden = false
        progressView.progress = 0
        
        viewModel.downloadReceipt()
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.progressView.isHidden = true
                    if case .failure(let error) = completion {
                        self?.showError(error)
                    }
                },
                receiveValue: { [weak self] progress in
                    self?.progressView.progress = Float(progress)
                }
            )
            .store(in: &cancellables)
    }
    
    @objc private func dismissView() {
        dismiss(animated: true)
    }
    
    // MARK: - Trait Collection
    
    public override func traitCollectionDidChange(_ previousTraitCollection: UITraitCollection?) {
        super.traitCollectionDidChange(previousTraitCollection)
        
        if traitCollection.hasDifferentColorAppearance(comparedTo: previousTraitCollection) {
            view.backgroundColor = .background
            statusLabel.textColor = .textPrimary
            amountLabel.textColor = .textPrimary
        }
    }
}