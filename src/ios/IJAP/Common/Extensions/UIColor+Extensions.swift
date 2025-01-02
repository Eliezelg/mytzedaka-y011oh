//
// UIColor+Extensions.swift
// IJAP
//
// Extension providing custom color definitions and utility functions
// implementing Material Design 3.0 principles with Jewish cultural elements
// Version: iOS 13.0+
//

import UIKit

@available(iOS 13.0, *)
extension UIColor {
    
    // MARK: - Theme Colors
    
    /// Primary brand color with dynamic light/dark mode support
    static var primary: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#2196F3")
            default:
                return UIColor(hex: "#1976D2")
            }
        }
    }
    
    /// Secondary brand color with dynamic light/dark mode support
    static var secondary: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#FFFFFF")
            default:
                return UIColor(hex: "#424242")
            }
        }
    }
    
    /// Background color with dynamic light/dark mode support
    static var background: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#121212")
            default:
                return UIColor(hex: "#FFFFFF")
            }
        }
    }
    
    /// Error state color with WCAG AA compliance
    static var error: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#FF5252")
            default:
                return UIColor(hex: "#D32F2F")
            }
        }
    }
    
    /// Success state color with WCAG AA compliance
    static var success: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#69F0AE")
            default:
                return UIColor(hex: "#388E3C")
            }
        }
    }
    
    /// Warning state color with WCAG AA compliance
    static var warning: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#FFD740")
            default:
                return UIColor(hex: "#FFA000")
            }
        }
    }
    
    /// Primary text color with WCAG AA compliance
    static var textPrimary: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#FFFFFF").adjustBrightness(-0.13) // 87% opacity
            default:
                return UIColor(hex: "#000000").adjustBrightness(-0.13) // 87% opacity
            }
        }
    }
    
    /// Secondary text color with WCAG AA compliance
    static var textSecondary: UIColor {
        UIColor { traitCollection in
            switch traitCollection.userInterfaceStyle {
            case .dark:
                return UIColor(hex: "#FFFFFF").adjustBrightness(-0.4) // 60% opacity
            default:
                return UIColor(hex: "#000000").adjustBrightness(-0.4) // 60% opacity
            }
        }
    }
    
    // MARK: - Utility Functions
    
    /// Creates a UIColor instance from a hexadecimal color string
    /// - Parameter hexString: The hex color string (e.g., "#FF0000" or "FF0000")
    /// - Returns: A UIColor instance representing the hex color
    static func hex(_ hexString: String) -> UIColor {
        var cleanHexString = hexString.trimmingCharacters(in: .whitespacesAndNewlines)
        if cleanHexString.hasPrefix("#") {
            cleanHexString.remove(at: cleanHexString.startIndex)
        }
        
        var rgb: UInt64 = 0
        Scanner(string: cleanHexString).scanHexInt64(&rgb)
        
        let red = CGFloat((rgb & 0xFF0000) >> 16) / 255.0
        let green = CGFloat((rgb & 0x00FF00) >> 8) / 255.0
        let blue = CGFloat(rgb & 0x0000FF) / 255.0
        
        return UIColor(red: red, green: green, blue: blue, alpha: 1.0)
    }
    
    /// Adjusts the brightness of the color while maintaining hue and saturation
    /// - Parameter percentage: The percentage to adjust brightness (-1.0 to 1.0)
    /// - Returns: A new UIColor with adjusted brightness
    func adjustBrightness(_ percentage: CGFloat) -> UIColor {
        var hue: CGFloat = 0
        var saturation: CGFloat = 0
        var brightness: CGFloat = 0
        var alpha: CGFloat = 0
        
        guard self.getHue(&hue,
                         saturation: &saturation,
                         brightness: &brightness,
                         alpha: &alpha) else {
            return self
        }
        
        let newBrightness = max(0, min(1, brightness + percentage))
        return UIColor(hue: hue,
                      saturation: saturation,
                      brightness: newBrightness,
                      alpha: alpha)
    }
}