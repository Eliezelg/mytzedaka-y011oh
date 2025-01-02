//
// CampaignService.swift
// IJAP
//
// Foundation version: iOS 13.0+
// Combine version: iOS 13.0+
//

import Foundation
import Combine

/// Service class responsible for managing campaign-related operations including CRUD operations,
/// campaign progress tracking, lottery campaign management, and multi-currency support
@available(iOS 13.0, *)
public final class CampaignService {
    
    // MARK: - Properties
    
    private let apiClient: APIClient
    private var cancellables = Set<AnyCancellable>()
    private let campaignCache: NSCache<NSString, Campaign>
    private let progressTracker: ProgressTracker
    private let currencyConverter: CurrencyConverter
    
    // MARK: - Constants
    
    private enum Constants {
        static let cacheSizeLimit = 100
        static let cacheMemoryLimit = 50 * 1024 * 1024 // 50MB
        static let defaultPageSize = 20
        static let maxRetries = 3
    }
    
    // MARK: - Initialization
    
    public init(apiClient: APIClient = .shared,
                currencyConverter: CurrencyConverter = CurrencyConverter()) {
        self.apiClient = apiClient
        self.currencyConverter = currencyConverter
        
        // Configure campaign cache
        self.campaignCache = NSCache<NSString, Campaign>()
        campaignCache.countLimit = Constants.cacheSizeLimit
        campaignCache.totalCostLimit = Constants.cacheMemoryLimit
        
        // Initialize progress tracker
        self.progressTracker = ProgressTracker()
    }
    
    // MARK: - Public Methods
    
    /// Fetches campaigns with optional filtering and currency conversion
    /// - Parameters:
    ///   - associationId: Optional association ID filter
    ///   - activeOnly: Filter for active campaigns only
    ///   - currency: Target currency for conversion
    /// - Returns: Publisher emitting array of campaigns or error
    public func fetchCampaigns(
        associationId: String? = nil,
        activeOnly: Bool = false,
        currency: String? = nil
    ) -> AnyPublisher<[Campaign], APIError> {
        // Check cache first if no filters are applied
        if associationId == nil && !activeOnly && currency == nil {
            if let cachedCampaigns = getCachedCampaigns() {
                return Just(cachedCampaigns)
                    .setFailureType(to: APIError.self)
                    .eraseToAnyPublisher()
            }
        }
        
        return apiClient.request(
            .getCampaigns(
                associationId: associationId,
                page: 1,
                limit: Constants.defaultPageSize,
                locale: Locale.current.languageCode ?? "en"
            ),
            type: [Campaign].self
        )
        .tryMap { campaigns in
            // Filter active campaigns if requested
            let filteredCampaigns = activeOnly ? campaigns.filter { $0.isActive() } : campaigns
            
            // Convert currency if needed
            if let targetCurrency = currency {
                return try self.convertCampaigns(filteredCampaigns, to: targetCurrency)
            }
            return filteredCampaigns
        }
        .mapError { error in
            if let apiError = error as? APIError {
                return apiError
            }
            return APIError.unknown
        }
        .handleEvents(receiveOutput: { [weak self] campaigns in
            self?.cacheCampaigns(campaigns)
        })
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }
    
    /// Creates a new campaign with comprehensive validation and image handling
    /// - Parameters:
    ///   - campaign: Campaign model to create
    ///   - images: Optional array of campaign images
    ///   - currencyValidation: Currency validation requirements
    /// - Returns: Publisher emitting created campaign or error
    public func createCampaign(
        campaign: Campaign,
        images: [Data]? = nil,
        currencyValidation: CurrencyValidation = .strict
    ) -> AnyPublisher<Campaign, APIError> {
        // Validate campaign data
        guard campaign.validate() else {
            return Fail(error: APIError.validationError(["campaign": ["Invalid campaign data"]]))
                .eraseToAnyPublisher()
        }
        
        // Process and upload images if provided
        let imageUpload: AnyPublisher<[String], APIError>
        if let images = images {
            imageUpload = uploadCampaignImages(images)
        } else {
            imageUpload = Just([String]())
                .setFailureType(to: APIError.self)
                .eraseToAnyPublisher()
        }
        
        return imageUpload
            .flatMap { imageUrls -> AnyPublisher<Campaign, APIError> in
                var campaignData = self.prepareCampaignData(campaign, imageUrls: imageUrls)
                
                return self.apiClient.request(
                    .createCampaign(data: campaignData),
                    type: Campaign.self
                )
            }
            .handleEvents(receiveOutput: { [weak self] campaign in
                self?.campaignCache.setObject(campaign, forKey: campaign.id as NSString)
            })
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
    
    /// Retrieves detailed lottery campaign information
    /// - Parameter campaignId: ID of the lottery campaign
    /// - Returns: Publisher emitting lottery campaign details or error
    public func getLotteryCampaignDetails(
        campaignId: String
    ) -> AnyPublisher<CampaignLotteryDetails, APIError> {
        // Validate campaign exists and is lottery type
        return apiClient.request(
            .getCampaignDetail(id: campaignId, locale: Locale.current.languageCode ?? "en"),
            type: Campaign.self
        )
        .tryMap { campaign -> CampaignLotteryDetails in
            guard campaign.isLottery,
                  let lotteryDetails = campaign.lotteryDetails else {
                throw APIError.validationError(["campaign": ["Not a lottery campaign"]])
            }
            return lotteryDetails
        }
        .mapError { error in
            if let apiError = error as? APIError {
                return apiError
            }
            return APIError.unknown
        }
        .receive(on: DispatchQueue.main)
        .eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func getCachedCampaigns() -> [Campaign]? {
        // Implementation for retrieving cached campaigns
        return nil
    }
    
    private func cacheCampaigns(_ campaigns: [Campaign]) {
        campaigns.forEach { campaign in
            campaignCache.setObject(campaign, forKey: campaign.id as NSString)
        }
    }
    
    private func convertCampaigns(_ campaigns: [Campaign], to targetCurrency: String) throws -> [Campaign] {
        // Implementation for currency conversion
        return campaigns
    }
    
    private func uploadCampaignImages(_ images: [Data]) -> AnyPublisher<[String], APIError> {
        // Implementation for image upload
        return Empty().eraseToAnyPublisher()
    }
    
    private func prepareCampaignData(_ campaign: Campaign, imageUrls: [String]) -> [String: Any] {
        // Implementation for preparing campaign data
        return [:]
    }
}

// MARK: - Supporting Types

/// Currency validation requirements for campaign operations
public enum CurrencyValidation {
    case strict
    case flexible
}

/// Tracks campaign progress updates
private class ProgressTracker {
    // Implementation for progress tracking
}

/// Handles currency conversion operations
private class CurrencyConverter {
    // Implementation for currency conversion
}