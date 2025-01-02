//
// ProfileViewController.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import UIKit // iOS 13.0+
import Combine // iOS 13.0+

@available(iOS 13.0, *)
final class ProfileViewController: UIViewController {
    
    // MARK: - Properties
    
    private let viewModel: ProfileViewModel
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - UI Components
    
    private lazy var scrollView: UIScrollView = {
        let scrollView = UIScrollView()
        scrollView.translatesAutoresizingMaskIntoConstraints = false
        scrollView.keyboardDismissMode = .interactive
        return scrollView
    }()
    
    private lazy var contentStackView: UIStackView = {
        let stack = UIStackView()
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.spacing = 24
        stack.layoutMargins = UIEdgeInsets(top: 24, left: 24, bottom: 24, right: 24)
        stack.isLayoutMarginsRelativeArrangement = true
        return stack
    }()
    
    private lazy var nameTextField: UITextField = {
        let textField = UITextField()
        textField.borderStyle = .roundedRect
        textField.font = .preferredFont(forTextStyle: .body)
        textField.adjustsFontForContentSizeCategory = true
        textField.accessibilityIdentifier = "ProfileView.NameTextField"
        return textField
    }()
    
    private lazy var phoneTextField: UITextField = {
        let textField = UITextField()
        textField.borderStyle = .roundedRect
        textField.font = .preferredFont(forTextStyle: .body)
        textField.adjustsFontForContentSizeCategory = true
        textField.keyboardType = .phonePad
        textField.accessibilityIdentifier = "ProfileView.PhoneTextField"
        return textField
    }()
    
    private lazy var languageSegmentedControl: UISegmentedControl = {
        let items = ["English", "Hebrew", "French"]
        let control = UISegmentedControl(items: items)
        control.selectedSegmentIndex = 0
        control.accessibilityIdentifier = "ProfileView.LanguageControl"
        return control
    }()
    
