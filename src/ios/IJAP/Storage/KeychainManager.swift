// Foundation v13.0+
import Foundation
// Security v13.0+
import Security
// LocalAuthentication v13.0+
import LocalAuthentication

/// Thread-safe singleton class managing secure storage and retrieval of sensitive data using iOS Keychain
/// with enhanced security features including biometric protection and secure memory handling
@objc
@available(iOS 13.0, *)
public final class KeychainManager {
    
    // MARK: - Error Types
    
    /// Specific error types for Keychain operations
    public enum KeychainError: Error {
        case dataEncryptionFailed
        case itemNotFound
        case duplicateItem
        case unexpectedStatus(OSStatus)
        case biometricFailure
        case invalidData
    }
    
    // MARK: - Constants
    
    private static let kAccessibilityLevel = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
    private static let kAuthenticationContext = LAContext()
    
    // MARK: - Properties
    
    /// Shared singleton instance
    public static let shared = KeychainManager()
    
    /// Service identifier for Keychain items
    private let serviceName: String
    
    /// Serial queue for thread-safe operations
    private let queue: DispatchQueue
    
    /// Authentication context for biometric validation
    private let authContext: LAContext
    
    // MARK: - Initialization
    
    private init() {
        self.serviceName = SecurityConfig.keychainService
        self.queue = DispatchQueue(label: "org.ijap.keychain", qos: .userInitiated)
        self.authContext = LAContext()
        
        // Configure secure memory attributes
        self.authContext.interactionNotAllowed = false
        self.authContext.localizedCancelTitle = "Cancel"
        
        // Enable biometric fallback if configured
        if SecurityConfig.BiometricConfiguration.fallbackToPasscode {
            self.authContext.localizedFallbackTitle = "Use Passcode"
        } else {
            self.authContext.localizedFallbackTitle = ""
        }
    }
    
    // MARK: - Public Methods
    
    /// Saves encrypted data to Keychain with optional biometric protection
    /// - Parameters:
    ///   - data: Data to be stored securely
    ///   - key: Unique identifier for the stored item
    ///   - requiresBiometric: Whether biometric authentication is required for retrieval
    /// - Returns: Result indicating success or specific error
    public func saveSecureItem(_ data: Data, 
                             forKey key: String, 
                             requiresBiometric: Bool = false) -> Result<Void, KeychainError> {
        return queue.sync {
            do {
                // Validate input data
                guard SecurityUtils.validateData(data) else {
                    return .failure(.invalidData)
                }
                
                // Encrypt the data
                guard let encryptedData = try? SecurityUtils.encryptData(data) else {
                    return .failure(.dataEncryptionFailed)
                }
                
                // Prepare query dictionary
                var query: [String: Any] = [
                    kSecClass as String: kSecClassGenericPassword,
                    kSecAttrService as String: serviceName,
                    kSecAttrAccount as String: key,
                    kSecValueData as String: encryptedData,
                    kSecAttrAccessible as String: KeychainManager.kAccessibilityLevel
                ]
                
                // Add biometric protection if required
                if requiresBiometric {
                    let accessControl = SecAccessControlCreateWithFlags(
                        nil,
                        KeychainManager.kAccessibilityLevel,
                        .biometryAny,
                        nil
                    )
                    query[kSecAttrAccessControl as String] = accessControl
                }
                
                // Attempt to save to Keychain
                var status = SecItemAdd(query as CFDictionary, nil)
                
                // Handle existing item
                if status == errSecDuplicateItem {
                    let updateQuery = [
                        kSecClass as String: kSecClassGenericPassword,
                        kSecAttrService as String: serviceName,
                        kSecAttrAccount as String: key
                    ]
                    
                    let updateAttributes = [
                        kSecValueData as String: encryptedData
                    ]
                    
                    status = SecItemUpdate(
                        updateQuery as CFDictionary,
                        updateAttributes as CFDictionary
                    )
                }
                
                // Check final status
                guard status == errSecSuccess else {
                    return .failure(.unexpectedStatus(status))
                }
                
                return .success(())
            }
        }
    }
    
    /// Loads and decrypts data from Keychain with biometric validation if required
    /// - Parameter key: Unique identifier for the stored item
    /// - Returns: Result containing decrypted data or specific error
    public func loadSecureItem(forKey key: String) -> Result<Data?, KeychainError> {
        return queue.sync {
            // Prepare query dictionary
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: serviceName,
                kSecAttrAccount as String: key,
                kSecReturnData as String: true,
                kSecUseAuthenticationContext as String: authContext
            ]
            
            var result: AnyObject?
            let status = SecItemCopyMatching(query as CFDictionary, &result)
            
            // Handle query result
            switch status {
            case errSecSuccess:
                guard let data = result as? Data else {
                    return .failure(.invalidData)
                }
                
                // Attempt to decrypt the data
                do {
                    let decryptedData = try SecurityUtils.decryptData(data)
                    return .success(decryptedData)
                } catch {
                    return .failure(.dataEncryptionFailed)
                }
                
            case errSecItemNotFound:
                return .success(nil)
                
            case errSecUserCanceled:
                return .failure(.biometricFailure)
                
            default:
                return .failure(.unexpectedStatus(status))
            }
        }
    }
    
    /// Removes a secure item from Keychain
    /// - Parameter key: Unique identifier for the stored item
    /// - Returns: Result indicating success or specific error
    public func removeSecureItem(forKey key: String) -> Result<Void, KeychainError> {
        return queue.sync {
            let query: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: serviceName,
                kSecAttrAccount as String: key
            ]
            
            let status = SecItemDelete(query as CFDictionary)
            
            switch status {
            case errSecSuccess, errSecItemNotFound:
                return .success(())
            default:
                return .failure(.unexpectedStatus(status))
            }
        }
    }
}