//
// APIRouter.swift
// IJAP
//
// Foundation version: iOS 13.0+
// Alamofire version: 5.8+
//

import Foundation
import Alamofire

/// Comprehensive API router implementing URLRequestConvertible for type-safe API requests
/// with security, internationalization, and payment gateway integration support
enum APIRouter {
    // MARK: - Authentication Cases
    case login(email: String, password: String)
    case register(email: String, password: String, profile: [String: Any])
    case twoFactor(code: String)
    case refreshToken(token: String)
    
    // MARK: - Association Cases
    case getAssociations(page: Int, limit: Int, locale: String)
    case getAssociationDetail(id: String, locale: String)
    
    // MARK: - Campaign Cases
    case getCampaigns(associationId: String?, page: Int, limit: Int, locale: String)
    case getCampaignDetail(id: String, locale: String)
    
    // MARK: - Payment Cases
    case createStripePayment(campaignId: String, amount: Double, currency: String)
    case createTranzillaPayment(campaignId: String, amount: Double)
    case getDonationHistory(page: Int, limit: Int)
    case getPaymentMethods
    case addStripePaymentMethod(token: String)
    case addTranzillaPaymentMethod(token: String)
    
    // MARK: - User Profile Cases
    case getUserProfile
    case updateUserProfile([String: Any])
    case uploadDocument(type: String, documentId: String, locale: String)
    
    // MARK: - Properties
    private static let baseURL: String = {
        #if DEBUG
        return "https://api.staging.ijap.org/v1"
        #else
        return "https://api.ijap.org/v1"
        #endif
    }()
    
    private var path: String {
        switch self {
        case .login:
            return "/auth/login"
        case .register:
            return "/auth/register"
        case .twoFactor:
            return "/auth/2fa/verify"
        case .refreshToken:
            return "/auth/refresh"
        case .getAssociations:
            return "/associations"
        case .getAssociationDetail(let id, _):
            return "/associations/\(id)"
        case .getCampaigns:
            return "/campaigns"
        case .getCampaignDetail(let id, _):
            return "/campaigns/\(id)"
        case .createStripePayment:
            return "/payments/stripe"
        case .createTranzillaPayment:
            return "/payments/tranzilla"
        case .getDonationHistory:
            return "/donations/history"
        case .getPaymentMethods:
            return "/payment-methods"
        case .addStripePaymentMethod:
            return "/payment-methods/stripe"
        case .addTranzillaPaymentMethod:
            return "/payment-methods/tranzilla"
        case .getUserProfile:
            return "/profile"
        case .updateUserProfile:
            return "/profile"
        case .uploadDocument:
            return "/documents/upload"
        }
    }
    
    private var method: HTTPMethod {
        switch self {
        case .login, .register, .twoFactor, .refreshToken,
             .createStripePayment, .createTranzillaPayment,
             .addStripePaymentMethod, .addTranzillaPaymentMethod,
             .uploadDocument:
            return .post
        case .updateUserProfile:
            return .put
        default:
            return .get
        }
    }
    
    private var parameters: Parameters? {
        switch self {
        case .login(let email, let password):
            return ["email": email, "password": password]
        case .register(let email, let password, let profile):
            var params: [String: Any] = ["email": email, "password": password]
            params.merge(profile) { _, new in new }
            return params
        case .twoFactor(let code):
            return ["code": code]
        case .refreshToken(let token):
            return ["refresh_token": token]
        case .getAssociations(let page, let limit, let locale):
            return ["page": page, "limit": limit, "locale": locale]
        case .getAssociationDetail(_, let locale):
            return ["locale": locale]
        case .getCampaigns(let associationId, let page, let limit, let locale):
            var params: [String: Any] = ["page": page, "limit": limit, "locale": locale]
            if let associationId = associationId {
                params["association_id"] = associationId
            }
            return params
        case .getCampaignDetail(_, let locale):
            return ["locale": locale]
        case .createStripePayment(let campaignId, let amount, let currency):
            return [
                "campaign_id": campaignId,
                "amount": amount,
                "currency": currency
            ]
        case .createTranzillaPayment(let campaignId, let amount):
            return [
                "campaign_id": campaignId,
                "amount": amount,
                "currency": "ILS"
            ]
        case .getDonationHistory(let page, let limit):
            return ["page": page, "limit": limit]
        case .updateUserProfile(let profile):
            return profile
        case .uploadDocument(let type, let documentId, let locale):
            return [
                "type": type,
                "document_id": documentId,
                "locale": locale
            ]
        default:
            return nil
        }
    }
    
    private var timeoutInterval: TimeInterval {
        switch self {
        case .createStripePayment, .createTranzillaPayment:
            return 30 // Extended timeout for payment processing
        case .uploadDocument:
            return 60 // Extended timeout for document upload
        default:
            return 15 // Default timeout
        }
    }
}

// MARK: - URLRequestConvertible Implementation
extension APIRouter: URLRequestConvertible {
    func asURLRequest() throws -> URLRequest {
        let url = try APIRouter.baseURL.asURL().appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.timeoutInterval = timeoutInterval
        
        // Set common headers
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("IJAP-iOS/\(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0")", forHTTPHeaderField: "User-Agent")
        
        // Set method
        request.method = method
        
        // Add authentication token if available
        if let token = UserDefaults.standard.string(forKey: "authToken") {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        // Add device locale for internationalization
        let preferredLanguage = Locale.preferredLanguages.first ?? "en"
        request.setValue(preferredLanguage, forHTTPHeaderField: "Accept-Language")
        
        // Configure parameters based on method
        if let parameters = parameters {
            switch method {
            case .get:
                var components = URLComponents(url: url, resolvingAgainstBaseURL: false)
                components?.queryItems = parameters.map { URLQueryItem(name: $0.key, value: "\($0.value)") }
                request.url = components?.url
            default:
                request.httpBody = try JSONSerialization.data(withJSONObject: parameters)
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            }
        }
        
        // Add payment gateway specific headers
        switch self {
        case .createStripePayment, .addStripePaymentMethod:
            request.setValue("stripe/v2023-10", forHTTPHeaderField: "X-Payment-Version")
        case .createTranzillaPayment, .addTranzillaPaymentMethod:
            request.setValue("tranzilla/v1.0", forHTTPHeaderField: "X-Payment-Version")
        default:
            break
        }
        
        // Configure cache policy
        request.cachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        
        return request
    }
}