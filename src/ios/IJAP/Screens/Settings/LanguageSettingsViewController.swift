// UIKit v13.0+
import UIKit

/// View controller for managing application language settings with comprehensive accessibility and RTL support
final class LanguageSettingsViewController: UIViewController {
    
    // MARK: - Types
    
    private struct LanguageOption {
        let code: String
        let displayName: String
        let isRTL: Bool
        let accessibilityLabel: String
    }
    
    // MARK: - Properties
    
    private lazy var tableView: UITableView = {
        let table = UITableView(frame: .zero, style: .insetGrouped)
        table.translatesAutoresizingMaskIntoConstraints = false
        table.delegate = self
        table.dataSource = self
        table.backgroundColor = .systemGroupedBackground
        table.rowHeight = UITableView.automaticDimension
        table.estimatedRowHeight = 56
        table.accessibilityIdentifier = "languageSelectionTable"
        return table
    }()
    
    private lazy var loadingIndicator: UIActivityIndicatorView = {
        let indicator = UIActivityIndicatorView(style: .medium)
        indicator.hidesWhenStopped = true
        indicator.translatesAutoresizingMaskIntoConstraints = false
        return indicator
    }()
    
    private lazy var errorView: UIView = {
        let view = UIView()
        view.isHidden = true
        view.translatesAutoresizingMaskIntoConstraints = false
        return view
    }()
    
    private var languages: [LanguageOption] = []
    private var currentLanguage: String = ""
    private var stateRestorationActivity: NSUserActivity?
    
