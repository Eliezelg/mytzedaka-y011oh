//
// ProfileEditViewController.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import UIKit // iOS 13.0+
import Combine // iOS 13.0+

/// View controller responsible for handling profile editing functionality with comprehensive validation,
/// accessibility support, and RTL layout adaptation.
@available(iOS 13.0, *)
@objc
final class ProfileEditViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let viewModel: ProfileEditViewModel
    private var cancellables = Set<AnyCancellable>()
    
    private lazy var formStackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 16
        stack.distribution = .fill
        stack.alignment = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    private lazy var firstNameTextField: CustomTextField = {
        let field = CustomTextField(type: .general)
        field.placeholder = "First Name".localized
        field.accessibilityIdentifier = "ProfileEdit.FirstName"
        return field
    }()
    
    private lazy var lastNameTextField: CustomTextField = {
        let field = CustomTextField(type: .general)
        field.placeholder = "Last Name".localized
        field.accessibilityIdentifier = "ProfileEdit.LastName"
        return field
    }()
    
    private lazy var phoneNumberTextField: CustomTextField = {
        let field = CustomTextField(type: .phone)
        field.placeholder = "Phone Number (Optional)".localized
        field.accessibilityIdentifier = "ProfileEdit.Phone"
        return field
    }()
    
    private lazy var languageSelector: UISegmentedControl = {
        let items = LocalizationKeys.supportedLanguages.map { $0.rawValue.uppercased() }
        let control = UISegmentedControl(items: items)
        control.accessibilityIdentifier = "ProfileEdit.Language"
        return control
    }()
    
    private lazy var saveButton: UIButton = {
        let button = UIButton(type: .system)
        button.setTitle("Save Changes".localized, for: .normal)
        button.titleLabel?.font = .preferredFont(forTextStyle: .headline)
        button.backgroundColor = .systemBlue
        button.setTitleColor(.white, for: .normal)
        button.layer.cornerRadius = 8
        button.accessibilityIdentifier = "ProfileEdit.Save"
        return button
    }()
    
    private lazy var loadingView: LoadingView = {
        let view = LoadingView()
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    // MARK: - Initialization
    
    init(viewModel: ProfileEditViewModel) {
        self.viewModel = viewModel
        super.init(nibName: nil, bundle: nil)
        
        // Configure RTL support
        if UIView.userInterfaceLayoutDirection(for: view.semanticContentAttribute) == .rightToLeft {
            view.semanticContentAttribute = .forceRightToLeft
        }
    }
    
    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        bindViewModel()
        setupKeyboardHandling()
    }
    
    // MARK: - Private Methods
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        
        // Configure navigation bar
        title = "Edit Profile".localized
        navigationItem.largeTitleDisplayMode = .never
        
        // Add subviews
        view.addSubview(formStackView)
        view.addSubview(loadingView)
        
        formStackView.addArrangedSubview(firstNameTextField)
        formStackView.addArrangedSubview(lastNameTextField)
        formStackView.addArrangedSubview(phoneNumberTextField)
        formStackView.addArrangedSubview(languageSelector)
        formStackView.addArrangedSubview(saveButton)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            formStackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            formStackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            formStackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            
            saveButton.heightAnchor.constraint(equalToConstant: 48),
            
            loadingView.topAnchor.constraint(equalTo: view.topAnchor),
            loadingView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            loadingView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            loadingView.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        
        // Configure accessibility
        setupAccessibility()
    }
    
    private func bindViewModel() {
        // Create input streams
        let firstNameInput = NotificationCenter.default
            .publisher(for: UITextField.textDidChangeNotification, object: firstNameTextField)
            .compactMap { ($0.object as? UITextField)?.text }
            .eraseToAnyPublisher()
        
        let lastNameInput = NotificationCenter.default
            .publisher(for: UITextField.textDidChangeNotification, object: lastNameTextField)
            .compactMap { ($0.object as? UITextField)?.text }
            .eraseToAnyPublisher()
        
        let phoneInput = NotificationCenter.default
            .publisher(for: UITextField.textDidChangeNotification, object: phoneNumberTextField)
            .compactMap { ($0.object as? UITextField)?.text }
            .eraseToAnyPublisher()
        
        let languageInput = languageSelector.publisher(for: \.selectedSegmentIndex)
            .map { LocalizationKeys.supportedLanguages[$0] }
            .eraseToAnyPublisher()
        
        let saveInput = saveButton.publisher(for: .touchUpInside)
            .map { _ in () }
            .eraseToAnyPublisher()
        
        // Create input object
        let input = ProfileEditViewModel.Input(
            firstName: firstNameInput,
            lastName: lastNameInput,
            phoneNumber: phoneInput,
            language: languageInput,
            saveButtonTapped: saveInput
        )
        
        // Transform and bind outputs
        let output = viewModel.transform(input: input)
        
        output.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                if isLoading {
                    self?.loadingView.show(message: "Saving changes...".localized)
                } else {
                    self?.loadingView.hide()
                }
            }
            .store(in: &cancellables)
        
        output.validationState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.handleValidationState(state)
            }
            .store(in: &cancellables)
        
        output.saveEnabled
            .receive(on: DispatchQueue.main)
            .assign(to: \.isEnabled, on: saveButton)
            .store(in: &cancellables)
        
        output.error
            .receive(on: DispatchQueue.main)
            .sink { [weak self] error in
                if let error = error {
                    self?.showError(error)
                }
            }
            .store(in: &cancellables)
        
        output.saveSuccessful
            .receive(on: DispatchQueue.main)
            .sink { [weak self] in
                self?.handleSaveSuccess()
            }
            .store(in: &cancellables)
    }
    
    private func setupAccessibility() {
        firstNameTextField.accessibilityLabel = "First Name".localized
        firstNameTextField.accessibilityHint = "Enter your first name".localized
        
        lastNameTextField.accessibilityLabel = "Last Name".localized
        lastNameTextField.accessibilityHint = "Enter your last name".localized
        
        phoneNumberTextField.accessibilityLabel = "Phone Number".localized
        phoneNumberTextField.accessibilityHint = "Enter your phone number (optional)".localized
        
        languageSelector.accessibilityLabel = "Preferred Language".localized
        languageSelector.accessibilityHint = "Select your preferred language".localized
        
        saveButton.accessibilityLabel = "Save Changes".localized
        saveButton.accessibilityHint = "Save your profile changes".localized
    }
    
    private func setupKeyboardHandling() {
        let tap = UITapGestureRecognizer(target: self, action: #selector(dismissKeyboard))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
        
        NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
            .merge(with: NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification))
            .receive(on: DispatchQueue.main)
            .sink { [weak self] notification in
                self?.handleKeyboardNotification(notification)
            }
            .store(in: &cancellables)
    }
    
    private func handleValidationState(_ state: ProfileEditViewModel.ValidationState) {
        if let error = state.firstNameError {
            firstNameTextField.showError(message: error)
        } else {
            firstNameTextField.clearError()
        }
        
        if let error = state.lastNameError {
            lastNameTextField.showError(message: error)
        } else {
            lastNameTextField.clearError()
        }
        
        if let error = state.phoneNumberError {
            phoneNumberTextField.showError(message: error)
        } else {
            phoneNumberTextField.clearError()
        }
    }
    
    private func handleSaveSuccess() {
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.success)
        
        navigationController?.popViewController(animated: true)
    }
    
    private func showError(_ error: LocalizedError) {
        let alert = UIAlertController(
            title: "Error".localized,
            message: error.localizedDescription,
            preferredStyle: .alert
        )
        alert.addAction(UIAlertAction(title: "OK".localized, style: .default))
        present(alert, animated: true)
    }
    
    @objc private func dismissKeyboard() {
        view.endEditing(true)
    }
    
    private func handleKeyboardNotification(_ notification: Notification) {
        guard let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else {
            return
        }
        
        let keyboardHeight = notification.name == UIResponder.keyboardWillShowNotification ? keyboardFrame.height : 0
        let duration = notification.userInfo?[UIResponder.keyboardAnimationDurationUserInfoKey] as? TimeInterval ?? 0.3
        
        UIView.animate(withDuration: duration) {
            self.additionalSafeAreaInsets.bottom = keyboardHeight
            self.view.layoutIfNeeded()
        }
    }
}