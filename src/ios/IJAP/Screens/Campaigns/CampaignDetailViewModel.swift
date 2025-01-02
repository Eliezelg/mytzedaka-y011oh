import Foundation // iOS 13.0+
import Combine // iOS 13.0+

/// ViewModel for managing campaign detail screen state and user interactions
/// with comprehensive error handling and real-time updates
@available(iOS 13.0, *)
final class CampaignDetailViewModel: ViewModelType {
    
    // MARK: - Input/Output Types
    
    struct Input {
        /// Triggered when view appears
        let viewAppear: AnyPublisher<Void, Never>
        /// Triggered when user requests refresh
        let refreshTrigger: AnyPublisher<Void, Never>
        /// Triggered when user requests retry after error
        let retryTrigger: AnyPublisher<Void, Never>
    }
    
    struct Output {
        /// Emits updated campaign details
        let campaignDetails: AnyPublisher<Campaign, Never>
        /// Emits campaign progress updates
        let progress: AnyPublisher<Double, Never>
        /// Emits lottery details if applicable
        let lotteryDetails: AnyPublisher<CampaignLotteryDetails?, Never>
        /// Emits loading state changes
        let isLoading: AnyPublisher<Bool, Never>
        /// Emits error state changes
        let error: AnyPublisher<Error?, Never>
        /// Emits formatted currency for display
        let formattedCurrency: AnyPublisher<String, Never>
    }
    
    // MARK: - Private Properties
    
    private let campaignService: CampaignService
    private let campaign: Campaign
    private var cancellables = Set<AnyCancellable>()
    
    private let refreshTrigger = PassthroughSubject<Void, Never>()
    private let isLoadingSubject = CurrentValueSubject<Bool, Never>(false)
    private let errorSubject = CurrentValueSubject<Error?, Never>(nil)
    private let campaignSubject: CurrentValueSubject<Campaign, Never>
    private let lotteryDetailsSubject = CurrentValueSubject<CampaignLotteryDetails?, Never>(nil)
    
    // MARK: - Initialization
    
    init(campaignService: CampaignService, campaign: Campaign) {
        self.campaignService = campaignService
        self.campaign = campaign
        self.campaignSubject = CurrentValueSubject<Campaign, Never>(campaign)
        
        // Set up automatic refresh interval for active campaigns
        if campaign.isActive() {
            Timer.publish(every: 30, on: .main, in: .common)
                .autoconnect()
                .sink { [weak self] _ in
                    self?.refreshTrigger.send()
                }
                .store(in: &cancellables)
        }
    }
    
    // MARK: - ViewModelType Implementation
    
    func transform(input: Input) -> Output {
        // Handle view appear events
        input.viewAppear
            .merge(with: input.retryTrigger)
            .sink { [weak self] _ in
                self?.refreshCampaignDetails()
            }
            .store(in: &cancellables)
        
        // Handle refresh trigger events
        input.refreshTrigger
            .merge(with: refreshTrigger)
            .sink { [weak self] _ in
                self?.refreshCampaignDetails()
            }
            .store(in: &cancellables)
        
        // Set up campaign progress updates
        let progress = campaignSubject
            .map { $0.getProgress() }
            .removeDuplicates()
            .eraseToAnyPublisher()
        
        // Set up lottery details updates if applicable
        if campaign.isLottery {
            campaignService.getLotteryCampaignDetails(campaignId: campaign.id)
                .sink(
                    receiveCompletion: { [weak self] completion in
                        if case .failure(let error) = completion {
                            self?.errorSubject.send(error)
                        }
                    },
                    receiveValue: { [weak self] details in
                        self?.lotteryDetailsSubject.send(details)
                    }
                )
                .store(in: &cancellables)
        }
        
        // Format currency for display
        let formattedCurrency = campaignSubject
            .map { campaign -> String in
                let formatter = NumberFormatter()
                formatter.numberStyle = .currency
                formatter.currencyCode = campaign.currency
                return formatter.string(from: NSDecimalNumber(decimal: campaign.goalAmount)) ?? ""
            }
            .eraseToAnyPublisher()
        
        return Output(
            campaignDetails: campaignSubject.eraseToAnyPublisher(),
            progress: progress,
            lotteryDetails: lotteryDetailsSubject.eraseToAnyPublisher(),
            isLoading: isLoadingSubject.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher(),
            formattedCurrency: formattedCurrency
        )
    }
    
    // MARK: - Private Methods
    
    private func refreshCampaignDetails() {
        isLoadingSubject.send(true)
        errorSubject.send(nil)
        
        campaignService.refreshCampaignData(campaignId: campaign.id)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoadingSubject.send(false)
                    if case .failure(let error) = completion {
                        self?.errorSubject.send(error)
                    }
                },
                receiveValue: { [weak self] updatedCampaign in
                    self?.campaignSubject.send(updatedCampaign)
                }
            )
            .store(in: &cancellables)
    }
}