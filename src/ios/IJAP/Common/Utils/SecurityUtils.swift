// Foundation v13.0+
import Foundation
// LocalAuthentication v13.0+
import LocalAuthentication
// CryptoKit v13.0+
import CryptoKit

/// SecurityUtils provides cryptographic and security operations for the IJAP iOS application
/// Implements AES-256-GCM encryption, secure hashing, and biometric authentication
public final class SecurityUtils {
    
    // MARK: - Private Constants
    
    private static let kAESKeySize = 32 // Size in bytes for AES-256
    private static let kGCMTagSize = 16 // Size in bytes for GCM authentication tag
    
    // MARK: - Encryption/Decryption
    
    /// Encrypts data using AES-256-GCM with secure key generation
    /// - Parameter data: Data to be encrypted
    /// - Returns: Encrypted data with authentication tag and nonce
    /// - Throws: CryptoKit errors or invalid input errors
    public static func encryptData(_ data: Data) throws -> Data {
        // Generate a random encryption key
        var keyData = Data(count: kAESKeySize)
        let result = keyData.withUnsafeMutableBytes { pointer in
            SecRandomCopyBytes(kSecRandomDefault, kAESKeySize, pointer.baseAddress!)
        }
        
        guard result == errSecSuccess else {
            throw CryptoError.keyGenerationFailed
        }
        
        // Create a symmetric key from the random data
        let key = SymmetricKey(data: keyData)
        
        // Generate a new nonce for AES-GCM
        let nonce = try AES.GCM.Nonce()
        
        // Encrypt the data
        let sealedBox = try AES.GCM.seal(data, using: key, nonce: nonce)
        
        // Combine nonce, ciphertext, and tag
        var combinedData = Data()
        combinedData.append(sealedBox.nonce.withUnsafeBytes(Data.init))
        combinedData.append(sealedBox.ciphertext)
        combinedData.append(sealedBox.tag)
        
        // Securely clear the key data
        keyData.withUnsafeMutableBytes { pointer in
            memset_s(pointer.baseAddress, pointer.count, 0, pointer.count)
        }
        
        return combinedData
    }
    
    /// Decrypts data encrypted with AES-256-GCM
    /// - Parameter encryptedData: Combined encrypted data (nonce + ciphertext + tag)
    /// - Returns: Original decrypted data
    /// - Throws: CryptoKit errors or invalid input errors
    public static func decryptData(_ encryptedData: Data) throws -> Data {
        guard encryptedData.count > (kGCMTagSize + AES.GCM.Nonce.size) else {
            throw CryptoError.invalidDataSize
        }
        
        // Extract nonce
        let nonceData = encryptedData.prefix(AES.GCM.Nonce.size)
        let nonce = try AES.GCM.Nonce(data: nonceData)
        
        // Extract ciphertext and tag
        let ciphertextWithTag = encryptedData.dropFirst(AES.GCM.Nonce.size)
        let ciphertext = ciphertextWithTag.dropLast(kGCMTagSize)
        let tag = ciphertextWithTag.suffix(kGCMTagSize)
        
        // Create sealed box for decryption
        let sealedBox = try AES.GCM.SealedBox(nonce: nonce,
                                             ciphertext: ciphertext,
                                             tag: tag)
        
        // Generate key and decrypt
        var keyData = Data(count: kAESKeySize)
        let result = keyData.withUnsafeMutableBytes { pointer in
            SecRandomCopyBytes(kSecRandomDefault, kAESKeySize, pointer.baseAddress!)
        }
        
        guard result == errSecSuccess else {
            throw CryptoError.keyGenerationFailed
        }
        
        let key = SymmetricKey(data: keyData)
        let decryptedData = try AES.GCM.open(sealedBox, using: key)
        
        // Securely clear sensitive data
        keyData.withUnsafeMutableBytes { pointer in
            memset_s(pointer.baseAddress, pointer.count, 0, pointer.count)
        }
        
        return decryptedData
    }
    
    /// Creates a cryptographically secure SHA-256 hash of the input string
    /// - Parameter input: String to be hashed
    /// - Returns: Hexadecimal string representation of the hash
    public static func hashString(_ input: String) -> String {
        guard let inputData = input.data(using: .utf8) else {
            return ""
        }
        
        let hash = SHA256.hash(data: inputData)
        let hashString = hash.compactMap { String(format: "%02x", $0) }.joined()
        
        // Clear input data from memory
        inputData.withUnsafeBytes { pointer in
            memset_s(pointer.baseAddress, pointer.count, 0, pointer.count)
        }
        
        return hashString
    }
    
    /// Authenticates user using TouchID/FaceID
    /// - Parameter customReason: Optional custom reason string for authentication prompt
    /// - Returns: Result indicating success or detailed error information
    public static func authenticateWithBiometrics(customReason: String? = nil) -> Result<Bool, Error> {
        let context = LAContext()
        var error: NSError?
        
        // Check if biometric authentication is available
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            if let error = error {
                return .failure(BiometricError.notAvailable(error))
            }
            return .failure(BiometricError.unknown)
        }
        
        // Set authentication reason
        let reason = customReason ?? SecurityConfig.biometricReason
        
        // Request authentication
        context.evaluatePolicy(.deviceOwnerAuthenticationWithBiometrics,
                             localizedReason: reason) { success, error in
            if success {
                return .success(true)
            } else if let error = error {
                return .failure(BiometricError.authenticationFailed(error))
            } else {
                return .failure(BiometricError.unknown)
            }
        }
        
        return .success(false)
    }
}

// MARK: - Error Types

extension SecurityUtils {
    /// Cryptographic operation errors
    enum CryptoError: Error {
        case keyGenerationFailed
        case invalidDataSize
        case encryptionFailed
        case decryptionFailed
    }
    
    /// Biometric authentication errors
    enum BiometricError: Error {
        case notAvailable(Error)
        case authenticationFailed(Error)
        case unknown
    }
}