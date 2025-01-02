// Foundation v13.0+
import Foundation
// Combine v13.0+
import Combine

/// View model responsible for managing donation history data and business logic
/// with support for real-time updates, offline caching, and error handling
@available(iOS 13.0, *)
public final class DonationHistoryViewModel: ViewModelType {
    
    // MARK: - Types
    
    /// Possible user actions in donation history view
    public enum DonationHistoryAction: Equatable {
        case loadHistory
        case loadMore
        case refresh
        case cancelRecurring(String)
        case retryFailedLoad
        case acknowledgeError
    }
    
    /// Loading states for the view
    public enum LoadingState: Equatable {
        case idle
        case loading
        case loadingMore
        case refreshing
        case error(String)
    }
    
    /// Input events structure
    public struct DonationHistoryInput {
        let action: AnyPublisher<DonationHistoryAction, Never>
        let cancellationToken: AnyPublisher<Void, Never>
    }
    
    /// Output events structure
    public struct DonationHistoryOutput {
        let donations: AnyPublisher<[Donation], Never>
        let loadingState: AnyPublisher<LoadingState, Never>
        let error: AnyPublisher<LocalizedError?, Never>
        let hasMorePages: AnyPublisher<Bool, Never>
        let realTimeUpdates: AnyPublisher<DonationUpdate, Never>
    }
    
    // MARK: - Properties
    
    private let donationService: DonationService
    private var currentPage = 1
    private let pageSize = 20
    private var hasMorePages = true
    private var cancellables = Set<AnyCancellable>()
    
    private let donationsSubject = CurrentValueSubject<[Donation], Never>([])
    private let loadingStateSubject = CurrentValueSubject<LoadingState, Never>(.idle)
    private let errorSubject = CurrentValueSubject<LocalizedError?, Never>(nil)
    private let hasMorePagesSubject = CurrentValueSubject<Bool, Never>(true)
    private let realTimeUpdatesSubject = PassthroughSubject<DonationUpdate, Never>()
    
    // MARK: - Initialization
    
    /// Initializes the donation history view model
    /// - Parameter donationService: Service for donation operations
    public init(donationService: DonationService = .shared) {
        self.donationService = donationService
        setupRealTimeUpdates()
    }
    
    // MARK: - ViewModelType Implementation
    
    public func transform(input: DonationHistoryInput) -> DonationHistoryOutput {
        // Handle user actions
        input.action
            .sink { [weak self] action in
                self?.handleAction(action)
            }
            .store(in: &cancellables)
        
        // Handle cancellation
        input.cancellationToken
            .sink { [weak self] _ in
                self?.cleanup()
            }
            .store(in: &cancellables)
        
        return DonationHistoryOutput(
            donations: donationsSubject.eraseToAnyPublisher(),
            loadingState: loadingStateSubject.eraseToAnyPublisher(),
            error: errorSubject.eraseToAnyPublisher(),
            hasMorePages: hasMorePagesSubject.eraseToAnyPublisher(),
            realTimeUpdates: realTimeUpdatesSubject.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func handleAction(_ action: DonationHistoryAction) {
        switch action {
        case .loadHistory:
            loadDonationHistory()
        case .loadMore:
            loadMoreDonations()
        case .refresh:
            refreshDonationHistory()
        case .cancelRecurring(let donationId):
            cancelRecurringDonation(donationId)
        case .retryFailedLoad:
            retryFailedOperation()
        case .acknowledgeError:
            errorSubject.send(nil)
        }
    }
    
    private func loadDonationHistory() {
        guard loadingStateSubject.value == .idle else { return }
        
        loadingStateSubject.send(.loading)
        currentPage = 1
        
        donationService.getDonationHistory(page: currentPage, limit: pageSize)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                    self?.loadingStateSubject.send(.idle)
                },
                receiveValue: { [weak self] response in
                    self?.donationsSubject.send(response.items)
                    self?.hasMorePages = response.items.count >= self?.pageSize ?? 0
                    self?.hasMorePagesSubject.send(self?.hasMorePages ?? false)
                }
            )
            .store(in: &cancellables)
    }
    
    private func loadMoreDonations() {
        guard loadingStateSubject.value == .idle,
              hasMorePages else { return }
        
        loadingStateSubject.send(.loadingMore)
        currentPage += 1
        
        donationService.getDonationHistory(page: currentPage, limit: pageSize)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                    self?.loadingStateSubject.send(.idle)
                },
                receiveValue: { [weak self] response in
                    guard let self = self else { return }
                    var currentDonations = self.donationsSubject.value
                    currentDonations.append(contentsOf: response.items)
                    self.donationsSubject.send(currentDonations)
                    self.hasMorePages = response.items.count >= self.pageSize
                    self.hasMorePagesSubject.send(self.hasMorePages)
                }
            )
            .store(in: &cancellables)
    }
    
    private func refreshDonationHistory() {
        loadingStateSubject.send(.refreshing)
        currentPage = 1
        
        donationService.getDonationHistory(page: currentPage, limit: pageSize)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                    self?.loadingStateSubject.send(.idle)
                },
                receiveValue: { [weak self] response in
                    self?.donationsSubject.send(response.items)
                    self?.hasMorePages = response.items.count >= self?.pageSize ?? 0
                    self?.hasMorePagesSubject.send(self?.hasMorePages ?? false)
                }
            )
            .store(in: &cancellables)
    }
    
    private func cancelRecurringDonation(_ donationId: String) {
        donationService.cancelRecurringDonation(donationId)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                },
                receiveValue: { [weak self] success in
                    if success {
                        self?.updateDonationStatus(donationId: donationId, status: .cancelled)
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    private func setupRealTimeUpdates() {
        donationService.observeDonationUpdates()
            .receive(on: DispatchQueue.main)
            .sink { [weak self] update in
                self?.realTimeUpdatesSubject.send(update)
                self?.updateDonationStatus(donationId: update.donationId, status: update.status)
            }
            .store(in: &cancellables)
    }
    
    private func updateDonationStatus(donationId: String, status: PaymentStatus) {
        var currentDonations = donationsSubject.value
        if let index = currentDonations.firstIndex(where: { $0.id == donationId }) {
            currentDonations[index].updatePaymentStatus(status)
            donationsSubject.send(currentDonations)
        }
    }
    
    private func handleError(_ error: Error) {
        errorSubject.send(error as? LocalizedError)
        loadingStateSubject.send(.error(error.localizedDescription))
    }
    
    private func retryFailedOperation() {
        loadDonationHistory()
    }
    
    private func cleanup() {
        cancellables.removeAll()
    }
}

// MARK: - Supporting Types

public struct DonationUpdate {
    let donationId: String
    let status: PaymentStatus
    let timestamp: Date
}