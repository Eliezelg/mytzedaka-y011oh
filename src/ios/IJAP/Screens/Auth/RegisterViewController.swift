//
// RegisterViewController.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import UIKit
import Combine

@available(iOS 13.0, *)
final class RegisterViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel = RegisterViewModel()
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private let formStackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.distribution = .fill
        stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    private let emailTextField: CustomTextField = {
        let field = CustomTextField(type: .email)
        field.placeholder = "registration.email.placeholder".localized
        field.accessibilityIdentifier = "RegisterView.EmailTextField"
        return field
    }()
    
    private let passwordTextField: CustomTextField = {
        let field = CustomTextField(type: .password)
        field.placeholder = "registration.password.placeholder".localized
        field.accessibilityIdentifier = "RegisterView.PasswordTextField"
        return field
    }()
    
    private let confirmPasswordTextField: CustomTextField = {
        let field = CustomTextField(type: .password)
        field.placeholder = "registration.confirm_password.placeholder".localized
        field.accessibilityIdentifier = "RegisterView.ConfirmPasswordTextField"
        return field
    }()
    
    private let firstNameTextField: CustomTextField = {
        let field = CustomTextField(type: .general)
        field.placeholder = "registration.first_name.placeholder".localized
        field.accessibilityIdentifier = "RegisterView.FirstNameTextField"
        return field
    }()
    
    private let lastNameTextField: CustomTextField = {
        let field = CustomTextField(type: .general)
        field.placeholder = "registration.last_name.placeholder".localized
        field.accessibilityIdentifier = "RegisterView.LastNameTextField"
        return field
    }()
    
    private let registerButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("registration.button.register".localized, for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.backgroundColor = .systemBlue
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 8
        button.accessibilityIdentifier = "RegisterView.RegisterButton"
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private let loadingView = LoadingView()
    private var keyboardConstraint: NSLayoutConstraint?
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupAccessibility()
        setupBindings()
        setupKeyboardHandling()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        navigationItem.title = "registration.title".localized
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Add subviews
        view.addSubview(formStackView)
        view.addSubview(registerButton)
        view.addSubview(loadingView)
        
        // Add form fields
        [emailTextField, passwordTextField, confirmPasswordTextField,
         firstNameTextField, lastNameTextField].forEach {
            formStackView.addArrangedSubview($0)
        }
        
        // Setup constraints
        NSLayoutConstraint.activate([
            formStackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            formStackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            formStackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            
            registerButton.heightAnchor.constraint(equalToConstant: 50),
            registerButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            registerButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            registerButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24)
        ])
        
        // Setup RTL support
        if UIView.userInterfaceLayoutDirection(for: view.semanticContentAttribute) == .rightToLeft {
            formStackView.semanticContentAttribute = .forceRightToLeft
            [emailTextField, passwordTextField, confirmPasswordTextField,
             firstNameTextField, lastNameTextField].forEach {
                $0.textAlignment = .right
                $0.semanticContentAttribute = .forceRightToLeft
            }
        }
    }
    
    private func setupAccessibility() {
        // Configure accessibility labels and hints
        emailTextField.accessibilityLabel = "registration.email.accessibility_label".localized
        emailTextField.accessibilityHint = "registration.email.accessibility_hint".localized
        
        passwordTextField.accessibilityLabel = "registration.password.accessibility_label".localized
        passwordTextField.accessibilityHint = "registration.password.accessibility_hint".localized
        
        confirmPasswordTextField.accessibilityLabel = "registration.confirm_password.accessibility_label".localized
        confirmPasswordTextField.accessibilityHint = "registration.confirm_password.accessibility_hint".localized
        
        firstNameTextField.accessibilityLabel = "registration.first_name.accessibility_label".localized
        firstNameTextField.accessibilityHint = "registration.first_name.accessibility_hint".localized
        
        lastNameTextField.accessibilityLabel = "registration.last_name.accessibility_label".localized
        lastNameTextField.accessibilityHint = "registration.last_name.accessibility_hint".localized
        
        registerButton.accessibilityLabel = "registration.button.accessibility_label".localized
        registerButton.accessibilityTraits = .button
    }
    
    private func setupBindings() {
        // Bind text fields to view model
        emailTextField.textPublisher
            .sink { [weak self] text in
                self?.viewModel.emailSubject.send(text ?? "")
            }
            .store(in: &cancellables)
        
        passwordTextField.textPublisher
            .sink { [weak self] text in
                self?.viewModel.passwordSubject.send(text ?? "")
            }
            .store(in: &cancellables)
        
        confirmPasswordTextField.textPublisher
            .sink { [weak self] text in
                self?.viewModel.confirmPasswordSubject.send(text ?? "")
            }
            .store(in: &cancellables)
        
        // Bind validation state
        viewModel.validationState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleValidationState(state)
            }
            .store(in: &cancellables)
        
        // Bind registration result
        viewModel.registrationResult
            .receive(on: DispatchQueue.main)
            .sink { [weak self] result in
                self?.handleRegistrationResult(result)
            }
            .store(in: &cancellables)
        
        // Bind button action
        registerButton.addTarget(self, action: #selector(registerButtonTapped), for: .touchUpInside)
    }
    
    private func setupKeyboardHandling() {
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillShow),
                                             name: UIResponder.keyboardWillShowNotification, object: nil)
        NotificationCenter.default.addObserver(self, selector: #selector(keyboardWillHide),
                                             name: UIResponder.keyboardWillHideNotification, object: nil)
    }
    
    // MARK: - Event Handlers
    
    @objc private func registerButtonTapped() {
        view.endEditing(true)
        loadingView.show(message: "registration.loading.message".localized)
        viewModel.submitRegistration()
    }
    
    @objc private func keyboardWillShow(_ notification: Notification) {
        guard let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
        let keyboardHeight = keyboardFrame.height
        
        UIView.animate(withDuration: 0.3) {
            self.keyboardConstraint?.constant = -keyboardHeight
            self.view.layoutIfNeeded()
        }
    }
    
    @objc private func keyboardWillHide(_ notification: Notification) {
        UIView.animate(withDuration: 0.3) {
            self.keyboardConstraint?.constant = 0
            self.view.layoutIfNeeded()
        }
    }
    
    // MARK: - Private Methods
    
    private func handleValidationState(_ state: ValidationState) {
        switch state {
        case .invalid(let errors):
            registerButton.isEnabled = false
            registerButton.alpha = 0.5
            
            errors.forEach { field, message in
                switch field {
                case "email": emailTextField.showError(message: message)
                case "password": passwordTextField.showError(message: message)
                case "confirmPassword": confirmPasswordTextField.showError(message: message)
                case "firstName": firstNameTextField.showError(message: message)
                case "lastName": lastNameTextField.showError(message: message)
                default: break
                }
            }
            
        case .valid:
            registerButton.isEnabled = true
            registerButton.alpha = 1.0
            [emailTextField, passwordTextField, confirmPasswordTextField,
             firstNameTextField, lastNameTextField].forEach { $0.clearError() }
            
        default:
            break
        }
    }
    
    private func handleRegistrationResult(_ result: Result<User, Error>) {
        loadingView.hide()
        
        switch result {
        case .success(let user):
            // Post success notification for VoiceOver
            UIAccessibility.post(notification: .announcement,
                               argument: "registration.success.message".localized)
            
            // Navigate to next screen
            navigateToNextScreen(user: user)
            
        case .failure(let error):
            let alert = UIAlertController(
                title: "registration.error.title".localized,
                message: error.localizedDescription,
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "common.ok".localized, style: .default))
            present(alert, animated: true)
            
            // Post error notification for VoiceOver
            UIAccessibility.post(notification: .announcement,
                               argument: error.localizedDescription)
        }
    }
    
    private func navigateToNextScreen(user: User) {
        // Implementation for navigation after successful registration
    }
}