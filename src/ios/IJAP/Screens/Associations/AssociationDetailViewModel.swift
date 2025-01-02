//
// AssociationDetailViewModel.swift
// IJAP
//
// Foundation version: iOS 13.0+
// Combine version: iOS 13.0+
//

import Foundation
import Combine
import os.log

/// View model responsible for managing association detail screen business logic
/// with enhanced security, offline support, and comprehensive error handling
@available(iOS 13.0, *)
public final class AssociationDetailViewModel {
    
    // MARK: - Type Definitions
    
    /// Input actions that the view model can handle
    public struct Input {
        let loadTrigger: AnyPublisher<String, Never>
        let refreshTrigger: AnyPublisher<Void, Never>
        let verifyTrigger: AnyPublisher<Void, Never>
    }
    
    /// Output state that the view model provides
    public struct Output {
        let association: AnyPublisher<Association?, Never>
        let isLoading: AnyPublisher<Bool, Never>
        let error: AnyPublisher<LocalizedError?, Never>
        let isOffline: AnyPublisher<Bool, Never>
    }
    
    // MARK: - Properties
    
    private let associationService: AssociationService
    private var cancellables = Set<AnyCancellable>()
    
    // State publishers
    private let association = CurrentValueSubject<Association?, Never>(nil)
    private let isLoading = CurrentValueSubject<Bool, Never>(false)
    private let error = CurrentValueSubject<LocalizedError?, Never>(nil)
    private let isOffline = CurrentValueSubject<Bool, Never>(false)
    
    // Logger
    private let logger = Logger(
        subsystem: Bundle.main.bundleIdentifier ?? "com.ijap",
        category: "AssociationDetailViewModel"
    )
    
    // MARK: - Initialization
    
    /// Initializes the view model with required dependencies
    /// - Parameter associationService: Service for association data operations
    public init(associationService: AssociationService = .shared) {
        self.associationService = associationService
        
        // Setup network monitoring
        setupNetworkMonitoring()
        
        // Setup memory warning observer
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
    }
    
    // MARK: - Public Methods
    
    /// Transforms input actions into output state
    /// - Parameter input: Input actions to process
    /// - Returns: Output state publishers
    public func transform(_ input: Input) -> Output {
        // Handle load trigger
        input.loadTrigger
            .removeDuplicates()
            .sink { [weak self] id in
                self?.loadAssociation(id: id)
            }
            .store(in: &cancellables)
        
        // Handle refresh trigger
        input.refreshTrigger
            .sink { [weak self] _ in
                if let currentId = self?.association.value?.id {
                    self?.loadAssociation(id: currentId, useCache: false)
                }
            }
            .store(in: &cancellables)
        
        // Handle verify trigger
        input.verifyTrigger
            .sink { [weak self] _ in
                self?.verifyAssociation()
            }
            .store(in: &cancellables)
        
        return Output(
            association: association.eraseToAnyPublisher(),
            isLoading: isLoading.eraseToAnyPublisher(),
            error: error.eraseToAnyPublisher(),
            isOffline: isOffline.eraseToAnyPublisher()
        )
    }
    
    // MARK: - Private Methods
    
    private func loadAssociation(id: String, useCache: Bool = true) {
        isLoading.send(true)
        error.send(nil)
        
        // Check network connectivity
        let isConnected = NetworkMonitor.shared.isConnected.value
        
        // Try loading from cache if offline or cache is requested
        if (!isConnected || useCache) {
            if let cachedAssociation = try? associationService.getCachedAssociation(id: id) {
                association.send(cachedAssociation)
                isLoading.send(false)
                
                if !isConnected {
                    logger.info("Loaded association \(id) from cache while offline")
                    return
                }
            }
        }
        
        // Proceed with network request if online
        if isConnected {
            associationService.getAssociation(id: id)
                .receive(on: DispatchQueue.main)
                .sink(
                    receiveCompletion: { [weak self] completion in
                        self?.isLoading.send(false)
                        if case .failure(let error) = completion {
                            self?.handleError(error)
                        }
                    },
                    receiveValue: { [weak self] association in
                        self?.association.send(association)
                        self?.logger.info("Successfully loaded association \(id)")
                    }
                )
                .store(in: &cancellables)
        } else {
            isLoading.send(false)
            error.send(APIError.noInternetConnection)
        }
    }
    
    private func verifyAssociation() {
        guard let association = association.value else {
            error.send(APIError.invalidResponse)
            return
        }
        
        isLoading.send(true)
        error.send(nil)
        
        associationService.verifyAssociation(id: association.id)
            .receive(on: DispatchQueue.main)
            .sink(
                receiveCompletion: { [weak self] completion in
                    self?.isLoading.send(false)
                    if case .failure(let error) = completion {
                        self?.handleError(error)
                    }
                },
                receiveValue: { [weak self] verified in
                    if verified {
                        self?.loadAssociation(id: association.id, useCache: false)
                        self?.logger.info("Successfully verified association \(association.id)")
                    }
                }
            )
            .store(in: &cancellables)
    }
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] connected in
                self?.isOffline.send(!connected)
                if connected {
                    // Refresh data when coming back online
                    if let currentId = self?.association.value?.id {
                        self?.loadAssociation(id: currentId, useCache: false)
                    }
                }
            }
            .store(in: &cancellables)
    }
    
    private func handleError(_ error: Error) {
        logger.error("Error: \(error.localizedDescription)")
        if let apiError = error as? APIError {
            self.error.send(apiError)
        } else {
            self.error.send(APIError.unknown)
        }
    }
    
    @objc private func handleMemoryWarning() {
        // Clear non-essential cached data
        cancellables.forEach { $0.cancel() }
        cancellables.removeAll()
        
        logger.info("Handled memory warning - cleared non-essential caches")
    }
    
    // MARK: - Deinitialization
    
    deinit {
        NotificationCenter.default.removeObserver(self)
        cancellables.removeAll()
    }
}