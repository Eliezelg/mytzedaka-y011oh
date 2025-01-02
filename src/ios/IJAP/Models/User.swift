//
// User.swift
// IJAP
//
// Created by IJAP Developer
// Copyright © 2023 International Jewish Association Platform. All rights reserved.
//

import Foundation // iOS 13.0+

// MARK: - Enums

/// Represents available user roles in the system
public enum UserRole: String, Codable {
    case admin = "ADMIN"
    case association = "ASSOCIATION"
    case donor = "DONOR"
    case guest = "GUEST"
}

/// Supported languages for localization
public enum SupportedLanguage: String, Codable {
    case english = "en"
    case french = "fr"
    case hebrew = "he"
}

// MARK: - Validation

/// Represents the result of user data validation
public struct ValidationResult {
    let isValid: Bool
    let errors: [ValidationError]
    
    enum ValidationError: LocalizedError {
        case invalidEmail
        case invalidPhoneNumber
        case incompleteProfile
        case invalidRole
    }
}

// MARK: - User Model

@objc
@objcMembers
public class User: NSObject, Codable {
    
    // MARK: - Properties
    
    public let id: String
    public var email: String
    public var firstName: String
    public var lastName: String
    public var phoneNumber: String?
    public var role: UserRole
    public var preferredLanguage: SupportedLanguage
    public var isVerified: Bool
    public var isTwoFactorEnabled: Bool
    public var lastLoginAt: Date?
    public let createdAt: Date
    public var updatedAt: Date
    
    // MARK: - Computed Properties
    
    public var displayName: String {
        return fullName()
    }
    
    public var isEligibleForDonation: Bool {
        return role == .donor && isVerified && hasCompletedProfile
    }
    
    public var hasCompletedProfile: Bool {
        return !firstName.isEmpty && !lastName.isEmpty && isVerified
    }
    
    // MARK: - Private Properties
    
    private var cachedAdminStatus: Bool?
    private static let emailRegex = "[A-Z0-9a-z._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,64}"
    private static let phoneRegex = "^\\+?[1-9]\\d{1,14}$"
    
    // MARK: - Initialization
    
    public init(id: String,
                email: String,
                firstName: String,
                lastName: String,
                phoneNumber: String? = nil,
                role: UserRole,
                preferredLanguage: SupportedLanguage,
                isVerified: Bool,
                isTwoFactorEnabled: Bool,
                lastLoginAt: Date? = nil,
                createdAt: Date,
                updatedAt: Date) throws {
        
        // Validate email format
        guard email.range(of: Self.emailRegex, options: .regularExpression) != nil else {
            throw ValidationResult.ValidationError.invalidEmail
        }
        
        // Validate phone number if provided
        if let phone = phoneNumber {
            guard phone.range(of: Self.phoneRegex, options: .regularExpression) != nil else {
                throw ValidationResult.ValidationError.invalidPhoneNumber
            }
        }
        
        self.id = id
        self.email = email
        self.firstName = firstName
        self.lastName = lastName
        self.phoneNumber = phoneNumber
        self.role = role
        self.preferredLanguage = preferredLanguage
        self.isVerified = isVerified
        self.isTwoFactorEnabled = isTwoFactorEnabled
        self.lastLoginAt = lastLoginAt
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        
        super.init()
    }
    
    // MARK: - Public Methods
    
    /// Returns the user's full name with proper localization support
    public func fullName() -> String {
        switch preferredLanguage {
        case .hebrew:
            // Right-to-left format for Hebrew
            return "\(lastName) \(firstName)".trimmingCharacters(in: .whitespaces)
        default:
            // Left-to-right format for other languages
            return "\(firstName) \(lastName)".trimmingCharacters(in: .whitespaces)
        }
    }
    
    /// Checks if user has admin role with caching
    public func isAdmin() -> Bool {
        if let cached = cachedAdminStatus {
            return cached
        }
        let isAdmin = role == .admin
        cachedAdminStatus = isAdmin
        return isAdmin
    }
    
    /// Validates user data completeness and format
    public func validate() -> ValidationResult {
        var errors: [ValidationResult.ValidationError] = []
        
        // Validate email
        if email.range(of: Self.emailRegex, options: .regularExpression) == nil {
            errors.append(.invalidEmail)
        }
        
        // Validate phone if present
        if let phone = phoneNumber {
            if phone.range(of: Self.phoneRegex, options: .regularExpression) == nil {
                errors.append(.invalidPhoneNumber)
            }
        }
        
        // Validate profile completeness
        if !hasCompletedProfile {
            errors.append(.incompleteProfile)
        }
        
        // Validate role permissions
        if role == .admin && !isVerified {
            errors.append(.invalidRole)
        }
        
        return ValidationResult(isValid: errors.isEmpty, errors: errors)
    }
    
    // MARK: - Codable
    
    private enum CodingKeys: String, CodingKey {
        case id, email, firstName, lastName, phoneNumber, role
        case preferredLanguage, isVerified, isTwoFactorEnabled
        case lastLoginAt, createdAt, updatedAt
    }
    
    public required init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        
        id = try container.decode(String.self, forKey: .id)
        email = try container.decode(String.self, forKey: .email)
        firstName = try container.decode(String.self, forKey: .firstName)
        lastName = try container.decode(String.self, forKey: .lastName)
        phoneNumber = try container.decodeIfPresent(String.self, forKey: .phoneNumber)
        role = try container.decode(UserRole.self, forKey: .role)
        preferredLanguage = try container.decode(SupportedLanguage.self, forKey: .preferredLanguage)
        isVerified = try container.decode(Bool.self, forKey: .isVerified)
        isTwoFactorEnabled = try container.decode(Bool.self, forKey: .isTwoFactorEnabled)
        lastLoginAt = try container.decodeIfPresent(Date.self, forKey: .lastLoginAt)
        createdAt = try container.decode(Date.self, forKey: .createdAt)
        updatedAt = try container.decode(Date.self, forKey: .updatedAt)
        
        super.init()
    }
    
    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        
        try container.encode(id, forKey: .id)
        try container.encode(email, forKey: .email)
        try container.encode(firstName, forKey: .firstName)
        try container.encode(lastName, forKey: .lastName)
        try container.encodeIfPresent(phoneNumber, forKey: .phoneNumber)
        try container.encode(role, forKey: .role)
        try container.encode(preferredLanguage, forKey: .preferredLanguage)
        try container.encode(isVerified, forKey: .isVerified)
        try container.encode(isTwoFactorEnabled, forKey: .isTwoFactorEnabled)
        try container.encodeIfPresent(lastLoginAt, forKey: .lastLoginAt)
        try container.encode(createdAt, forKey: .createdAt)
        try container.encode(updatedAt, forKey: .updatedAt)
    }
}