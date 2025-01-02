//
// APIClient.swift
// IJAP
//
// Foundation version: iOS 13.0+
// Alamofire version: 5.8+
// Combine version: iOS 13.0+
//

import Foundation
import Alamofire
import Combine

/// Advanced API client managing all network requests with comprehensive features including
/// offline support, request batching, and sophisticated error handling
@available(iOS 13.0, *)
public final class APIClient {
    
    // MARK: - Singleton Instance
    
    /// Shared singleton instance of APIClient
    public static let shared = APIClient()
    
    // MARK: - Properties
    
    private let session: Session
    private let requestInterceptor: RequestInterceptor
    private let decoder: JSONDecoder
    private let requestQueue: OperationQueue
    private let cache: URLCache
    private let retryPolicy: RetryPolicy
    private var cancellables = Set<AnyCancellable>()
    
    // MARK: - Constants
    
    private enum Constants {
        static let maxRetryAttempts = 3
        static let cacheMemoryCapacity = 50 * 1024 * 1024 // 50MB
        static let cacheDiskCapacity = 100 * 1024 * 1024 // 100MB
        static let requestTimeout: TimeInterval = 30
        static let uploadTimeout: TimeInterval = 60
    }
    
    // MARK: - Initialization
    
    private init() {
        // Configure URL cache
        self.cache = URLCache(
            memoryCapacity: Constants.cacheMemoryCapacity,
            diskCapacity: Constants.cacheDiskCapacity,
            diskPath: "com.ijap.network.cache"
        )
        
        // Configure certificate pinning
        let certificates = ServerTrustManager(evaluators: [
            "api.ijap.org": PinnedCertificatesTrustEvaluator(),
            "api.staging.ijap.org": PinnedCertificatesTrustEvaluator()
        ])
        
        // Configure session
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = Constants.requestTimeout
        configuration.timeoutIntervalForResource = Constants.uploadTimeout
        configuration.urlCache = cache
        configuration.requestCachePolicy = .returnCacheDataElseLoad
        
        // Initialize session with certificate pinning
        self.session = Session(
            configuration: configuration,
            serverTrustManager: certificates
        )
        
        // Configure request interceptor
        self.requestInterceptor = APIRequestInterceptor()
        
        // Configure JSON decoder
        self.decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        
        // Configure request queue
        self.requestQueue = OperationQueue()
        requestQueue.maxConcurrentOperationCount = 4
        requestQueue.qualityOfService = .userInitiated
        
        // Configure retry policy
        self.retryPolicy = RetryPolicy(
            retryLimit: Constants.maxRetryAttempts,
            exponentialBackoffBase: 2,
            exponentialBackoffScale: 0.5
        )
        
        // Monitor network status changes
        setupNetworkMonitoring()
    }
    
    // MARK: - Public Methods
    
    /// Performs a network request with comprehensive error handling and caching
    /// - Parameters:
    ///   - endpoint: The API endpoint to request
    ///   - type: The expected response type
    ///   - priority: Request priority level
    ///   - cachePolicy: Caching strategy for the request
    /// - Returns: A publisher that emits the decoded response or error
    public func request<T: Decodable>(
        _ endpoint: APIRouter,
        type: T.Type,
        priority: Operation.QueuePriority = .normal,
        cachePolicy: URLRequest.CachePolicy? = nil
    ) -> AnyPublisher<T, APIError> {
        
        // Check network connectivity
        guard NetworkMonitor.shared.isConnected.value else {
            return Fail(error: APIError.noInternetConnection).eraseToAnyPublisher()
        }
        
        do {
            var urlRequest = try endpoint.asURLRequest()
            
            // Apply cache policy if specified
            if let cachePolicy = cachePolicy {
                urlRequest.cachePolicy = cachePolicy
            }
            
            // Add common headers
            urlRequest.setValue(Locale.current.languageCode, forHTTPHeaderField: "Accept-Language")
            
            return session.request(urlRequest, interceptor: requestInterceptor)
                .validate()
                .publishData()
                .tryMap { response in
                    // Handle HTTP status codes
                    switch response.response?.statusCode {
                    case 401:
                        throw APIError.unauthorized
                    case 403:
                        throw APIError.forbidden
                    case 404:
                        throw APIError.notFound
                    case 500...599:
                        throw APIError.serverError(response.response?.statusCode ?? 500)
                    default:
                        return response.data
                    }
                }
                .decode(type: T.self, decoder: decoder)
                .mapError { error in
                    if let apiError = error as? APIError {
                        return apiError
                    }
                    return APIError.decodingError(error)
                }
                .receive(on: DispatchQueue.main)
                .eraseToAnyPublisher()
        } catch {
            return Fail(error: APIError.networkError(error)).eraseToAnyPublisher()
        }
    }
    
    /// Uploads data with progress tracking and background support
    /// - Parameters:
    ///   - data: The data to upload
    ///   - mimeType: MIME type of the data
    ///   - endpoint: The upload endpoint
    ///   - priority: Upload priority level
    /// - Returns: A publisher that emits upload progress or error
    public func upload(
        data: Data,
        mimeType: String,
        to endpoint: APIRouter,
        priority: Operation.QueuePriority = .normal
    ) -> AnyPublisher<Progress, APIError> {
        
        guard NetworkMonitor.shared.isConnected.value else {
            return Fail(error: APIError.noInternetConnection).eraseToAnyPublisher()
        }
        
        do {
            let urlRequest = try endpoint.asURLRequest()
            
            return session.upload(
                data,
                with: urlRequest,
                interceptor: requestInterceptor
            )
            .uploadProgress()
            .setFailureType(to: APIError.self)
            .receive(on: DispatchQueue.main)
            .eraseToAnyPublisher()
        } catch {
            return Fail(error: APIError.networkError(error)).eraseToAnyPublisher()
        }
    }
    
    /// Cancels all pending network requests
    public func cancelAllRequests() {
        session.cancelAllRequests()
    }
    
    // MARK: - Private Methods
    
    private func setupNetworkMonitoring() {
        NetworkMonitor.shared.isConnected
            .sink { [weak self] isConnected in
                if isConnected {
                    self?.retryPendingRequests()
                }
            }
            .store(in: &cancellables)
    }
    
    private func retryPendingRequests() {
        // Implement retry logic for failed requests when connection is restored
    }
}

// MARK: - Request Interceptor

private class APIRequestInterceptor: RequestInterceptor {
    func adapt(_ urlRequest: URLRequest, for session: Session, completion: @escaping (Result<URLRequest, Error>) -> Void) {
        var urlRequest = urlRequest
        
        // Add authentication token if available
        if let token = UserDefaults.standard.string(forKey: "authToken") {
            urlRequest.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        
        completion(.success(urlRequest))
    }
    
    func retry(_ request: Request, for session: Session, dueTo error: Error, completion: @escaping (RetryResult) -> Void) {
        guard let response = request.task?.response as? HTTPURLResponse else {
            completion(.doNotRetry)
            return
        }
        
        // Retry on network errors or 5xx server errors
        if let error = error as? URLError {
            completion(shouldRetry(error: error) ? .retry : .doNotRetry)
        } else if (500...599).contains(response.statusCode) {
            completion(.retry)
        } else {
            completion(.doNotRetry)
        }
    }
    
    private func shouldRetry(error: URLError) -> Bool {
        switch error.code {
        case .notConnectedToInternet,
             .networkConnectionLost,
             .timedOut:
            return true
        default:
            return false
        }
    }
}