//
// HomeViewModel.swift
// IJAP
//
// Foundation version: iOS 13.0+
// Combine version: iOS 13.0+
//

import Foundation
import Combine

/// Enhanced ViewModel for the Home screen managing featured campaigns and recent associations
/// with offline support, error handling, and state management
@available(iOS 13.0, *)
public final class HomeViewModel: ViewModelType {
    
    // MARK: - Nested Types
    
    /// Input events for the home view model
    public struct Input {
        let viewAppeared: PassthroughSubject<Void, Never>
        let refreshTriggered: PassthroughSubject<Void, Never>
        let retryTriggered: PassthroughSubject<Void, Never>
        
        public init() {
            self.viewAppeared = PassthroughSubject<Void, Never>()
            self.refreshTriggered = PassthroughSubject<Void, Never>()
            self.retryTriggered = PassthroughSubject<Void, Never>()
        }
    }
    
    /// Output events and data for the home view
    public struct Output {
        let featuredCampaigns: AnyPublisher<[Campaign], Error>
        let recentAssociations: AnyPublisher<[Association], Error>
        let viewState: AnyPublisher<ViewState, Never>
        let isOffline: AnyPublisher<Bool, Never>
        let error: AnyPublisher<Error?, Never>
    }
    
    /// View state representation
    private enum ViewState {
        case idle
        case loading
        case loaded
        case error(Error)
    }
    
    // MARK: - Properties
    
    private let campaignService: CampaignService
    private let associationService: AssociationService
    private var cancellables = Set<AnyCancellable>()
    private let isOffline = CurrentValueSubject<Bool, Never>(false)
    private let viewState = CurrentValueSubject<ViewState, Never>(.idle)
    private let errorSubject = CurrentValueSubject<Error?, Never>(nil)
    
    // MARK: - Initialization
    
    public init(
        campaignService: CampaignService = CampaignService(),
        associationService: AssociationService = AssociationService.shared
    ) {
        self.campaignService = campaignService
        self.associationService = associationService
        
        // Setup network monitoring
        setupNetworkMonitoring()
        
        // Setup memory warning observer
        setupMemoryWarningObserver()
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(input: Input) -> Output {
        // Handle view appeared event
        let viewAppearedPublisher = input.viewAppeared
            .handleEvents(receiveOutput: { [weak self] _ in
                self?.viewState.send(.loading)
            })
            .share()
        
        // Handle refresh triggered event
        let refreshPublisher = input.refreshTriggered
            .handleEvents(receiveOutput: { [weak self] _ in
                self?.viewState.send(.loading)
            })
            .share()
        
        // Combine triggers for data fetch
        let triggerPublisher = Publishers.Merge(viewAppearedPublisher, refreshPublisher)
            .share()
        
        // Setup featured campaigns publisher
        let featuredCampaignsPublisher = triggerPublisher
            .flatMap { [weak self] _ -> AnyPublisher<[Campaign], Error> in
                guard let self = self else {
                    return Fail(error: APIError.unknown).eraseToAnyPublisher()
                }
                return self.fetchFeaturedCampaigns()
            }
            .handleEvents(
                receiveOutput: { [weak self] _ in
                    self?.viewState.send(.loaded)
                },
                receiveError: { [weak self] error in
                    self?.handleError(error)
                }
            )
            .share()
            .eraseToAnyPublisher()
        
        // Setup recent associations publisher
        let recentAssociationsPublisher = triggerPublisher
            .flatMap { [weak self] _ -> AnyPublisher<[Association], Error> in
                guard let self = self else {
                    return Fail(error: APIError.unknown).eraseToAnyPublisher()
                }
                return self.fetchRecentAssociations()
            }
            .handleEvents(
                receiveOutput: { [weak self] _ in
                    self?.viewState.send(.loaded)
                },
                receiveError: { [weak self] error in
                    self?.handleError(error)
                }
            )
            .share()
            .eraseToAnyPublisher()
        
        // Handle retry triggered
        input.retryTriggered
            .sink { [weak self] _ in
                self?.viewState.send(.loading)
                self?.errorSubject.send(nil)
            }
            .store(in: &cancellables)
        
        return Output(
            featuredCampaigns: featuredCampaignsPublisher,
            recentAssociations: recentAssociationsPublisher,
            viewState: viewState.eraseToAnyPublisher(),
            isOffline: isOffline.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func fetchFeaturedCampaigns() -> AnyPublisher<[Campaign], Error> {
        campaignService.fetchCampaigns(activeOnly: true)
            .map { campaigns in
                // Filter and sort featured campaigns
                campaigns
                    .filter { $0.isActive() }
                    .sorted { $0.getProgress() > $1.getProgress() }
                    .prefix(5)
                    .map { $0 }
            }
            .catch { [weak self] error -> AnyPublisher<[Campaign], Error> in
                // Handle offline scenario
                if case APIError.noInternetConnection = error,
                   let cachedCampaigns = self?.campaignService.getCachedCampaigns() {
                    return Just(cachedCampaigns)
                        .setFailureType(to: Error.self)
                        .eraseToAnyPublisher()
                }
                return Fail(error: error).eraseToAnyPublisher()
            }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
    
    private func fetchRecentAssociations() -> AnyPublisher<[Association], Error> {
        associationService.fetchAssociations()
            .map { associations in
                // Filter and sort recent associations
                associations
                    .filter { $0.status == "ACTIVE" && $0.isVerified }
                    .sorted { $0.createdAt > $1.createdAt }
                    .prefix(10)
                    .map { $0 }
            }
            .catch { [weak self] error -> AnyPublisher<[Association], Error> in
                // Handle offline scenario
                if case APIError.noInternetConnection = error,
                   let cachedAssociations = self?.associationService.getCachedAssociations() {
                    return Just(cachedAssociations)
                        .setFailureType(to: Error.self)
                        .eraseToAnyPublisher()
                }
                return Fail(error: error).eraseToAnyPublisher()
            }
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
    }
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] isConnected in
                self?.isOffline.send(!isConnected)
            }
            .store(in: &cancellables)
    }
    
    private func setupMemoryWarningObserver() {
        NotificationCenter.default.publisher(for: UIApplication.didReceiveMemoryWarningNotification)
            .sink { [weak self] _ in
                self?.cancellables.removeAll()
            }
            .store(in: &cancellables)
    }
    
    private func handleError(_ error: Error) {
        errorSubject.send(error)
        viewState.send(.error(error))
    }
    
    // MARK: - Deinitialization
    
    deinit {
        cancellables.removeAll()
    }
}