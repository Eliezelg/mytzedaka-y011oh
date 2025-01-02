//
// MockAPIClient.swift
// IJAPTests
//
// Foundation version: iOS 13.0+
// Combine version: iOS 13.0+
// XCTest version: iOS 13.0+
//

import Foundation
import Combine
import XCTest
@testable import IJAP

/// Simulated network conditions for testing various scenarios
enum NetworkCondition {
    case normal
    case slow
    case veryPoor
    case offline
}

/// Enhanced mock implementation of APIClient for comprehensive unit testing
@available(iOS 13.0, *)
final class MockAPIClient {
    
    // MARK: - Singleton Instance
    
    static let shared = MockAPIClient()
    
    // MARK: - Properties
    
    private var mockResponses: [APIRouter: [String: Result<Any, APIError>]]
    private var mockProgress: [APIRouter: Progress]
    private var mockTimeouts: [APIRouter: TimeInterval]
    private var mockValidation: [APIRouter: (URLRequest) -> APIError?]
    private var networkCondition: NetworkCondition
    private var requestCount: Int
    private var lastRequest: APIRouter?
    private let queue: DispatchQueue
    
    // MARK: - Initialization
    
    init() {
        self.mockResponses = [:]
        self.mockProgress = [:]
        self.mockTimeouts = [:]
        self.mockValidation = [:]
        self.networkCondition = .normal
        self.requestCount = 0
        self.lastRequest = nil
        self.queue = DispatchQueue(label: "com.ijap.mockapiqueue", qos: .userInitiated)
    }
    
    // MARK: - Mock Configuration Methods
    
    /// Sets a mock response for a specific endpoint and locale
    func setMockResponse<T>(_ response: Result<T, APIError>, for endpoint: APIRouter, locale: String = "en") {
        queue.sync {
            if mockResponses[endpoint] == nil {
                mockResponses[endpoint] = [:]
            }
            mockResponses[endpoint]?[locale] = response
            requestCount = 0
        }
    }
    
    /// Sets a mock upload progress for a specific endpoint
    func setMockProgress(_ progress: Progress, for endpoint: APIRouter) {
        queue.sync {
            mockProgress[endpoint] = progress
        }
    }
    
    /// Sets a mock timeout for a specific endpoint
    func setMockTimeout(_ timeout: TimeInterval, for endpoint: APIRouter) {
        queue.sync {
            mockTimeouts[endpoint] = timeout
        }
    }
    
    /// Sets a mock validation handler for a specific endpoint
    func setMockValidation(_ validation: @escaping (URLRequest) -> APIError?, for endpoint: APIRouter) {
        queue.sync {
            mockValidation[endpoint] = validation
        }
    }
    
    /// Sets the simulated network condition
    func setNetworkCondition(_ condition: NetworkCondition) {
        queue.sync {
            networkCondition = condition
        }
    }
    
    // MARK: - Mock API Methods
    
    /// Simulates an API request with comprehensive mock behavior
    func request<T: Decodable>(_ endpoint: APIRouter, type: T.Type) -> AnyPublisher<T, APIError> {
        queue.sync {
            requestCount += 1
            lastRequest = endpoint
            
            // Simulate network conditions
            let delay: TimeInterval
            switch networkCondition {
            case .normal:
                delay = 0.1
            case .slow:
                delay = 1.0
            case .veryPoor:
                delay = 3.0
            case .offline:
                return Fail(error: APIError.noInternetConnection).eraseToAnyPublisher()
            }
            
            // Check for timeout
            if let timeout = mockTimeouts[endpoint], timeout < delay {
                return Fail(error: APIError.timeoutError).eraseToAnyPublisher()
            }
            
            // Validate request
            do {
                let urlRequest = try endpoint.asURLRequest()
                if let validation = mockValidation[endpoint],
                   let error = validation(urlRequest) {
                    return Fail(error: error).eraseToAnyPublisher()
                }
            } catch {
                return Fail(error: APIError.networkError(error)).eraseToAnyPublisher()
            }
            
            // Get localized response
            let locale = Locale.current.languageCode ?? "en"
            guard let responses = mockResponses[endpoint],
                  let response = responses[locale] ?? responses["en"] else {
                return Fail(error: APIError.invalidResponse).eraseToAnyPublisher()
            }
            
            return Just(response)
                .delay(for: .seconds(delay), scheduler: DispatchQueue.global())
                .tryMap { result -> T in
                    switch result {
                    case .success(let value):
                        if let data = try? JSONSerialization.data(withJSONObject: value),
                           let decoded = try? JSONDecoder().decode(T.self, from: data) {
                            return decoded
                        }
                        throw APIError.decodingError(NSError(domain: "MockAPI", code: -1))
                    case .failure(let error):
                        throw error
                    }
                }
                .mapError { error in
                    if let apiError = error as? APIError {
                        return apiError
                    }
                    return APIError.decodingError(error)
                }
                .receive(on: DispatchQueue.main)
                .eraseToAnyPublisher()
        }
    }
    
    /// Simulates a file upload with progress tracking
    func upload(data: Data, mimeType: String, to endpoint: APIRouter) -> AnyPublisher<Progress, APIError> {
        queue.sync {
            requestCount += 1
            lastRequest = endpoint
            
            // Check network condition
            if networkCondition == .offline {
                return Fail(error: APIError.noInternetConnection).eraseToAnyPublisher()
            }
            
            // Check for timeout
            if let timeout = mockTimeouts[endpoint] {
                return Fail(error: APIError.timeoutError).eraseToAnyPublisher()
            }
            
            // Validate request
            do {
                let urlRequest = try endpoint.asURLRequest()
                if let validation = mockValidation[endpoint],
                   let error = validation(urlRequest) {
                    return Fail(error: error).eraseToAnyPublisher()
                }
            } catch {
                return Fail(error: APIError.networkError(error)).eraseToAnyPublisher()
            }
            
            // Return mock progress
            guard let progress = mockProgress[endpoint] else {
                return Fail(error: APIError.invalidResponse).eraseToAnyPublisher()
            }
            
            return Just(progress)
                .delay(for: .seconds(0.5), scheduler: DispatchQueue.global())
                .setFailureType(to: APIError.self)
                .receive(on: DispatchQueue.main)
                .eraseToAnyPublisher()
        }
    }
    
    /// Resets all mock state
    func reset() {
        queue.sync {
            mockResponses.removeAll()
            mockProgress.removeAll()
            mockTimeouts.removeAll()
            mockValidation.removeAll()
            networkCondition = .normal
            requestCount = 0
            lastRequest = nil
        }
    }
    
    // MARK: - Test Helper Methods
    
    /// Returns the number of requests made
    var numberOfRequests: Int {
        queue.sync { requestCount }
    }
    
    /// Returns the last request made
    var lastRequestMade: APIRouter? {
        queue.sync { lastRequest }
    }
}