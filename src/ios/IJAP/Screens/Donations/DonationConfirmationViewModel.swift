// Foundation v13.0+
import Foundation
// Combine v13.0+
import Combine

/// ViewModel responsible for managing donation confirmation screen state and business logic
/// with comprehensive error handling and real-time status monitoring
@available(iOS 13.0, *)
public final class DonationConfirmationViewModel: ViewModelType {
    
    // MARK: - Types
    
    public struct Input {
        /// Signal to load donation details
        let loadDonation: PassthroughSubject<String, Never>
        /// Signal when view appears
        let viewDidAppear: PassthroughSubject<Void, Never>
        /// Signal to retry failed operations
        let retry: PassthroughSubject<Void, Never>
        /// Signal to cancel ongoing operations
        let cancelOperation: PassthroughSubject<Void, Never>
        
        public init() {
            self.loadDonation = PassthroughSubject<String, Never>()
            self.viewDidAppear = PassthroughSubject<Void, Never>()
            self.retry = PassthroughSubject<Void, Never>()
            self.cancelOperation = PassthroughSubject<Void, Never>()
        }
    }
    
    public struct Output {
        /// Current donation details
        let donation: AnyPublisher<Donation?, Never>
        /// Loading state indicator
        let isLoading: AnyPublisher<Bool, Never>
        /// Error state
        let error: AnyPublisher<Error?, Never>
        /// Indicates if retry is available
        let retryAvailable: AnyPublisher<Bool, Never>
        /// Real-time payment status updates
        let statusUpdate: AnyPublisher<PaymentStatus, Never>
    }
    
    // MARK: - Properties
    
    private let donationService: DonationService
    private let donation = CurrentValueSubject<Donation?, Never>(nil)
    private let isLoading = CurrentValueSubject<Bool, Never>(false)
    private let error = CurrentValueSubject<Error?, Never>(nil)
    private var retryCount = 0
    private let maxRetries: Int
    private var statusUpdateTimer: Timer?
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Initialization
    
    /// Initializes the view model with required dependencies
    /// - Parameters:
    ///   - donationService: Service for donation operations
    ///   - maxRetries: Maximum number of retry attempts
    public init(donationService: DonationService = .shared, maxRetries: Int = 3) {
        self.donationService = donationService
        self.maxRetries = maxRetries
    }
    
    // MARK: - ViewModelType Conformance
    
    public func transform(input: Input) -> Output {
        // Handle donation loading
        input.loadDonation
            .sink { [weak self] donationId in
                self?.loadDonation(donationId: donationId)
            }
            .store(in: &cancellables)
        
        // Handle view appearance
        input.viewDidAppear
            .sink { [weak self] _ in
                self?.startStatusMonitoring()
            }
            .store(in: &cancellables)
        
        // Handle retry attempts
        input.retry
            .sink { [weak self] _ in
                guard let self = self,
                      let currentDonation = self.donation.value else { return }
                self.loadDonation(donationId: currentDonation.id)
            }
            .store(in: &cancellables)
        
        // Handle cancellation
        input.cancelOperation
            .sink { [weak self] _ in
                self?.cancelOperations()
            }
            .store(in: &cancellables)
        
        // Configure output
        return Output(
            donation: donation.eraseToAnyPublisher(),
            isLoading: isLoading.eraseToAnyPublisher(),
            error: error.eraseToAnyPublisher(),
            retryAvailable: donation
                .map { [weak self] _ in
                    guard let self = self else { return false }
                    return self.retryCount < self.maxRetries
                }
                .eraseToAnyPublisher(),
            statusUpdate: donation
                .compactMap { $0?.paymentStatus }
                .eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func loadDonation(donationId: String) {
        isLoading.send(true)
        error.send(nil)
        
        donationService.getDonationById(donationId)
            .retry(when: { [weak self] error -> AnyPublisher<Void, Never> in
                guard let self = self else {
                    return Empty().eraseToAnyPublisher()
                }
                return self.retryOperation(error: error)
            })
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading.send(false)
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                },
                receiveValue: { [weak self] donation in
                    self?.donation.send(donation)
                    self?.startStatusMonitoring()
                }
            )
            .store(in: &cancellables)
    }
    
    private func startStatusMonitoring() {
        guard let donation = donation.value else { return }
        
        donationService.observeDonationStatus(donation.id)
            .sink(
                receiveCompletion: { [weak self] completion in
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                },
                receiveValue: { [weak self] updatedDonation in
                    self?.donation.send(updatedDonation)
                    
                    // Stop monitoring for terminal states
                    if case .completed = updatedDonation.paymentStatus {
                        self?.stopStatusMonitoring()
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    private func retryOperation(error: Error) -> AnyPublisher<Void, Never> {
        guard retryCount < maxRetries else {
            return Empty().eraseToAnyPublisher()
        }
        
        retryCount += 1
        let delay = TimeInterval(pow(2.0, Double(retryCount))) // Exponential backoff
        
        return Just(())
            .delay(for: .seconds(delay), scheduler: DispatchQueue.global())
            .eraseToAnyPublisher()
    }
    
    private func handleError(_ error: Error) {
        self.error.send(error)
        stopStatusMonitoring()
    }
    
    private func stopStatusMonitoring() {
        statusUpdateTimer?.invalidate()
        statusUpdateTimer = nil
    }
    
    private func cancelOperations() {
        cancellables.forEach { $0.cancel() }
        stopStatusMonitoring()
        isLoading.send(false)
    }
    
    deinit {
        cancelOperations()
    }
}