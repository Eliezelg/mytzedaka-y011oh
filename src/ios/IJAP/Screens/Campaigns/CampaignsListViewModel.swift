import Foundation // iOS 13.0+
import Combine // iOS 13.0+

/// Enumeration defining campaign sorting options
public enum CampaignSortOption {
    case dateAscending
    case dateDescending
    case progressAscending
    case progressDescending
    case goalAmountAscending
    case goalAmountDescending
}

/// ViewModel responsible for managing campaigns list screen state and business logic
/// with enhanced currency conversion and filtering support
@available(iOS 13.0, *)
public final class CampaignsListViewModel: ViewModelType {
    
    // MARK: - Input Definition
    
    public struct Input {
        let viewDidLoad: PassthroughSubject<Void, Never>
        let refresh: PassthroughSubject<Void, Never>
        let searchText: PassthroughSubject<String?, Never>
        let activeFilter: PassthroughSubject<Bool, Never>
        let currencySelection: PassthroughSubject<String, Never>
        let sortOption: PassthroughSubject<CampaignSortOption, Never>
    }
    
    // MARK: - Output Definition
    
    public struct Output {
        let campaigns: AnyPublisher<[Campaign], Never>
        let isLoading: AnyPublisher<Bool, Never>
        let error: AnyPublisher<Error?, Never>
        let selectedCurrency: AnyPublisher<String, Never>
        let currentSortOption: AnyPublisher<CampaignSortOption, Never>
    }
    
    // MARK: - Private Properties
    
    private let campaignService: CampaignService
    private var cancellables = Set<AnyCancellable>()
    
    private let campaigns = CurrentValueSubject<[Campaign], Never>([])
    private let isLoading = CurrentValueSubject<Bool, Never>(false)
    private let error = CurrentValueSubject<Error?, Never>(nil)
    private let selectedCurrency = CurrentValueSubject<String, Never>("USD")
    private let currencyRates = CurrentValueSubject<[String: Decimal], Never>([:])
    private let sortOption = CurrentValueSubject<CampaignSortOption, Never>(.dateDescending)
    
    // MARK: - Initialization
    
    public init(campaignService: CampaignService, defaultCurrency: String = "USD") {
        self.campaignService = campaignService
        self.selectedCurrency.send(defaultCurrency)
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(input: Input) -> Output {
        // Handle view load event
        input.viewDidLoad
            .sink { [weak self] _ in
                self?.loadCampaigns(activeOnly: false, currency: self?.selectedCurrency.value ?? "USD")
            }
            .store(in: &cancellables)
        
        // Handle refresh event
        input.refresh
            .sink { [weak self] _ in
                self?.refreshCampaigns()
            }
            .store(in: &cancellables)
        
        // Handle search text changes
        input.searchText
            .debounce(for: .milliseconds(300), scheduler: RunLoop.main)
            .sink { [weak self] searchText in
                self?.filterAndSortCampaigns(
                    searchText: searchText,
                    activeOnly: false,
                    sortOption: self?.sortOption.value ?? .dateDescending,
                    currency: self?.selectedCurrency.value ?? "USD"
                )
            }
            .store(in: &cancellables)
        
        // Handle active filter changes
        input.activeFilter
            .sink { [weak self] activeOnly in
                self?.filterAndSortCampaigns(
                    searchText: nil,
                    activeOnly: activeOnly,
                    sortOption: self?.sortOption.value ?? .dateDescending,
                    currency: self?.selectedCurrency.value ?? "USD"
                )
            }
            .store(in: &cancellables)
        
        // Handle currency selection changes
        input.currencySelection
            .sink { [weak self] currency in
                self?.selectedCurrency.send(currency)
                self?.loadCampaigns(activeOnly: false, currency: currency)
            }
            .store(in: &cancellables)
        
        // Handle sort option changes
        input.sortOption
            .sink { [weak self] option in
                self?.sortOption.send(option)
                self?.filterAndSortCampaigns(
                    searchText: nil,
                    activeOnly: false,
                    sortOption: option,
                    currency: self?.selectedCurrency.value ?? "USD"
                )
            }
            .store(in: &cancellables)
        
        return Output(
            campaigns: campaigns.eraseToAnyPublisher(),
            isLoading: isLoading.eraseToAnyPublisher(),
            error: error.eraseToAnyPublisher(),
            selectedCurrency: selectedCurrency.eraseToAnyPublisher(),
            currentSortOption: sortOption.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func loadCampaigns(associationId: String? = nil, activeOnly: Bool, currency: String) {
        isLoading.send(true)
        error.send(nil)
        
        campaignService.fetchCampaigns(associationId: associationId, activeOnly: activeOnly, currency: currency)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading.send(false)
                    if case .failure(let error) = completion {
                        self?.error.send(error)
                    }
                },
                receiveValue: { [weak self] campaigns in
                    self?.campaigns.send(campaigns)
                }
            )
            .store(in: &cancellables)
    }
    
    private func refreshCampaigns() {
        loadCampaigns(
            activeOnly: false,
            currency: selectedCurrency.value
        )
    }
    
    private func filterAndSortCampaigns(
        searchText: String?,
        activeOnly: Bool,
        sortOption: CampaignSortOption,
        currency: String
    ) {
        var filteredCampaigns = campaigns.value
        
        // Apply search text filter
        if let searchText = searchText, !searchText.isEmpty {
            filteredCampaigns = filteredCampaigns.filter {
                $0.title.localizedCaseInsensitiveContains(searchText) ||
                $0.description.localizedCaseInsensitiveContains(searchText)
            }
        }
        
        // Apply active filter
        if activeOnly {
            filteredCampaigns = filteredCampaigns.filter { $0.isActive() }
        }
        
        // Apply sorting
        filteredCampaigns.sort { campaign1, campaign2 in
            switch sortOption {
            case .dateAscending:
                return campaign1.startDate < campaign2.startDate
            case .dateDescending:
                return campaign1.startDate > campaign2.startDate
            case .progressAscending:
                return campaign1.getProgress() < campaign2.getProgress()
            case .progressDescending:
                return campaign1.getProgress() > campaign2.getProgress()
            case .goalAmountAscending:
                return campaign1.goalAmount < campaign2.goalAmount
            case .goalAmountDescending:
                return campaign1.goalAmount > campaign2.goalAmount
            }
        }
        
        campaigns.send(filteredCampaigns)
    }
}