    // MARK: - Lifecycle
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        setupLanguageOptions()
        setupStateRestoration()
        loadCurrentLanguage()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        updateNavigationBar()
    }
    
    // MARK: - Setup
    
    private func setupUI() {
        view.backgroundColor = .systemBackground
        title = LocaleUtils.getLocalizedString("settings.language.title", defaultValue: "Language")
        
        view.addSubview(tableView)
        view.addSubview(loadingIndicator)
        view.addSubview(errorView)
        
        NSLayoutConstraint.activate([
            tableView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            tableView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            tableView.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            tableView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            
            loadingIndicator.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            loadingIndicator.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            
            errorView.centerXAnchor.constraint(equalTo: view.centerXAnchor),
            errorView.centerYAnchor.constraint(equalTo: view.centerYAnchor),
            errorView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 20),
            errorView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -20)
        ])
        
        tableView.register(UITableViewCell.self, forCellReuseIdentifier: "LanguageCell")
    }
    
    private func setupLanguageOptions() {
        languages = [
            LanguageOption(
                code: "en",
                displayName: "English",
                isRTL: false,
                accessibilityLabel: LocaleUtils.getLocalizedString("language.english.accessibility", defaultValue: "English language option")
            ),
            LanguageOption(
                code: "fr",
                displayName: "Français",
                isRTL: false,
                accessibilityLabel: LocaleUtils.getLocalizedString("language.french.accessibility", defaultValue: "French language option")
            ),
            LanguageOption(
                code: "he",
                displayName: "עברית",
                isRTL: true,
                accessibilityLabel: LocaleUtils.getLocalizedString("language.hebrew.accessibility", defaultValue: "Hebrew language option")
            )
        ]
        
        languages.sort { $0.displayName < $1.displayName }
    }
    
    private func setupStateRestoration() {
        restorationIdentifier = "languageSettings"
        
        stateRestorationActivity = NSUserActivity(activityType: "org.ijap.settings.language")
        stateRestorationActivity?.title = title
        stateRestorationActivity?.userInfo = ["currentLanguage": currentLanguage]
        view.window?.windowScene?.userActivity = stateRestorationActivity
    }
    
    private func updateNavigationBar() {
        navigationItem.largeTitleDisplayMode = .never
        
        // Update back button for RTL support
        if LocaleUtils.isRTL() {
            navigationItem.leftBarButtonItem?.image = UIImage(systemName: "chevron.right")
        } else {
            navigationItem.leftBarButtonItem?.image = UIImage(systemName: "chevron.left")
        }
    }
    
    // MARK: - Language Management
    
    private func loadCurrentLanguage() {
        currentLanguage = LocaleUtils.getCurrentLanguage()
        tableView.reloadData()
    }
    
    private func handleLanguageSelection(at indexPath: IndexPath) {
        let selectedLanguage = languages[indexPath.row]
        
        guard selectedLanguage.code != currentLanguage else { return }
        
        loadingIndicator.startAnimating()
        view.isUserInteractionEnabled = false
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) { [weak self] in
            guard let self = self else { return }
            
            if LocaleUtils.setLanguage(selectedLanguage.code) {
                self.currentLanguage = selectedLanguage.code
                self.updateUserInterfaceDirection(isRTL: selectedLanguage.isRTL)
                self.tableView.reloadData()
                
                // Post notification for app-wide language change
                NotificationCenter.default.post(
                    name: Notification.Name("LanguageDidChange"),
                    object: nil,
                    userInfo: ["language": selectedLanguage.code]
                )
                
                // Update state restoration
                self.stateRestorationActivity?.userInfo?["currentLanguage"] = selectedLanguage.code
                
                // Provide success feedback
                let generator = UINotificationFeedbackGenerator()
                generator.notificationOccurred(.success)
            } else {
                self.handleError(LocaleUtils.getLocalizedString(
                    "language.change.error",
                    defaultValue: "Failed to change language"
                ))
            }
            
            self.loadingIndicator.stopAnimating()
            self.view.isUserInteractionEnabled = true
        }
    }
    
    private func updateUserInterfaceDirection(isRTL: Bool) {
        let direction: UISemanticContentAttribute = isRTL ? .forceRightToLeft : .forceLeftToRight
        
        UIView.animate(withDuration: 0.3) {
            self.view.semanticContentAttribute = direction
            self.tableView.semanticContentAttribute = direction
            self.navigationController?.navigationBar.semanticContentAttribute = direction
            self.view.layoutIfNeeded()
        }
    }
    
    // MARK: - Error Handling
    
    private func handleError(_ message: String) {
        let alert = UIAlertController(
            title: LocaleUtils.getLocalizedString("error.title", defaultValue: "Error"),
            message: message,
            preferredStyle: .alert
        )
        
        alert.addAction(UIAlertAction(
            title: LocaleUtils.getLocalizedString("button.ok", defaultValue: "OK"),
            style: .default
        ))
        
        present(alert, animated: true)
        
        // Provide error feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.error)
    }
}

// MARK: - UITableViewDataSource

extension LanguageSettingsViewController: UITableViewDataSource {
    func tableView(_ tableView: UITableView, numberOfRowsInSection section: Int) -> Int {
        return languages.count
    }
    
    func tableView(_ tableView: UITableView, cellForRowAt indexPath: IndexPath) -> UITableViewCell {
        let cell = tableView.dequeueReusableCell(withIdentifier: "LanguageCell", for: indexPath)
        let language = languages[indexPath.row]
        
        var configuration = cell.defaultContentConfiguration()
        configuration.text = language.displayName
        configuration.textProperties.alignment = language.isRTL ? .right : .left
        
        cell.contentConfiguration = configuration
        cell.accessibilityLabel = language.accessibilityLabel
        cell.accessibilityTraits = language.code == currentLanguage ? [.selected, .button] : .button
        cell.accessoryType = language.code == currentLanguage ? .checkmark : .none
        
        return cell
    }
}

// MARK: - UITableViewDelegate

extension LanguageSettingsViewController: UITableViewDelegate {
    func tableView(_ tableView: UITableView, didSelectRowAt indexPath: IndexPath) {
        tableView.deselectRow(at: indexPath, animated: true)
        handleLanguageSelection(at: indexPath)
    }
}