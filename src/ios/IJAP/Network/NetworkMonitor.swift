//
// NetworkMonitor.swift
// IJAP
//
// Network connectivity monitor for real-time status tracking and offline detection
// Using Foundation 13.0+, Network 13.0+, Combine 13.0+
//

import Foundation
import Network
import Combine

/// Enumeration of supported network connection types
public enum ConnectionType {
    case wifi
    case cellular
    case ethernet
    case none
}

/// Thread-safe singleton class responsible for monitoring network connectivity status
@available(iOS 13.0, *)
public final class NetworkMonitor {
    
    // MARK: - Singleton Instance
    
    /// Shared singleton instance of NetworkMonitor
    public static let shared = NetworkMonitor()
    
    // MARK: - Properties
    
    /// Current connection status publisher
    public private(set) var isConnected: CurrentValueSubject<Bool, Never>
    
    /// Current connection type publisher
    public private(set) var connectionType: CurrentValueSubject<ConnectionType, Never>
    
    /// Network path monitor instance
    private let pathMonitor: NWPathMonitor
    
    /// Dedicated serial dispatch queue for network monitoring
    private let queue: DispatchQueue
    
    // MARK: - Initialization
    
    private init() {
        self.pathMonitor = NWPathMonitor()
        self.queue = DispatchQueue(label: "com.ijap.networkmonitor", qos: .utility)
        self.isConnected = CurrentValueSubject<Bool, Never>(false)
        self.connectionType = CurrentValueSubject<ConnectionType, Never>(.none)
    }
    
    // MARK: - Public Methods
    
    /// Starts network monitoring on dedicated dispatch queue
    public func startMonitoring() {
        // Configure path monitoring callback
        pathMonitor.pathUpdateHandler = { [weak self] path in
            guard let self = self else { return }
            
            // Update connection status
            let isConnected = path.status == .satisfied
            self.isConnected.send(isConnected)
            
            // Update connection type
            let connectionType = self.getConnectionType(path)
            self.connectionType.send(connectionType)
            
            #if DEBUG
            print("Network status changed - Connected: \(isConnected), Type: \(connectionType)")
            #endif
        }
        
        // Start monitoring on dedicated queue
        pathMonitor.start(queue: queue)
    }
    
    /// Safely stops network monitoring and cleans up resources
    public func stopMonitoring() {
        pathMonitor.cancel()
        isConnected.send(false)
        connectionType.send(.none)
        
        #if DEBUG
        print("Network monitoring stopped")
        #endif
    }
    
    // MARK: - Private Methods
    
    /// Determines current network connection type
    private func getConnectionType(_ path: NWPath) -> ConnectionType {
        if !path.usesInterfaceType(.wifi) && !path.usesInterfaceType(.cellular) && !path.usesInterfaceType(.wiredEthernet) {
            return .none
        }
        
        // Check for VPN - if active, use underlying interface type
        if path.isExpensive {
            // VPN connections are marked as expensive
            if path.usesInterfaceType(.wifi) {
                return .wifi
            } else if path.usesInterfaceType(.cellular) {
                return .cellular
            } else if path.usesInterfaceType(.wiredEthernet) {
                return .ethernet
            }
        }
        
        // Determine primary interface type
        if path.usesInterfaceType(.wifi) {
            return .wifi
        } else if path.usesInterfaceType(.cellular) {
            return .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            return .ethernet
        }
        
        return .none
    }
    
    // MARK: - Deinitialization
    
    deinit {
        stopMonitoring()
    }
}