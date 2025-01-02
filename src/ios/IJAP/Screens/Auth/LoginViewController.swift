//
// LoginViewController.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import UIKit // iOS 13.0+
import Combine // iOS 13.0+
import LocalAuthentication // iOS 13.0+

@available(iOS 13.0, *)
final class LoginViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let viewModel: LoginViewModel
    private var cancellables = Set<AnyCancellable>()
    private let securityUtils: SecurityUtils
    
    // MARK: - UI Components
    
    private lazy var emailTextField: CustomTextField = {
        let textField = CustomTextField(type: .email)
        textField.placeholder = "Email".localized
        textField.returnKeyType = .next
        textField.accessibilityIdentifier = "LoginView.EmailTextField"
        return textField
    }()
    
    private lazy var passwordTextField: CustomTextField = {
        let textField = CustomTextField(type: .password)
        textField.placeholder = "Password".localized
        textField.returnKeyType = .done
        textField.accessibilityIdentifier = "LoginView.PasswordTextField"
        return textField
    }()
    
    private lazy var loginButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .large)
        button.setTitle("Sign In".localized, for: .normal)
        button.accessibilityIdentifier = "LoginView.LoginButton"
        return button
    }()
    
    private lazy var biometricButton: CustomButton = {
        let button = CustomButton(style: .outline, size: .medium)
        button.setTitle("Use Biometrics".localized, for: .normal)
        button.accessibilityIdentifier = "LoginView.BiometricButton"
        button.isHidden = true
        return button
    }()
    
    private lazy var errorLabel: UILabel = {
        let label = UILabel()
        label.textColor = .error
        label.font = .preferredFont(forTextStyle: .subheadline)
        label.numberOfLines = 0
        label.textAlignment = .center
        label.isHidden = true
        label.accessibilityIdentifier = "LoginView.ErrorLabel"
        return label
    }()
    
    private lazy var stackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.distribution = .fill
        stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    // MARK: - Initialization
    
    init() {
        self.viewModel = LoginViewModel()
        self.securityUtils = SecurityUtils()
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
        validateDeviceSecurity()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationController?.setNavigationBarHidden(true, animated: animated)
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        view.backgroundColor = .background
        
        // Add subviews
        view.addSubview(stackView)
        
        [emailTextField, passwordTextField, errorLabel, loginButton, biometricButton].forEach {
            stackView.addArrangedSubview($0)
        }
        
        // Setup constraints with safe area and layout margins
        NSLayoutConstraint.activate([
            stackView.leadingAnchor.constraint(equalTo: view.layoutMarginsGuide.leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: view.layoutMarginsGuide.trailingAnchor),
            stackView.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        // Configure RTL support
        if UIView.userInterfaceLayoutDirection(for: view.semanticContentAttribute) == .rightToLeft {
            stackView.semanticContentAttribute = .forceRightToLeft
            emailTextField.textAlignment = .right
            passwordTextField.textAlignment = .right
        }
    }
    
    private func setupBindings() {
        // Input bindings
        let input = PassthroughSubject<LoginViewModel.Input, Never>()
        
        emailTextField.textPublisher
            .map { LoginViewModel.Input.emailChanged($0) }
            .subscribe(input)
            .store(in: &cancellables)
        
        passwordTextField.textPublisher
            .map { LoginViewModel.Input.passwordChanged($0) }
            .subscribe(input)
            .store(in: &cancellables)
        
        loginButton.publisher(for: .touchUpInside)
            .map { LoginViewModel.Input.loginTapped }
            .subscribe(input)
            .store(in: &cancellables)
        
        biometricButton.publisher(for: .touchUpInside)
            .map { LoginViewModel.Input.biometricLoginTapped }
            .subscribe(input)
            .store(in: &cancellables)
        
        // Output bindings
        viewModel.transform(input: input.eraseToAnyPublisher())
            .receive(on: DispatchQueue.main)
            .sink { [weak self] output in
                self?.handleOutput(output)
            }
            .store(in: &cancellables)
    }
    
    private func handleOutput(_ output: LoginViewModel.Output) {
        switch output {
        case .isLoading(let isLoading):
            loginButton.setLoading(isLoading)
            biometricButton.setLoading(isLoading)
            view.isUserInteractionEnabled = !isLoading
            
        case .validationError(let error):
            errorLabel.text = error?.localizedDescription
            errorLabel.isHidden = error == nil
            UIAccessibility.post(notification: .announcement, argument: error?.localizedDescription)
            
        case .loginSuccess(let user):
            // Handle successful login
            NotificationCenter.default.post(name: .userDidLogin, object: user)
            
        case .loginFailure(let error):
            showError(message: error.localizedDescription)
            
        case .biometricAvailable(let isAvailable):
            biometricButton.isHidden = !isAvailable
            
        case .securityCheckFailed:
            showSecurityAlert()
        }
    }
    
    private func setupAccessibility() {
        // Configure accessibility labels and hints
        emailTextField.accessibilityLabel = "Email address".localized
        emailTextField.accessibilityHint = "Enter your email address to sign in".localized
        
        passwordTextField.accessibilityLabel = "Password".localized
        passwordTextField.accessibilityHint = "Enter your password to sign in".localized
        
        loginButton.accessibilityLabel = "Sign in".localized
        loginButton.accessibilityHint = "Double tap to sign in to your account".localized
        
        biometricButton.accessibilityLabel = "Use biometric authentication".localized
        biometricButton.accessibilityHint = "Double tap to sign in with Face ID or Touch ID".localized
        
        // Configure accessibility grouping
        stackView.accessibilityElements = [emailTextField, passwordTextField, errorLabel, loginButton, biometricButton]
    }
    
    private func validateDeviceSecurity() {
        guard SecurityUtils.validateDeviceIntegrity() else {
            showSecurityAlert()
            return
        }
    }
    
    private func showError(message: String) {
        errorLabel.text = message
        errorLabel.isHidden = false
        errorLabel.shake()
        
        // Announce error for VoiceOver
        UIAccessibility.post(notification: .announcement, argument: message)
    }
    
    private func showSecurityAlert() {
        let alert = UIAlertController(
            title: "Security Warning".localized,
            message: "This device appears to be compromised. For your security, please use a different device.".localized,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(title: "OK".localized, style: .default) { [weak self] _ in
            self?.dismiss(animated: true)
        })
        
        present(alert, animated: true)
    }
}

// MARK: - UITextFieldDelegate

extension LoginViewController: UITextFieldDelegate {
    func textFieldShouldReturn(_ textField: UITextField) -> Bool {
        switch textField {
        case emailTextField:
            passwordTextField.becomeFirstResponder()
        case passwordTextField:
            textField.resignFirstResponder()
            loginButton.sendActions(for: .touchUpInside)
        default:
            break
        }
        return true
    }
}

// MARK: - Notification Names

extension Notification.Name {
    static let userDidLogin = Notification.Name("IJAPUserDidLoginNotification")
}