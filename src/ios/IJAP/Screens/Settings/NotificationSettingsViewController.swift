// UIKit version: iOS 13.0+
import UIKit
import UserNotifications

class NotificationSettingsViewController: UIViewController {
    
    // MARK: - Private Properties
    
    private let settingsStackView: UIStackView = {
        let stack = UIStackView()
        stack.axis = .vertical
        stack.spacing = 24
        stack.alignment = .fill
        stack.distribution = .fill
        stack.translatesAutoresizingMaskIntoConstraints = false
        return stack
    }()
    
    private let donationUpdatesSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityIdentifier = "donationUpdatesSwitch"
        return toggle
    }()
    
    private let campaignAlertsSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityIdentifier = "campaignAlertsSwitch"
        return toggle
    }()
    
    private let generalAnnouncementsSwitch: UISwitch = {
        let toggle = UISwitch()
        toggle.accessibilityIdentifier = "generalAnnouncementsSwitch"
        return toggle
    }()
    
    private let saveButton: CustomButton = {
        let button = CustomButton(style: .primary, size: .large)
        button.translatesAutoresizingMaskIntoConstraints = false
        return button
    }()
    
    private let settingsStorage = UserDefaults.standard
    private let notificationCenter = UNUserNotificationCenter.current()
    
    // MARK: - Lifecycle Methods
    
    override func viewDidLoad() {
        super.viewDidLoad()
        setupUI()
        loadCurrentSettings()
        setupObservers()
    }
    
    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)
        checkNotificationPermission()
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    // MARK: - UI Setup
    
    private func setupUI() {
        // Configure view
        view.backgroundColor = .background
        
        // Configure navigation
        title = NSLocalizedString("Notification Settings", comment: "Screen title")
        navigationItem.largeTitleDisplayMode = .never
        
        // Setup semantic content attribute for RTL support
        view.semanticContentAttribute = .unspecified
        settingsStackView.semanticContentAttribute = .unspecified
        
        // Add subviews
        view.addSubview(settingsStackView)
        view.addSubview(saveButton)
        
        // Setup stack view items
        setupNotificationToggle(donationUpdatesSwitch, 
                              title: NSLocalizedString("Donation Updates", comment: "Toggle title"),
                              subtitle: NSLocalizedString("Receive updates about your donations and tax receipts", comment: "Toggle description"))
        
        setupNotificationToggle(campaignAlertsSwitch,
                              title: NSLocalizedString("Campaign Alerts", comment: "Toggle title"),
                              subtitle: NSLocalizedString("Get notified about new campaigns and milestones", comment: "Toggle description"))
        
        setupNotificationToggle(generalAnnouncementsSwitch,
                              title: NSLocalizedString("General Announcements", comment: "Toggle title"),
                              subtitle: NSLocalizedString("Stay informed about important announcements and events", comment: "Toggle description"))
        
        // Configure save button
        saveButton.setTitle(NSLocalizedString("Save Settings", comment: "Button title"), for: .normal)
        saveButton.addTarget(self, action: #selector(saveButtonTapped), for: .touchUpInside)
        
        // Setup constraints
        NSLayoutConstraint.activate([
            settingsStackView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor, constant: 24),
            settingsStackView.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            settingsStackView.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24),
            
            saveButton.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor, constant: -24),
            saveButton.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 24),
            saveButton.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -24)
        ])
    }
    
    private func setupNotificationToggle(_ toggle: UISwitch, title: String, subtitle: String) {
        let containerStack = UIStackView()
        containerStack.axis = .horizontal
        containerStack.spacing = 16
        containerStack.alignment = .center
        
        let labelStack = UIStackView()
        labelStack.axis = .vertical
        labelStack.spacing = 4
        
        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .preferredFont(forTextStyle: .body)
        titleLabel.textColor = .textPrimary
        titleLabel.adjustsFontForContentSizeCategory = true
        
        let subtitleLabel = UILabel()
        subtitleLabel.text = subtitle
        subtitleLabel.font = .preferredFont(forTextStyle: .footnote)
        subtitleLabel.textColor = .textSecondary
        subtitleLabel.numberOfLines = 0
        subtitleLabel.adjustsFontForContentSizeCategory = true
        
        labelStack.addArrangedSubview(titleLabel)
        labelStack.addArrangedSubview(subtitleLabel)
        
        containerStack.addArrangedSubview(labelStack)
        containerStack.addArrangedSubview(toggle)
        
        // Configure accessibility
        toggle.accessibilityLabel = title
        toggle.accessibilityHint = subtitle
        
        settingsStackView.addArrangedSubview(containerStack)
    }
    
    // MARK: - Settings Management
    
    private func loadCurrentSettings() {
        donationUpdatesSwitch.isOn = settingsStorage.bool(forKey: NotificationSettingsKeys.donationUpdates.rawValue)
        campaignAlertsSwitch.isOn = settingsStorage.bool(forKey: NotificationSettingsKeys.campaignAlerts.rawValue)
        generalAnnouncementsSwitch.isOn = settingsStorage.bool(forKey: NotificationSettingsKeys.generalAnnouncements.rawValue)
    }
    
    @objc private func saveButtonTapped() {
        saveButton.setLoading(true)
        
        notificationCenter.getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                self?.handlePermissionChange(settings.authorizationStatus)
                self?.saveSettings()
                self?.saveButton.setLoading(false)
            }
        }
    }
    
    private func saveSettings() {
        settingsStorage.set(donationUpdatesSwitch.isOn, forKey: NotificationSettingsKeys.donationUpdates.rawValue)
        settingsStorage.set(campaignAlertsSwitch.isOn, forKey: NotificationSettingsKeys.campaignAlerts.rawValue)
        settingsStorage.set(generalAnnouncementsSwitch.isOn, forKey: NotificationSettingsKeys.generalAnnouncements.rawValue)
        
        // Show success message
        let message = NSLocalizedString("Notification settings saved successfully", comment: "Success message")
        showSuccessMessage(message)
    }
    
    // MARK: - Permission Management
    
    private func checkNotificationPermission() {
        notificationCenter.getNotificationSettings { [weak self] settings in
            DispatchQueue.main.async {
                self?.handlePermissionChange(settings.authorizationStatus)
            }
        }
    }
    
    private func handlePermissionChange(_ status: UNAuthorizationStatus) {
        let isEnabled = status == .authorized
        
        donationUpdatesSwitch.isEnabled = isEnabled
        campaignAlertsSwitch.isEnabled = isEnabled
        generalAnnouncementsSwitch.isEnabled = isEnabled
        saveButton.isEnabled = isEnabled
        
        if !isEnabled {
            showPermissionAlert()
        }
    }
    
    private func showPermissionAlert() {
        let title = NSLocalizedString("Notifications Disabled", comment: "Alert title")
        let message = NSLocalizedString("Please enable notifications in Settings to receive important updates about your donations and campaigns", comment: "Alert message")
        
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        
        let settingsAction = UIAlertAction(title: NSLocalizedString("Open Settings", comment: "Button title"), style: .default) { _ in
            if let url = URL(string: UIApplication.openSettingsURLString) {
                UIApplication.shared.open(url)
            }
        }
        
        let cancelAction = UIAlertAction(title: NSLocalizedString("Cancel", comment: "Button title"), style: .cancel)
        
        alert.addAction(settingsAction)
        alert.addAction(cancelAction)
        
        present(alert, animated: true)
    }
    
    private func showSuccessMessage(_ message: String) {
        let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        alert.view.tintColor = .success
        present(alert, animated: true) {
            DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
                alert.dismiss(animated: true)
            }
        }
    }
    
    // MARK: - Observers
    
    private func setupObservers() {
        NotificationCenter.default.addObserver(self,
                                             selector: #selector(handleAppDidBecomeActive),
                                             name: UIApplication.didBecomeActiveNotification,
                                             object: nil)
    }
    
    @objc private func handleAppDidBecomeActive() {
        checkNotificationPermission()
    }
}

// MARK: - Supporting Types

private enum NotificationSettingsKeys: String {
    case donationUpdates = "notification_donations"
    case campaignAlerts = "notification_campaigns"
    case generalAnnouncements = "notification_announcements"
    case lastPermissionCheck = "notification_last_check"
}