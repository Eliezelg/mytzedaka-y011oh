// UIKit version: iOS 13.0+
import UIKit
// Combine version: iOS 13.0+
import Combine

/// View controller managing the donation form interface with comprehensive validation,
/// accessibility support, and multi-gateway payment processing
@available(iOS 13.0, *)
final class DonationFormViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: DonationFormViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private lazy var amountTextField: CustomTextField = {
        let textField = CustomTextField(type: .amount)
        textField.placeholder = "Enter donation amount".localized
        textField.accessibilityIdentifier = "DonationForm.AmountTextField"
        return textField
    }()
    
    private lazy var currencySegmentedControl: UISegmentedControl = {
        let currencies = CurrencyConfig.supportedCurrencies.map { $0.rawValue }
        let control = UISegmentedControl(items: currencies)
        control.selectedSegmentIndex = 0
        control.accessibilityIdentifier = "DonationForm.CurrencySelector"
        return control
    }()
    
    private lazy var paymentMethodCollectionView: UICollectionView = {
        let layout = UICollectionViewFlowLayout()
        layout.scrollDirection = .horizontal
        layout.itemSize = CGSize(width: 120, height: 80)
        layout.minimumInteritemSpacing = 12
        
        let collectionView = UICollectionView(frame: .zero, collectionViewLayout: layout)
        collectionView.backgroundColor = .clear
        collectionView.showsHorizontalScrollIndicator = false
        collectionView.delegate = self
        collectionView.dataSource = self
        collectionView.accessibilityIdentifier = "DonationForm.PaymentMethods"
        return collectionView
    }()
    
    private lazy var anonymousSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityIdentifier = "DonationForm.AnonymousSwitch"
        return toggle
    }()
    
    private lazy var recurringSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityIdentifier = "DonationForm.RecurringSwitch"
        return toggle
    }()
    
    private lazy var dedicationTextField: CustomTextField = {
        let textField = CustomTextField(type: .general)
        textField.placeholder = "Add dedication (optional)".localized
        textField.accessibilityIdentifier = "DonationForm.DedicationTextField"
        return textField
    }()
    
    private lazy var submitButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .large)
        button.setTitle("Donate Now".localized, for: .normal)
        button.accessibilityIdentifier = "DonationForm.SubmitButton"
        return button
    }()
    
    private lazy var loadingIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.hidesWhenStopped = true
        return indicator
    }()
    
    private lazy var errorBanner: ErrorBannerView = {
        let banner = ErrorBannerView()
        banner.isHidden = true
        return banner
    }()
    
    // MARK: - Publishers
    
    private let amountSubject = CurrentValueSubject<Decimal?, Never>(nil)
    private let currencySubject = CurrentValueSubject<String, Never>(CurrencyConfig.defaultCurrency.rawValue)
    private let paymentMethodSubject = CurrentValueSubject<PaymentMethodType?, Never>(nil)
    private let isAnonymousSubject = CurrentValueSubject<Bool, Never>(false)
    private let isRecurringSubject = CurrentValueSubject<Bool, Never>(false)
    private let dedicationSubject = CurrentValueSubject<String?, Never>(nil)
    private let submitTrigger = PassthroughSubject<Void, Never>()
    private let cancelTrigger = PassthroughSubject<Void, Never>()
    
    // MARK: - Initialization
    
    init(viewModel: DonationFormViewModel) {
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
        setupConstraints()
        bindViewModel()
        setupAccessibility()
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .background
        
        // Add subviews
        [amountTextField, currencySegmentedControl, paymentMethodCollectionView,
         anonymousSwitch, recurringSwitch, dedicationTextField,
         submitButton, loadingIndicator, errorBanner].forEach {
            $0.translatesAutoresizingMaskIntoConstraints = false
            view.addSubview($0)
        }
        
        // Configure navigation
        title = "Make a Donation".localized
        navigationItem.leftBarButtonItem = UIBarButtonItem(
            barButtonSystemItem: .cancel,
            target: self,
            action: #selector(cancelTapped)
        )
    }
    
    private func setupConstraints() {
        let isRTL = UIView.userInterfaceLayoutDirection(for: view.semanticContentAttribute) == .rightToLeft
        let layoutMargins = view.layoutMarginsGuide
        
        NSLayoutConstraint.activate([
            // Amount TextField
            amountTextField.topAnchor.constraint(equalTo: layoutMargins.topAnchor, constant: 24),
            amountTextField.leadingAnchor.constraint(equalTo: layoutMargins.leadingAnchor),
            amountTextField.trailingAnchor.constraint(equalTo: layoutMargins.trailingAnchor),
            
            // Currency Selector
            currencySegmentedControl.topAnchor.constraint(equalTo: amountTextField.bottomAnchor, constant: 16),
            currencySegmentedControl.leadingAnchor.constraint(equalTo: layoutMargins.leadingAnchor),
            currencySegmentedControl.trailingAnchor.constraint(equalTo: layoutMargins.trailingAnchor),
            
            // Payment Methods
            paymentMethodCollectionView.topAnchor.constraint(equalTo: currencySegmentedControl.bottomAnchor, constant: 24),
            paymentMethodCollectionView.leadingAnchor.constraint(equalTo: layoutMargins.leadingAnchor),
            paymentMethodCollectionView.trailingAnchor.constraint(equalTo: layoutMargins.trailingAnchor),
            paymentMethodCollectionView.heightAnchor.constraint(equalToConstant: 100),
            
            // Anonymous Switch
            anonymousSwitch.topAnchor.constraint(equalTo: paymentMethodCollectionView.bottomAnchor, constant: 24),
            isRTL ? anonymousSwitch.leadingAnchor.constraint(equalTo: layoutMargins.leadingAnchor) :
                    anonymousSwitch.trailingAnchor.constraint(equalTo: layoutMargins.trailingAnchor),
            
            // Recurring Switch
            recurringSwitch.topAnchor.constraint(equalTo: anonymousSwitch.bottomAnchor, constant: 16),
            isRTL ? recurringSwitch.leadingAnchor.constraint(equalTo: layoutMargins.leadingAnchor) :
                    recurringSwitch.trailingAnchor.constraint(equalTo: layoutMargins.trailingAnchor),
            
            // Dedication TextField
            dedicationTextField.topAnchor.constraint(equalTo: recurringSwitch.bottomAnchor, constant: 24),
            dedicationTextField.leadingAnchor.constraint(equalTo: layoutMargins.leadingAnchor),
            dedicationTextField.trailingAnchor.constraint(equalTo: layoutMargins.trailingAnchor),
            
            // Submit Button
            submitButton.bottomAnchor.constraint(equalTo: layoutMargins.bottomAnchor, constant: -24),
            submitButton.leadingAnchor.constraint(equalTo: layoutMargins.leadingAnchor),
            submitButton.trailingAnchor.constraint(equalTo: layoutMargins.trailingAnchor),
            
            // Loading Indicator
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            
            // Error Banner
            errorBanner.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            errorBanner.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            errorBanner.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }
    
    private func bindViewModel() {
        let input = DonationFormViewModel.Input(
            amountSubject: amountSubject,
            currencySubject: currencySubject,
            paymentMethodSubject: paymentMethodSubject,
            isAnonymousSubject: isAnonymousSubject,
            isRecurringSubject: isRecurringSubject,
            dedicationSubject: dedicationSubject,
            submitTrigger: submitTrigger,
            cancelTrigger: cancelTrigger
        )
        
        let output = viewModel.transform(input: input)
        
        // Bind validation state
        output.isValid
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isValid in
                self?.submitButton.isEnabled = isValid
            }
            .store(in: &cancellables)
        
        // Bind loading state
        output.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        // Bind validation errors
        output.validationErrors
            .receive(on: DispatchQueue.main)
            .sink { [weak self] errors in
                self?.handleValidationErrors(errors)
            }
            .store(in: &cancellables)
        
        // Bind donation result
        output.donationResult
            .receive(on: DispatchQueue.main)
            .sink { [weak self] result in
                self?.handleDonationResult(result)
            }
            .store(in: &cancellables)
    }
    
    private func setupAccessibility() {
        // Configure accessibility labels
        amountTextField.accessibilityLabel = "Donation amount".localized
        currencySegmentedControl.accessibilityLabel = "Select currency".localized
        anonymousSwitch.accessibilityLabel = "Make donation anonymous".localized
        recurringSwitch.accessibilityLabel = "Make recurring donation".localized
        dedicationTextField.accessibilityLabel = "Dedication message".localized
        
        // Configure accessibility hints
        amountTextField.accessibilityHint = "Enter the amount you wish to donate".localized
        currencySegmentedControl.accessibilityHint = "Select the currency for your donation".localized
        anonymousSwitch.accessibilityHint = "Toggle to make your donation anonymous".localized
        recurringSwitch.accessibilityHint = "Toggle to make this a recurring monthly donation".localized
        
        // Configure accessibility traits
        submitButton.accessibilityTraits = .button
        anonymousSwitch.accessibilityTraits = .button
        recurringSwitch.accessibilityTraits = .button
    }
    
    // MARK: - Private Methods
    
    private func updateLoadingState(_ isLoading: Bool) {
        submitButton.setLoading(isLoading)
        view.isUserInteractionEnabled = !isLoading
        
        if isLoading {
            loadingIndicator.startAnimating()
        } else {
            loadingIndicator.stopAnimating()
        }
    }
    
    private func handleValidationErrors(_ errors: [ValidationError]) {
        guard !errors.isEmpty else {
            errorBanner.hide()
            return
        }
        
        let errorMessage = errors.map { $0.localizedDescription }.joined(separator: "\n")
        errorBanner.show(message: errorMessage)
    }
    
    private func handleDonationResult(_ result: Result<Donation, Error>) {
        switch result {
        case .success(let donation):
            // Show success and dismiss
            let message = String(format: "Thank you for your donation of %@".localized,
                               donation.amount.formatAsCurrency(currencyCode: donation.currency))
            showSuccessAlert(message: message)
            
        case .failure(let error):
            // Show error
            errorBanner.show(message: error.localizedDescription)
        }
    }
    
    private func showSuccessAlert(message: String) {
        let alert = UIAlertController(
            title: "Donation Successful".localized,
            message: message,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "OK".localized, style: .default) { [weak self] _ in
            self?.dismiss(animated: true)
        })
        
        present(alert, animated: true)
    }
    
    // MARK: - Actions
    
    @objc private func cancelTapped() {
        cancelTrigger.send()
        dismiss(animated: true)
    }
}

// MARK: - UICollectionViewDataSource

extension DonationFormViewController: UICollectionViewDataSource {
    func collectionView(_ collectionView: UICollectionView, numberOfItemsInSection section: Int) -> Int {
        return PaymentMethodType.allCases.count
    }
    
    func collectionView(_ collectionView: UICollectionView, cellForItemAt indexPath: IndexPath) -> UICollectionViewCell {
        // Implementation would configure payment method cell
        return UICollectionViewCell()
    }
}

// MARK: - UICollectionViewDelegate

extension DonationFormViewController: UICollectionViewDelegate {
    func collectionView(_ collectionView: UICollectionView, didSelectItemAt indexPath: IndexPath) {
        guard let paymentMethod = PaymentMethodType.allCases[safe: indexPath.item] else { return }
        paymentMethodSubject.send(paymentMethod)
    }
}