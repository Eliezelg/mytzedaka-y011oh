import Foundation
import Combine

/// View model responsible for managing associations list screen state and business logic
/// with enhanced offline support and performance optimizations
@available(iOS 13.0, *)
final class AssociationsListViewModel: ViewModelType {
    
    // MARK: - Types
    
    /// Synchronization state for offline support
    enum SyncState {
        case synced
        case syncing
        case needsSync
        case error(Error)
    }
    
    // MARK: - Properties
    
    private let associationService: AssociationService
    private var cancellables = Set<AnyCancellable>()
    
    // Publishers
    private let isLoading = CurrentValueSubject<Bool, Never>(false)
    private let error = CurrentValueSubject<Error?, Never>(nil)
    private let syncState = CurrentValueSubject<SyncState, Never>(.synced)
    private let searchDebouncer = PassthroughSubject<String, Never>()
    
    // MARK: - Initialization
    
    init(associationService: AssociationService = .shared,
         searchDebounceInterval: TimeInterval = 0.5) {
        self.associationService = associationService
        
        // Configure search debouncer
        setupSearchDebouncer(interval: searchDebounceInterval)
        
        // Monitor network status for sync
        setupNetworkMonitoring()
    }
    
    // MARK: - ViewModelType Implementation
    
    func transform(input: AssociationsListViewModelInput) -> AssociationsListViewModelOutput {
        // Handle load trigger
        let loadPublisher = input.loadTrigger
            .handleEvents(receiveOutput: { [weak self] _ in
                self?.isLoading.send(true)
            })
            .flatMap { [weak self] _ -> AnyPublisher<[Association], Error> in
                guard let self = self else {
                    return Empty().eraseToAnyPublisher()
                }
                return self.loadAssociations()
            }
            .share()
        
        // Handle search trigger with debounce
        let searchPublisher = input.searchTrigger
            .debounce(for: .milliseconds(500), scheduler: DispatchQueue.main)
            .flatMap { [weak self] query -> AnyPublisher<[Association], Error> in
                guard let self = self else {
                    return Empty().eraseToAnyPublisher()
                }
                return self.searchAssociations(query: query)
            }
            .share()
        
        // Handle refresh trigger
        let refreshPublisher = input.refreshTrigger
            .handleEvents(receiveOutput: { [weak self] _ in
                self?.syncState.send(.syncing)
            })
            .flatMap { [weak self] _ -> AnyPublisher<[Association], Error> in
                guard let self = self else {
                    return Empty().eraseToAnyPublisher()
                }
                return self.associationService.syncOfflineChanges()
                    .flatMap { self.loadAssociations() }
                    .eraseToAnyPublisher()
            }
            .share()
        
        // Handle connectivity changes
        input.connectivityChanged
            .sink { [weak self] isConnected in
                if isConnected {
                    self?.handleConnectivityRestored()
                }
            }
            .store(in: &cancellables)
        
        // Combine all publishers
        let associationsPublisher = Publishers.Merge3(
            loadPublisher,
            searchPublisher,
            refreshPublisher
        )
        .handleEvents(
            receiveCompletion: { [weak self] completion in
                self?.isLoading.send(false)
                if case .failure(let error) = completion {
                    self?.error.send(error)
                }
            }
        )
        .catch { [weak self] error -> AnyPublisher<[Association], Never> in
            self?.error.send(error)
            return Just([]).eraseToAnyPublisher()
        }
        .eraseToAnyPublisher()
        
        return AssociationsListViewModelOutput(
            loading: isLoading.eraseToAnyPublisher(),
            associations: associationsPublisher,
            error: error.eraseToAnyPublisher(),
            syncState: syncState.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func loadAssociations() -> AnyPublisher<[Association], Error> {
        return associationService.fetchAssociations()
            .handleEvents(
                receiveOutput: { [weak self] _ in
                    self?.syncState.send(.synced)
                },
                receiveCompletion: { [weak self] completion in
                    if case .failure = completion {
                        self?.syncState.send(.needsSync)
                    }
                }
            )
            .eraseToAnyPublisher()
    }
    
    private func searchAssociations(query: String) -> AnyPublisher<[Association], Error> {
        return associationService.searchAssociations(query: query)
            .handleEvents(receiveOutput: { [weak self] _ in
                self?.isLoading.send(false)
            })
            .eraseToAnyPublisher()
    }
    
    private func setupSearchDebouncer(interval: TimeInterval) {
        searchDebouncer
            .debounce(for: .seconds(interval), scheduler: DispatchQueue.main)
            .sink { [weak self] query in
                self?.searchAssociations(query: query)
                    .sink(
                        receiveCompletion: { _ in },
                        receiveValue: { _ in }
                    )
                    .store(in: &self!.cancellables)
            }
            .store(in: &cancellables)
    }
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] isConnected in
                if isConnected {
                    self?.handleConnectivityRestored()
                }
            }
            .store(in: &cancellables)
    }
    
    private func handleConnectivityRestored() {
        if case .needsSync = syncState.value {
            associationService.syncOfflineChanges()
                .sink(
                    receiveCompletion: { [weak self] completion in
                        if case .failure(let error) = completion {
                            self?.syncState.send(.error(error))
                        }
                    },
                    receiveValue: { [weak self] _ in
                        self?.syncState.send(.synced)
                    }
                )
                .store(in: &cancellables)
        }
    }
}

// MARK: - Input/Output Types

/// Input events for the associations list view model
enum AssociationsListViewModelInput {
    case loadTrigger(AnyPublisher<Void, Never>)
    case searchTrigger(AnyPublisher<String, Never>)
    case refreshTrigger(AnyPublisher<Void, Never>)
    case connectivityChanged(AnyPublisher<Bool, Never>)
}

/// Output state for the associations list view
struct AssociationsListViewModelOutput {
    let loading: AnyPublisher<Bool, Never>
    let associations: AnyPublisher<[Association], Never>
    let error: AnyPublisher<Error?, Never>
    let syncState: AnyPublisher<AssociationsListViewModel.SyncState, Never>
}