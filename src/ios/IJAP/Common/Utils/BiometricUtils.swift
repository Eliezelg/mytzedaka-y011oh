// Foundation v13.0+
import Foundation
// LocalAuthentication v13.0+
import LocalAuthentication
// Security v13.0+
import Security
// CryptoKit v13.0+
import CryptoKit

/// Comprehensive error types for biometric authentication operations
enum BiometricError: Error {
    case notAvailable
    case notEnrolled
    case lockout
    case canceled
    case failed
    case encryptionError
    case invalidState
    case hardwareChanged
    case timeout
    case jailbreakDetected
}

/// Delegate protocol for biometric authentication status updates
protocol BiometricAuthenticationDelegate: AnyObject {
    func didCompleteAuthentication(success: Bool, error: BiometricError?)
    func didUpdateBiometricState(isAuthenticated: Bool)
}

/// Thread-safe singleton utility class for managing biometric authentication operations
final class BiometricUtils {
    // MARK: - Properties
    
    /// Shared singleton instance
    static let shared = BiometricUtils()
    
    /// Local Authentication context
    private let context: LAContext
    
    /// Delegate for authentication callbacks
    weak var delegate: BiometricAuthenticationDelegate?
    
    /// Key for storing biometric state in keychain
    private let BIOMETRIC_STATE_KEY = "org.ijap.biometric.state"
    
    /// Encryption key for securing biometric state
    private var encryptionKey: SymmetricKey
    
    /// Serial queue for thread-safe operations
    private let securityQueue: DispatchQueue
    
    /// Authentication timeout interval
    private let authenticationTimeout: TimeInterval = 30.0
    
    /// Device jailbreak status
    private var isJailbroken: Bool
    
    // MARK: - Initialization
    
    private init() {
        // Initialize context with highest security level
        context = LAContext()
        context.localizedFallbackTitle = ""
        context.touchIDAuthenticationAllowableReuseDuration = 0
        
        // Initialize security queue
        securityQueue = DispatchQueue(label: "org.ijap.biometric.queue", qos: .userInitiated)
        
        // Generate encryption key
        encryptionKey = SymmetricKey(size: .bits256)
        
        // Check for jailbreak
        isJailbroken = checkJailbreakStatus()
        
        // Configure biometric settings
        configureBiometricSettings()
    }
    
    // MARK: - Public Methods
    
    /// Checks if biometric authentication is available and device is secure
    func isBiometricAvailable() -> Bool {
        guard !isJailbroken else {
            return false
        }
        
        var error: NSError?
        let canEvaluate = context.canEvaluatePolicy(
            SecurityConfig.BiometricConfiguration.evaluationPolicy,
            error: &error
        )
        
        return canEvaluate && error == nil
    }
    
    /// Authenticates user using biometric authentication
    func authenticateUser(completion: @escaping (Result<Bool, BiometricError>) -> Void) {
        securityQueue.async { [weak self] in
            guard let self = self else { return }
            
            // Check security prerequisites
            guard !self.isJailbroken else {
                completion(.failure(.jailbreakDetected))
                return
            }
            
            guard self.isBiometricAvailable() else {
                completion(.failure(.notAvailable))
                return
            }
            
            // Set authentication timeout
            let timeoutTimer = DispatchSource.makeTimerSource(queue: self.securityQueue)
            timeoutTimer.schedule(deadline: .now() + self.authenticationTimeout)
            timeoutTimer.setEventHandler { [weak self] in
                self?.context.invalidate()
                completion(.failure(.timeout))
            }
            timeoutTimer.resume()
            
            // Perform authentication
            self.context.evaluatePolicy(
                SecurityConfig.BiometricConfiguration.evaluationPolicy,
                localizedReason: SecurityConfig.biometricReason
            ) { [weak self] success, error in
                timeoutTimer.cancel()
                
                guard let self = self else { return }
                
                if success {
                    do {
                        // Encrypt and store authentication state
                        try self.storeAuthenticationState(true)
                        self.delegate?.didUpdateBiometricState(isAuthenticated: true)
                        completion(.success(true))
                    } catch {
                        completion(.failure(.encryptionError))
                    }
                } else {
                    let biometricError = self.handleAuthenticationError(error as NSError?)
                    self.delegate?.didCompleteAuthentication(success: false, error: biometricError)
                    completion(.failure(biometricError))
                }
            }
        }
    }
    
    // MARK: - Private Methods
    
    private func configureBiometricSettings() {
        context.interactionNotAllowed = false
        
        if SecurityConfig.BiometricConfiguration.fallbackToPasscode {
            context.localizedFallbackTitle = NSLocalizedString("Use Passcode", comment: "")
        }
    }
    
    private func checkJailbreakStatus() -> Bool {
        // Check for common jailbreak paths
        let suspiciousPaths = [
            "/Applications/Cydia.app",
            "/Library/MobileSubstrate/MobileSubstrate.dylib",
            "/bin/bash",
            "/usr/sbin/sshd",
            "/etc/apt",
            "/private/var/lib/apt/"
        ]
        
        for path in suspiciousPaths {
            if FileManager.default.fileExists(atPath: path) {
                return true
            }
        }
        
        // Check if app can write to system directories
        let suspicious = "/private/jailbreak.txt"
        do {
            try "test".write(toFile: suspicious, atomically: true, encoding: .utf8)
            try FileManager.default.removeItem(atPath: suspicious)
            return true
        } catch {
            return false
        }
    }
    
    private func handleAuthenticationError(_ error: NSError?) -> BiometricError {
        guard let error = error else {
            return .failed
        }
        
        switch error.code {
        case LAError.biometryNotAvailable.rawValue:
            return .notAvailable
        case LAError.biometryNotEnrolled.rawValue:
            return .notEnrolled
        case LAError.biometryLockout.rawValue:
            return .lockout
        case LAError.userCancel.rawValue:
            return .canceled
        case LAError.systemCancel.rawValue:
            return .canceled
        case LAError.appCancel.rawValue:
            return .canceled
        default:
            return .failed
        }
    }
    
    private func encryptData(_ data: Data) throws -> Data {
        let nonce = try AES.GCM.Nonce(data: Data(count: 12))
        let sealedBox = try AES.GCM.seal(data, using: encryptionKey, nonce: nonce)
        
        guard let combined = sealedBox.combined else {
            throw BiometricError.encryptionError
        }
        
        return combined
    }
    
    private func decryptData(_ encryptedData: Data) throws -> Data {
        let sealedBox = try AES.GCM.SealedBox(combined: encryptedData)
        return try AES.GCM.open(sealedBox, using: encryptionKey)
    }
    
    private func storeAuthenticationState(_ authenticated: Bool) throws {
        let stateData = try JSONEncoder().encode(authenticated)
        let encryptedData = try encryptData(stateData)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: SecurityConfig.keychainService,
            kSecAttrAccount as String: BIOMETRIC_STATE_KEY,
            kSecValueData as String: encryptedData
        ]
        
        SecItemDelete(query as CFDictionary)
        let status = SecItemAdd(query as CFDictionary, nil)
        
        guard status == errSecSuccess else {
            throw BiometricError.encryptionError
        }
    }
}