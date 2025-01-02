//
// TwoFactorViewController.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import UIKit
import Combine

@available(iOS 13.0, *)
final class TwoFactorViewController: UIViewController {
    
    // MARK: - Constants
    
    private let CodeLength: Int = 6
    private let ResendTimeout: TimeInterval = 30.0
    private let SessionTimeout: TimeInterval = 300.0
    
    // MARK: - Properties
    
    private let viewModel: TwoFactorViewModel
    private var cancellables = Set<AnyCancellable>()
    private var sessionTimer: Timer?
    private var resendTimer: Timer?
    
    // MARK: - UI Components
    
    private lazy var titleLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .title2)
        label.textColor = .textPrimary
        label.text = "Two-Factor Authentication".localized
        label.textAlignment = .center
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private lazy var descriptionLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .body)
        label.textColor = .textSecondary
        label.text = "Enter the verification code sent to your device".localized
        label.textAlignment = .center
        label.numberOfLines = 0
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private lazy var codeTextField: CustomTextField = {
        let textField = CustomTextField(type: .general)
        textField.placeholder = "Enter code".localized
        textField.keyboardType = .numberPad
        textField.textContentType = .oneTimeCode
        textField.accessibilityLabel = "Verification code input".localized
        textField.accessibilityHint = "Enter the 6-digit code sent to your device".localized
        return textField
    }()
    
    private lazy var verifyButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .large)
        button.setTitle("Verify".localized, for: .normal)
        button.accessibilityLabel = "Verify code".localized
        return button
    }()
    
    private lazy var resendButton: CustomButton = {
        let button = CustomButton(style: .text, size: .medium)
        button.setTitle("Resend Code".localized, for: .normal)
        button.accessibilityLabel = "Resend verification code".localized
        return button
    }()
    
    private lazy var errorLabel: UILabel = {
        let label = UILabel()
        label.font = .preferredFont(forTextStyle: .footnote)
        label.textColor = .error
        label.textAlignment = .center
        label.numberOfLines = 0
        label.isHidden = true
        label.adjustsFontForContentSizeCategory = true
        return label
    }()
    
    private lazy var activityIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        return indicator
    }()
    
    // MARK: - Initialization
    
    init(viewModel: TwoFactorViewModel) {
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
        startSessionTimer()
        
        // Configure keyboard handling
        setupKeyboardHandling()
        
        // Configure navigation
        navigationItem.hidesBackButton = true
        
        // Configure accessibility
        view.semanticContentAttribute = .unspecified
        setupAccessibility()
    }
    
    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sessionTimer?.invalidate()
        resendTimer?.invalidate()
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .background
        
        let stackView = UIStackView(arrangedSubviews: [
            titleLabel,
            descriptionLabel,
            codeTextField,
            verifyButton,
            resendButton,
            errorLabel
        ])
        
        stackView.axis = .vertical
        stackView.spacing = 16
        stackView.alignment = .center
        stackView.translatesAutoresizingMaskIntoConstraints = false
        
        view.addSubview(stackView)
        view.addSubview(activityIndicator)
        
        NSLayoutConstraint.activate([
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            stackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            stackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            
            codeTextField.heightAnchor.constraint(equalToConstant: 56),
            codeTextField.widthAnchor.constraint(equalTo: stackView.widthAnchor),
            
            verifyButton.widthAnchor.constraint(equalTo: stackView.widthAnchor),
            
            activityIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            activityIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
    }
    
    private func bindViewModel() {
        // Bind code text field changes
        codeTextField.textPublisher
            .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
            .sink { [weak self] code in
                self?.viewModel.transform(input: .submitCode(code))
            }
            .store(in: &cancellables)
        
        // Bind verify button tap
        verifyButton.publisher(for: .touchUpInside)
            .throttle(for: .seconds(1), scheduler: DispatchQueue.main, latest: false)
            .sink { [weak self] _ in
                guard let code = self?.codeTextField.text else { return }
                self?.viewModel.transform(input: .submitCode(code))
            }
            .store(in: &cancellables)
        
        // Bind resend button tap
        resendButton.publisher(for: .touchUpInside)
            .throttle(for: .seconds(1), scheduler: DispatchQueue.main, latest: false)
            .sink { [weak self] _ in
                self?.viewModel.transform(input: .requestNewCode)
                self?.startResendTimer()
            }
            .store(in: &cancellables)
        
        // Handle view model outputs
        viewModel.transform(input: .resetAttempts)
            .sink { [weak self] output in
                self?.handleViewModelOutput(output)
            }
            .store(in: &cancellables)
    }
    
    private func handleViewModelOutput(_ output: TwoFactorViewModel.Output) {
        switch output {
        case .isLoading(let loading):
            loading ? activityIndicator.startAnimating() : activityIndicator.stopAnimating()
            verifyButton.setLoading(loading)
            codeTextField.isEnabled = !loading
            
        case .verificationSuccess:
            dismiss(animated: true)
            
        case .error(let error):
            showError(error.errorDescription ?? "Verification failed".localized)
            
        case .attemptsRemaining(let attempts):
            if attempts > 0 {
                descriptionLabel.text = String(format: "Attempts remaining: %d".localized, attempts)
            }
            
        case .isRateLimited(let limited):
            resendButton.isEnabled = !limited
            
        case .timeoutDuration(let duration):
            updateResendButtonTitle(with: duration)
        }
    }
    
    // MARK: - Helper Methods
    
    private func setupAccessibility() {
        view.accessibilityViewIsModal = true
        
        titleLabel.accessibilityTraits = .header
        descriptionLabel.accessibilityTraits = .staticText
        
        verifyButton.accessibilityHint = "Double tap to verify the code".localized
        resendButton.accessibilityHint = "Double tap to request a new code".localized
    }
    
    private func setupKeyboardHandling() {
        NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
            .sink { [weak self] notification in
                self?.adjustForKeyboard(notification: notification)
            }
            .store(in: &cancellables)
        
        NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)
            .sink { [weak self] notification in
                self?.adjustForKeyboard(notification: notification)
            }
            .store(in: &cancellables)
    }
    
    private func adjustForKeyboard(notification: Notification) {
        guard let keyboardValue = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else { return }
        
        let keyboardFrame = keyboardValue.cgRectValue
        let isKeyboardShowing = notification.name == UIResponder.keyboardWillShowNotification
        
        let adjustmentHeight = isKeyboardShowing ? -keyboardFrame.height / 2 : 0
        view.transform = CGAffineTransform(translationX: 0, y: adjustmentHeight)
    }
    
    private func showError(_ message: String) {
        errorLabel.text = message
        errorLabel.isHidden = false
        
        UIAccessibility.post(notification: .announcement, argument: message)
        
        codeTextField.shake()
    }
    
    private func startSessionTimer() {
        sessionTimer = Timer.scheduledTimer(withTimeInterval: SessionTimeout, repeats: false) { [weak self] _ in
            self?.viewModel.transform(input: .resetAttempts)
            self?.dismiss(animated: true)
        }
    }
    
    private func startResendTimer() {
        var timeRemaining = ResendTimeout
        
        resendTimer?.invalidate()
        resendTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] timer in
            timeRemaining -= 1
            if timeRemaining <= 0 {
                timer.invalidate()
                self?.resendButton.isEnabled = true
                self?.resendButton.setTitle("Resend Code".localized, for: .normal)
            } else {
                self?.updateResendButtonTitle(with: timeRemaining)
            }
        }
    }
    
    private func updateResendButtonTitle(with timeRemaining: TimeInterval) {
        let title = String(format: "Resend Code (%d)".localized, Int(ceil(timeRemaining)))
        resendButton.setTitle(title, for: .normal)
        resendButton.isEnabled = false
    }
}