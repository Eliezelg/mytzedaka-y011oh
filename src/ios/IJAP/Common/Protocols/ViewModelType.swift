import Foundation
import Combine // iOS 13.0+

/// Protocol defining the base structure for view models in the MVVM architecture pattern.
/// Ensures consistent implementation of reactive view models across the application.
///
/// Usage:
/// - Conform to this protocol when creating view models
/// - Define Input and Output types specific to view model requirements
/// - Implement transform function to handle business logic and data transformations
@available(iOS 13.0, *)
public protocol ViewModelType {
    /// Type representing the input events that the view model can receive
    associatedtype Input
    
    /// Type representing the output events that the view model produces
    associatedtype Output
    
    /// Transforms input events into output events using reactive programming patterns
    /// - Parameter input: The input events from the view
    /// - Returns: The transformed output events that the view can consume
    func transform(input: Input) -> Output
}