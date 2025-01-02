// UIKit v13.0+
import UIKit
// Combine v13.0+
import Combine
// LocalAuthentication v13.0+
import LocalAuthentication

@available(iOS 13.0, *)
final class SettingsViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .insetGrouped)
        table.backgroundColor = .background
        table.separatorStyle = .singleLine
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 56
        return table
    }()
    
    private let loadingIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .large)
        indicator.hidesWhenStopped = true
        indicator.color = .primary
        return indicator
    }()
    
    private let viewModel: SettingsViewModel
    private var cancellables = Set<AnyCancellable>()
    private let biometricAuth = LAContext()
    
    // MARK: - Section Models
    
    private enum Section: Int, CaseIterable {
        case language
        case appearance
        case security
        case notifications
        
        var title: String {
            switch self {
            case .language:
                return LocaleUtils.getLocalizedString("settings.section.language")
            case .appearance:
                return LocaleUtils.getLocalizedString("settings.section.appearance")
            case .security:
                return LocaleUtils.getLocalizedString("settings.section.security")
            case .notifications:
                return LocaleUtils.getLocalizedString("settings.section.notifications")
            }
        }
    }
    
    // MARK: - Initialization
    
    init(viewModel: SettingsViewModel = SettingsViewModel()) {
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
        setupTableView()
        setupAccessibility()
        bindViewModel()
    }
    
    // MARK: - Private Setup Methods
    
    private func setupUI() {
        // Configure navigation bar
        title = LocaleUtils.getLocalizedString("settings.title")
        navigationController?.navigationBar.prefersLargeTitles = true
        
        // Configure view
        view.backgroundColor = .background
        
        // Add subviews
        view.addSubview(tableView)
        view.addSubview(loadingIndicator)
        
        // Setup constraints
        tableView.translatesAutoresizingMaskIntoConstraints = false
        loadingIndicator.translatesAutoresizingMaskIntoConstraints = false
        
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor)
        ])
        
        // Configure RTL support
        updateRTLSupport()
    }
    
    private func setupTableView() {
        tableView.delegate = self
        tableView.dataSource = self
        
        // Register cell types
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "SettingsCell")
        
        // Configure refresh control
        let refreshControl = UIRefreshControl()
        refreshControl.tintColor = .primary
        refreshControl.addTarget(self, action: #selector(refreshSettings), for: .valueChanged)
        tableView.refreshControl = refreshControl
    }
    
    private func setupAccessibility() {
        // View accessibility
        view.accessibilityIdentifier = "SettingsView"
        tableView.accessibilityIdentifier = "SettingsTableView"
        
        // Navigation accessibility
        navigationItem.accessibilityLabel = LocaleUtils.getLocalizedString("settings.accessibility.title")
        
        // Table accessibility
        tableView.accessibilityLabel = LocaleUtils.getLocalizedString("settings.accessibility.table")
    }
    
    private func bindViewModel() {
        // Bind settings updates
        let input = PassthroughSubject<SettingsViewModel.Input, Never>()
        
        let output = viewModel.transform(input: input.eraseToAnyPublisher())
        
        output
            .receive(on: DispatchQueue.main)
            .sink { [weak self] output in
                switch output {
                case .settingsUpdated(let state):
                    self?.updateUI(with: state)
                case .error(let error):
                    self?.handleError(error)
                }
            }
            .store(in: &cancellables)
        
        // Store input publisher for later use
        self.input = input
    }
    
    // MARK: - UI Update Methods
    
    private func updateUI(with state: SettingsViewModel.SettingsState) {
        tableView.refreshControl?.endRefreshing()
        loadingIndicator.stopAnimating()
        
        UIView.animate(withDuration: 0.3) {
            self.tableView.reloadData()
        }
        
        updateRTLSupport()
    }
    
    private func updateRTLSupport() {
        // Update semantic content attribute
        view.semanticContentAttribute = LocaleUtils.isRTL() ? .forceRightToLeft : .forceLeftToRight
        tableView.semanticContentAttribute = view.semanticContentAttribute
        
        // Force layout update
        view.setNeedsLayout()
        view.layoutIfNeeded()
    }
    
    private func handleError(_ error: SettingsViewModel.SettingsError) {
        let title = LocaleUtils.getLocalizedString("error.title")
        let message = error.localizedDescription
        
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: LocaleUtils.getLocalizedString("button.ok"), style: .default))
        
        present(alert, animated: true)
    }
    
    // MARK: - Action Methods
    
    @objc private func refreshSettings() {
        loadingIndicator.startAnimating()
        input.send(.refresh)
    }
    
    private func handleLanguageSelection(_ language: String) {
        input.send(.changeLanguage(language))
    }
    
    private func handleThemeSelection(_ theme: ThemeMode) {
        input.send(.changeTheme(theme))
    }
    
    private func handleBiometricToggle(_ isEnabled: Bool) {
        guard isEnabled else {
            input.send(.toggleBiometrics(false))
            return
        }
        
        biometricAuth.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                                   localizedReason: LocaleUtils.getLocalizedString("biometric.reason")) { [weak self] success, error in
            DispatchQueue.main.async {
                if success {
                    self?.input.send(.toggleBiometrics(true))
                } else {
                    self?.handleError(.biometricsUnavailable)
                }
            }
        }
    }
    
    private func handleNotificationToggle(_ isEnabled: Bool) {
        input.send(.toggleNotifications(isEnabled))
    }
}

