import UIKit // iOS 13.0+
import Combine // iOS 13.0+

/// View controller responsible for displaying detailed campaign information with enhanced
/// accessibility support and lottery features
@available(iOS 13.0, *)
final class CampaignDetailViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: CampaignDetailViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private lazy var loadingView: UIActivityIndicatorView = {
        let view = UIActivityIndicatorView(style: .large)
        view.hidesWhenStopped = true
        view.accessibilityLabel = NSLocalizedString("Loading campaign details", comment: "")
        return view
    }()
    
    private lazy var scrollView: UIScrollView = {
        let view = UIScrollView()
        view.showsVerticalScrollIndicator = true
        view.alwaysBounceVertical = true
        view.accessibilityLabel = NSLocalizedString("Campaign details scroll view", comment: "")
        return view
    }()
    
    private lazy var contentStackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.alignment = .fill
        stack.distribution = .fill
        stack.layoutMargins = UIEdgeInsets(top: 16, left: 16, bottom: 16, right: 16)
        stack.isLayoutMarginsRelativeArrangement = true
        return stack
    }()
    
    private lazy var campaignImageView: UIImageView = {
        let imageView = UIImageView()
        imageView.contentMode = .scaleAspectFill
        imageView.clipsToBounds = true
        imageView.heightAnchor.constraint(equalToConstant: 200).isActive = true
        imageView.isAccessibilityElement = true
        return imageView
    }()
    
    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .title1)
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        label.accessibilityTraits = .header
        return label
    }()
    
    private lazy var descriptionLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .body)
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private lazy var progressBar: UIProgressView = {
        let progress = UIProgressView(progressViewStyle: .default)
        progress.progressTintColor = .systemBlue
        progress.trackTintColor = .systemGray5
        progress.isAccessibilityElement = true
        return progress
    }()
    
    private lazy var progressLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.adjustsFontForContentSizeCategory = true
        label.textAlignment = .center
        return label
    }()
    
    private lazy var donateButton: UIButton = {
        let button = UIButton(type: .system)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.setTitle(NSLocalizedString("Donate Now", comment: ""), for: .normal)
        button.backgroundColor = .systemBlue
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 8
        button.heightAnchor.constraint(equalToConstant: 44).isActive = true
        return button
    }()
    
    private lazy var lotteryContainerView: UIView = {
        let view = UIView()
        view.backgroundColor = .systemBackground
        view.layer.cornerRadius = 8
        view.layer.borderWidth = 1
        view.layer.borderColor = UIColor.systemGray4.cgColor
        view.isHidden = true
        return view
    }()
    
    private lazy var lotteryInfoLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .callout)
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private lazy var participateButton: UIButton = {
        let button = UIButton(type: .system)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.setTitle(NSLocalizedString("Participate in Lottery", comment: ""), for: .normal)
        button.backgroundColor = .systemGreen
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 8
        button.heightAnchor.constraint(equalToConstant: 44).isActive = true
        return button
    }()
    
    // MARK: - Initialization
    
    init(viewModel: CampaignDetailViewModel) {
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
        setupBindings()
        setupAccessibility()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Add loading view
        view.addSubview(loadingView)
        loadingView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            loadingView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        // Setup scroll view
        view.addSubview(scrollView)
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            scrollView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            scrollView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            scrollView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            scrollView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Setup content stack
        scrollView.addSubview(contentStackView)
        contentStackView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            contentStackView.topAnchor.constraint(equalTo: scrollView.topAnchor),
            contentStackView.leadingAnchor.constraint(equalTo: scrollView.leadingAnchor),
            contentStackView.trailingAnchor.constraint(equalTo: scrollView.trailingAnchor),
            contentStackView.bottomAnchor.constraint(equalTo: scrollView.bottomAnchor),
            contentStackView.widthAnchor.constraint(equalTo: scrollView.widthAnchor)
        ])
        
        // Add UI components to stack
        contentStackView.addArrangedSubview(campaignImageView)
        contentStackView.addArrangedSubview(titleLabel)
        contentStackView.addArrangedSubview(descriptionLabel)
        contentStackView.addArrangedSubview(progressBar)
        contentStackView.addArrangedSubview(progressLabel)
        contentStackView.addArrangedSubview(donateButton)
        
        setupLotteryUI()
    }
    
    private func setupLotteryUI() {
        contentStackView.addArrangedSubview(lotteryContainerView)
        
        lotteryContainerView.addSubview(lotteryInfoLabel)
        lotteryContainerView.addSubview(participateButton)
        
        lotteryInfoLabel.translatesAutoresizingMaskIntoConstraints = false
        participateButton.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            lotteryInfoLabel.topAnchor.constraint(equalTo: lotteryContainerView.topAnchor, constant: 16),
            lotteryInfoLabel.leadingAnchor.constraint(equalTo: lotteryContainerView.leadingAnchor, constant: 16),
            lotteryInfoLabel.trailingAnchor.constraint(equalTo: lotteryContainerView.trailingAnchor, constant: -16),
            
            participateButton.topAnchor.constraint(equalTo: lotteryInfoLabel.bottomAnchor, constant: 16),
            participateButton.leadingAnchor.constraint(equalTo: lotteryContainerView.leadingAnchor, constant: 16),
            participateButton.trailingAnchor.constraint(equalTo: lotteryContainerView.trailingAnchor, constant: -16),
            participateButton.bottomAnchor.constraint(equalTo: lotteryContainerView.bottomAnchor, constant: -16)
        ])
    }
    
    private func setupBindings() {
        let input = CampaignDetailViewModel.Input(
            viewAppear: Just(()).eraseToAnyPublisher(),
            refreshTrigger: NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)
                .map { _ in }
                .eraseToAnyPublisher(),
            retryTrigger: Just(()).eraseToAnyPublisher()
        )
        
        let output = viewModel.transform(input: input)
        
        // Bind campaign details
        output.campaignDetails
            .sink { [weak self] campaign in
                self?.updateUI(with: campaign)
            }
            .store(in: &cancellables)
        
        // Bind progress
        output.progress
            .sink { [weak self] progress in
                self?.updateProgress(progress)
            }
            .store(in: &cancellables)
        
        // Bind lottery details
        output.lotteryDetails
            .sink { [weak self] details in
                self?.updateLotteryUI(with: details)
            }
            .store(in: &cancellables)
        
        // Bind loading state
        output.isLoading
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
    }
    
    private func setupAccessibility() {
        // Configure scroll view accessibility
        scrollView.isAccessibilityElement = false
        scrollView.accessibilityTraits = .scrollable
        
        // Configure progress bar accessibility
        progressBar.accessibilityLabel = NSLocalizedString("Campaign progress", comment: "")
        progressBar.accessibilityTraits = .updatesFrequently
        
        // Configure lottery container accessibility
        lotteryContainerView.isAccessibilityElement = false
        lotteryContainerView.accessibilityElements = [lotteryInfoLabel, participateButton]
    }
    
    private func updateUI(with campaign: Campaign) {
        titleLabel.text = campaign.title
        descriptionLabel.text = campaign.description
        
        // Update image if available
        if let imageURL = campaign.images.first {
            // Implement image loading here
        }
        
        // Update accessibility labels
        campaignImageView.accessibilityLabel = NSLocalizedString("Campaign image for ", comment: "") + campaign.title
        titleLabel.accessibilityLabel = campaign.title
        descriptionLabel.accessibilityLabel = campaign.description
    }
    
    private func updateProgress(_ progress: Double) {
        progressBar.progress = Float(progress / 100)
        progressLabel.text = String(format: "%.1f%%", progress)
        
        // Update accessibility value
        progressBar.accessibilityValue = String(format: NSLocalizedString("%.1f percent complete", comment: ""), progress)
    }
    
    private func updateLotteryUI(with details: CampaignLotteryDetails?) {
        lotteryContainerView.isHidden = details == nil
        
        if let details = details {
            let formatter = NumberFormatter()
            formatter.numberStyle = .currency
            formatter.currencyCode = details.currency
            
            let priceString = formatter.string(from: NSDecimalNumber(decimal: details.ticketPrice)) ?? ""
            let dateFormatter = DateFormatter()
            dateFormatter.dateStyle = .long
            
            lotteryInfoLabel.text = String(format: NSLocalizedString(
                "Lottery ticket price: %@\nDraw date: %@\nTickets sold: %d/%d",
                comment: ""
            ), priceString, dateFormatter.string(from: details.drawDate), details.soldTickets, details.maxTickets)
            
            // Update accessibility
            lotteryInfoLabel.accessibilityLabel = String(format: NSLocalizedString(
                "Lottery information. Ticket price %@. Draw date %@. %d tickets sold out of %d total tickets.",
                comment: ""
            ), priceString, dateFormatter.string(from: details.drawDate), details.soldTickets, details.maxTickets)
        }
    }
    
    private func updateLoadingState(_ isLoading: Bool) {
        if isLoading {
            loadingView.startAnimating()
            contentStackView.alpha = 0.5
            view.isUserInteractionEnabled = false
        } else {
            loadingView.stopAnimating()
            contentStackView.alpha = 1.0
            view.isUserInteractionEnabled = true
        }
        
        // Update accessibility
        UIAccessibility.post(notification: .layoutChanged, argument: isLoading ? loadingView : contentStackView)
    }
}