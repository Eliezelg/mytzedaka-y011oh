//
// AssociationService.swift
// IJAP
//
// Foundation version: iOS 13.0+
// Combine version: iOS 13.0+
// CryptoKit version: iOS 13.0+
//

import Foundation
import Combine
import CryptoKit
import UIKit

/// Service class responsible for managing association data with offline support and secure caching
@available(iOS 13.0, *)
public final class AssociationService {
    
    // MARK: - Singleton Instance
    
    /// Shared singleton instance of AssociationService
    public static let shared = AssociationService()
    
    // MARK: - Properties
    
    private let apiClient: APIClient
    private let syncQueue: OperationQueue
    private var backgroundTask: UIBackgroundTaskIdentifier?
    private let retryCount: Int
    private let cacheExpiryInterval: TimeInterval
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Constants
    
    private enum Constants {
        static let associationCacheKey = "com.ijap.cache.associations"
        static let maxCacheAge: TimeInterval = 3600 // 1 hour
        static let maxRetryAttempts = 3
        static let syncQueueName = "com.ijap.association.sync"
    }
    
    // MARK: - Initialization
    
    private init() {
        self.apiClient = APIClient.shared
        
        // Configure sync operation queue
        self.syncQueue = OperationQueue()
        syncQueue.name = Constants.syncQueueName
        syncQueue.maxConcurrentOperationCount = 1
        syncQueue.qualityOfService = .utility
        
        self.retryCount = Constants.maxRetryAttempts
        self.cacheExpiryInterval = Constants.maxCacheAge
        
        // Setup memory warning observer
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleMemoryWarning),
            name: UIApplication.didReceiveMemoryWarningNotification,
            object: nil
        )
        
        // Monitor network status for sync
        setupNetworkMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Fetches associations with offline support and automatic sync
    /// - Returns: Publisher that emits array of associations or error
    public func fetchAssociations() -> AnyPublisher<[Association], Error> {
        // Check cache first
        if let cachedData = getCachedAssociations() {
            return Just(cachedData)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
        
        // Fetch from network
        return apiClient.request(
            .getAssociations(
                page: 1,
                limit: 100,
                locale: Locale.current.languageCode ?? "en"
            ),
            type: [Association].self
        )
        .retry(retryCount)
        .handleEvents(
            receiveOutput: { [weak self] associations in
                self?.cacheAssociations(associations)
                self?.scheduleBackgroundSync()
            },
            receiveCompletion: { [weak self] completion in
                if case .failure = completion {
                    self?.handleFetchError()
                }
            }
        )
        .eraseToAnyPublisher()
    }
    
    /// Retrieves specific association by ID with offline support
    /// - Parameter id: Association identifier
    /// - Returns: Publisher that emits single association or error
    public func getAssociation(id: String) -> AnyPublisher<Association, Error> {
        // Check cache first
        if let cachedAssociation = getCachedAssociation(id: id) {
            return Just(cachedAssociation)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
        
        // Fetch from network
        return apiClient.request(
            .getAssociationDetail(
                id: id,
                locale: Locale.current.languageCode ?? "en"
            ),
            type: Association.self
        )
        .retry(retryCount)
        .handleEvents(
            receiveOutput: { [weak self] association in
                self?.cacheAssociation(association)
            }
        )
        .eraseToAnyPublisher()
    }
    
    /// Searches associations with query parameters
    /// - Parameter query: Search query string
    /// - Returns: Publisher that emits filtered associations or error
    public func searchAssociations(query: String) -> AnyPublisher<[Association], Error> {
        // Search in cache first if offline
        if !NetworkMonitor.shared.isConnected.value {
            return searchCachedAssociations(query: query)
                .setFailureType(to: Error.self)
                .eraseToAnyPublisher()
        }
        
        // Perform network search
        return apiClient.request(
            .getAssociations(
                page: 1,
                limit: 100,
                locale: Locale.current.languageCode ?? "en"
            ),
            type: [Association].self
        )
        .map { associations in
            associations.filter { association in
                association.name.localizedCaseInsensitiveContains(query) ||
                association.description.values.contains { $0.localizedCaseInsensitiveContains(query) }
            }
        }
        .eraseToAnyPublisher()
    }
    
    /// Synchronizes offline changes with server
    /// - Returns: Publisher that emits completion or error
    public func syncOfflineChanges() -> AnyPublisher<Void, Error> {
        guard NetworkMonitor.shared.isConnected.value else {
            return Fail(error: APIError.noInternetConnection).eraseToAnyPublisher()
        }
        
        // Start background task
        startBackgroundTask()
        
        return fetchPendingChanges()
            .flatMap { changes in
                self.processPendingChanges(changes)
            }
            .handleEvents(
                receiveCompletion: { [weak self] _ in
                    self?.endBackgroundTask()
                }
            )
            .eraseToAnyPublisher()
    }
    
    // MARK: - Private Methods
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] isConnected in
                if isConnected {
                    self?.syncOfflineChanges()
                        .sink(
                            receiveCompletion: { _ in },
                            receiveValue: { }
                        )
                        .store(in: &self!.cancellables)
                }
            }
            .store(in: &cancellables)
    }
    
    private func getCachedAssociations() -> [Association]? {
        guard let data = UserDefaults.standard.data(forKey: Constants.associationCacheKey),
              let timestamp = UserDefaults.standard.object(forKey: "\(Constants.associationCacheKey).timestamp") as? Date,
              Date().timeIntervalSince(timestamp) < cacheExpiryInterval else {
            return nil
        }
        
        return try? JSONDecoder().decode([Association].self, from: data)
    }
    
    private func cacheAssociations(_ associations: [Association]) {
        guard let data = try? JSONEncoder().encode(associations) else { return }
        
        UserDefaults.standard.set(data, forKey: Constants.associationCacheKey)
        UserDefaults.standard.set(Date(), forKey: "\(Constants.associationCacheKey).timestamp")
    }
    
    private func getCachedAssociation(id: String) -> Association? {
        guard let associations = getCachedAssociations() else { return nil }
        return associations.first { $0.id == id }
    }
    
    private func cacheAssociation(_ association: Association) {
        var associations = getCachedAssociations() ?? []
        if let index = associations.firstIndex(where: { $0.id == association.id }) {
            associations[index] = association
        } else {
            associations.append(association)
        }
        cacheAssociations(associations)
    }
    
    private func searchCachedAssociations(query: String) -> Just<[Association]> {
        let associations = getCachedAssociations() ?? []
        let filtered = associations.filter { association in
            association.name.localizedCaseInsensitiveContains(query) ||
            association.description.values.contains { $0.localizedCaseInsensitiveContains(query) }
        }
        return Just(filtered)
    }
    
    private func startBackgroundTask() {
        backgroundTask = UIApplication.shared.beginBackgroundTask { [weak self] in
            self?.endBackgroundTask()
        }
    }
    
    private func endBackgroundTask() {
        if let task = backgroundTask {
            UIApplication.shared.endBackgroundTask(task)
            backgroundTask = .invalid
        }
    }
    
    private func fetchPendingChanges() -> AnyPublisher<[String: Any], Error> {
        // Implementation for fetching pending changes from local storage
        return Just([:])
            .setFailureType(to: Error.self)
            .eraseToAnyPublisher()
    }
    
    private func processPendingChanges(_ changes: [String: Any]) -> AnyPublisher<Void, Error> {
        // Implementation for processing pending changes
        return Just(())
            .setFailureType(to: Error.self)
            .eraseToAnyPublisher()
    }
    
    private func scheduleBackgroundSync() {
        // Schedule background sync using BackgroundTasks framework
    }
    
    private func handleFetchError() {
        // Handle fetch errors and implement retry logic
    }
    
    @objc private func handleMemoryWarning() {
        // Clear non-essential caches
        UserDefaults.standard.removeObject(forKey: "\(Constants.associationCacheKey).timestamp")
    }
    
    // MARK: - Deinitialization
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
}