// MARK: - UITableViewDataSource

extension SettingsViewController: UITableViewDataSource {
    func numberOfSections(in tableView: UITableView) -> Int {
        return Section.allCases.count
    }
    
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        switch Section(rawValue: section) {
        case .language:
            return LocalizationKeys.supportedLanguages.count
        case .appearance:
            return 3 // Light, Dark, System
        case .security, .notifications:
            return 1
        case .none:
            return 0
        }
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "SettingsCell", for: indexPath)
        let currentSettings = viewModel.getCurrentSettings()
        
        switch Section(rawValue: indexPath.section) {
        case .language:
            let language = LocalizationKeys.supportedLanguages[indexPath.row]
            cell.textLabel?.text = LocaleUtils.getLocalizedString("language.\(language.rawValue)")
            cell.accessoryType = currentSettings.language == language.rawValue ? .checkmark : .none
            
        case .appearance:
            let themes = [ThemeMode.light, .dark, .system]
            let theme = themes[indexPath.row]
            cell.textLabel?.text = LocaleUtils.getLocalizedString("theme.\(theme.rawValue)")
            cell.accessoryType = currentSettings.theme == theme ? .checkmark : .none
            
        case .security:
            cell.textLabel?.text = LocaleUtils.getLocalizedString("settings.biometric")
            let biometricSwitch = UISwitch()
            biometricSwitch.isOn = currentSettings.biometricsEnabled
            biometricSwitch.onTintColor = .primary
            biometricSwitch.addTarget(self, action: #selector(biometricSwitchChanged(_:)), for: .valueChanged)
            cell.accessoryView = biometricSwitch
            
        case .notifications:
            cell.textLabel?.text = LocaleUtils.getLocalizedString("settings.notifications")
            let notificationSwitch = UISwitch()
            notificationSwitch.isOn = currentSettings.notificationsEnabled
            notificationSwitch.onTintColor = .primary
            notificationSwitch.addTarget(self, action: #selector(notificationSwitchChanged(_:)), for: .valueChanged)
            cell.accessoryView = notificationSwitch
            
        case .none:
            break
        }
        
        // Configure cell accessibility
        configureCellAccessibility(cell, at: indexPath)
        
        return cell
    }
    
    func tableView(_ tableView: UITableView, titleForHeaderInSection section: Int) -> String? {
        return Section(rawValue: section)?.title
    }
}

// MARK: - UITableViewDelegate

extension SettingsViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        
        switch Section(rawValue: indexPath.section) {
        case .language:
            let language = LocalizationKeys.supportedLanguages[indexPath.row]
            handleLanguageSelection(language.rawValue)
            
        case .appearance:
            let themes = [ThemeMode.light, .dark, .system]
            handleThemeSelection(themes[indexPath.row])
            
        default:
            break
        }
    }
}

// MARK: - Accessibility

extension SettingsViewController {
    private func configureCellAccessibility(_ cell: UITableViewCell, at indexPath: IndexPath) {
        cell.isAccessibilityElement = true
        
        switch Section(rawValue: indexPath.section) {
        case .language:
            let language = LocalizationKeys.supportedLanguages[indexPath.row]
            cell.accessibilityLabel = LocaleUtils.getLocalizedString("accessibility.language.\(language.rawValue)")
            cell.accessibilityHint = LocaleUtils.getLocalizedString("accessibility.hint.language")
            
        case .appearance:
            let themes = [ThemeMode.light, .dark, .system]
            let theme = themes[indexPath.row]
            cell.accessibilityLabel = LocaleUtils.getLocalizedString("accessibility.theme.\(theme.rawValue)")
            cell.accessibilityHint = LocaleUtils.getLocalizedString("accessibility.hint.theme")
            
        case .security:
            cell.accessibilityLabel = LocaleUtils.getLocalizedString("accessibility.biometric")
            cell.accessibilityHint = LocaleUtils.getLocalizedString("accessibility.hint.biometric")
            
        case .notifications:
            cell.accessibilityLabel = LocaleUtils.getLocalizedString("accessibility.notifications")
            cell.accessibilityHint = LocaleUtils.getLocalizedString("accessibility.hint.notifications")
            
        case .none:
            break
        }
    }
}

// MARK: - Action Handlers

extension SettingsViewController {
    @objc private func biometricSwitchChanged(_ sender: UISwitch) {
        handleBiometricToggle(sender.isOn)
    }
    
    @objc private func notificationSwitchChanged(_ sender: UISwitch) {
        handleNotificationToggle(sender.isOn)
    }
}