    private lazy var twoFactorSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityIdentifier = "ProfileView.TwoFactorSwitch"
        return toggle
    }()
    
    private lazy var saveButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .large)
        button.accessibilityIdentifier = "ProfileView.SaveButton"
        return button
    }()
    
    private lazy var offlineIndicator: UIView = {
        let view = UIView()
        view.backgroundColor = .warning
        view.isHidden = true
        view.alpha = 0
        view.roundCorners(radius: 4)
        return view
    }()
    
    private lazy var errorBanner: UIView = {
        let view = UIView()
        view.backgroundColor = .error
        view.isHidden = true
        view.alpha = 0
        view.roundCorners(radius: 4)
        return view
    }()
    
    // MARK: - Initialization
    
    init(viewModel: ProfileViewModel) {
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
        setupNavigationBar()
        setupKeyboardHandling()
        updateLocalization()
    }
    
    // MARK: - Setup Methods
    
    private func setupUI() {
        view.backgroundColor = .background
        
        // Add subviews
        view.addSubview(scrollView)
        scrollView.addSubview(contentStackView)
        
        // Configure stack view content
        contentStackView.addArrangedSubview(nameTextField)
        contentStackView.addArrangedSubview(phoneTextField)
        contentStackView.addArrangedSubview(languageSegmentedControl)
        
        let twoFactorContainer = createTwoFactorContainer()
        contentStackView.addArrangedSubview(twoFactorContainer)
        contentStackView.addArrangedSubview(saveButton)
        
        view.addSubview(offlineIndicator)
        view.addSubview(errorBanner)
        
        // Configure initial button state
        saveButton.setTitle(LocaleUtils.getLocalizedString("profile.save.button"), for: .normal)
    }
    
    private func setupConstraints() {
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
            
            offlineIndicator.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            offlineIndicator.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            offlineIndicator.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            offlineIndicator.heightAnchor.constraint(equalToConstant: 44),
            
            errorBanner.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 8),
            errorBanner.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 16),
            errorBanner.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -16),
            errorBanner.heightAnchor.constraint(equalToConstant: 44)
        ])
    }
    
    private func bindViewModel() {
        // Create input streams
        let updateProfile = Publishers.CombineLatest(
            nameTextField.textPublisher,
            phoneTextField.textPublisher
        )
        .debounce(for: .milliseconds(300), scheduler: DispatchQueue.main)
        .map { name, phone in
            ProfileViewModel.ProfileUpdateData(
                firstName: name ?? "",
                lastName: "",
                phoneNumber: phone
            )
        }
        .eraseToAnyPublisher()
        
        let updateLanguage = languageSegmentedControl.selectedSegmentPublisher
            .map { index -> SupportedLanguage in
                switch index {
                case 0: return .english
                case 1: return .hebrew
                case 2: return .french
                default: return .english
                }
            }
            .eraseToAnyPublisher()
        
        let toggleTwoFactor = twoFactorSwitch.isOnPublisher
            .eraseToAnyPublisher()
        
        let input = ProfileViewModel.Input(
            updateProfile: updateProfile,
            updateLanguage: updateLanguage,
            toggleTwoFactor: toggleTwoFactor,
            syncRequest: saveButton.tapPublisher.eraseToAnyPublisher()
        )
        
        // Bind outputs
        let output = viewModel.transform(input)
        
        output.profileState
            .receive(on: DispatchQueue.main)
            .sink { [weak self] state in
                self?.updateUI(with: state)
            }
            .store(in: &cancellables)
        
        output.validationErrors
            .receive(on: DispatchQueue.main)
            .sink { [weak self] errors in
                self?.showValidationErrors(errors)
            }
            .store(in: &cancellables)
        
        output.isLoading
            .receive(on: DispatchQueue.main)
            .sink { [weak self] isLoading in
                self?.updateLoadingState(isLoading)
            }
            .store(in: &cancellables)
        
        output.offlineStatus
            .receive(on: DispatchQueue.main)
            .sink { [weak self] status in
                self?.updateOfflineStatus(status)
            }
            .store(in: &cancellables)
    }
    
    // MARK: - UI Update Methods
    
    private func updateUI(with state: ProfileViewModel.ProfileState) {
        nameTextField.text = state.user.firstName
        phoneTextField.text = state.user.phoneNumber
        
        switch state.user.preferredLanguage {
        case .english: languageSegmentedControl.selectedSegmentIndex = 0
        case .hebrew: languageSegmentedControl.selectedSegmentIndex = 1
        case .french: languageSegmentedControl.selectedSegmentIndex = 2
        }
        
        twoFactorSwitch.isOn = state.user.isTwoFactorEnabled
        
        if state.hasOfflineChanges {
            showOfflineIndicator()
        } else {
            hideOfflineIndicator()
        }
    }
    
    private func updateLoadingState(_ isLoading: Bool) {
        saveButton.setLoading(isLoading)
        nameTextField.isEnabled = !isLoading
        phoneTextField.isEnabled = !isLoading
        languageSegmentedControl.isEnabled = !isLoading
        twoFactorSwitch.isEnabled = !isLoading
    }
    
    private func updateOfflineStatus(_ status: ProfileViewModel.OfflineStatus) {
        switch status {
        case .online:
            hideOfflineIndicator()
        case .offline(let pendingChanges):
            showOfflineIndicator(pendingChanges: pendingChanges)
        }
    }
    
    private func showValidationErrors(_ errors: [ProfileViewModel.ValidationError]) {
        let message = errors.map { $0.localizedDescription }.joined(separator: "\n")
        showErrorBanner(with: message)
    }
    
    // MARK: - Helper Methods
    
    private func createTwoFactorContainer() -> UIView {
        let container = UIView()
        container.translatesAutoresizingMaskIntoConstraints = false
        
        let label = UILabel()
        label.text = LocaleUtils.getLocalizedString("profile.twoFactor.label")
        label.font = .preferredFont(forTextStyle: .body)
        label.adjustsFontForContentSizeCategory = true
        label.translatesAutoresizingMaskIntoConstraints = false
        
        container.addSubview(label)
        container.addSubview(twoFactorSwitch)
        
        NSLayoutConstraint.activate([
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            label.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            
            twoFactorSwitch.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            twoFactorSwitch.centerYAnchor.constraint(equalTo: container.centerYAnchor),
            
            container.heightAnchor.constraint(equalToConstant: 44)
        ])
        
        return container
    }
    
    private func showOfflineIndicator(pendingChanges: Int = 0) {
        offlineIndicator.isHidden = false
        UIView.animate(withDuration: 0.3) {
            self.offlineIndicator.alpha = 1
        }
    }
    
    private func hideOfflineIndicator() {
        UIView.animate(withDuration: 0.3) {
            self.offlineIndicator.alpha = 0
        } completion: { _ in
            self.offlineIndicator.isHidden = true
        }
    }
    
    private func showErrorBanner(with message: String) {
        errorBanner.isHidden = false
        UIView.animate(withDuration: 0.3) {
            self.errorBanner.alpha = 1
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
            self.hideErrorBanner()
        }
    }
    
    private func hideErrorBanner() {
        UIView.animate(withDuration: 0.3) {
            self.errorBanner.alpha = 0
        } completion: { _ in
            self.errorBanner.isHidden = true
        }
    }
}

// MARK: - Combine Extensions

private extension UITextField {
    var textPublisher: AnyPublisher<String?, Never> {
        NotificationCenter.default
            .publisher(for: UITextField.textDidChangeNotification, object: self)
            .map { ($0.object as? UITextField)?.text }
            .eraseToAnyPublisher()
    }
}

private extension UISegmentedControl {
    var selectedSegmentPublisher: AnyPublisher<Int, Never> {
        Publishers.ControlProperty(control: self, events: .valueChanged) { control in
            control.selectedSegmentIndex
        }.eraseToAnyPublisher()
    }
}

private extension UISwitch {
    var isOnPublisher: AnyPublisher<Bool, Never> {
        Publishers.ControlProperty(control: self, events: .valueChanged) { control in
            control.isOn
        }.eraseToAnyPublisher()
    }
}

private extension UIControl {
    var tapPublisher: AnyPublisher<Void, Never> {
        Publishers.ControlEvent(control: self, events: .touchUpInside)
            .eraseToAnyPublisher()
    }
}