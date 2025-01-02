/**
 * Interface for association physical address with geocoding support
 * Supports international address formats and location tracking
 */
export interface IAssociationAddress {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
    coordinates: {
        latitude: number;
        longitude: number;
    };
}

/**
 * Interface for association legal registration and compliance information
 * Handles international regulatory requirements and document management
 */
export interface IAssociationLegalInfo {
    registrationNumber: string;
    taxId: string;
    registrationDate: Date;
    registrationCountry: string;
    legalStatus: string;
    complianceDocuments: Array<{
        type: string;
        url: string;
        expiryDate: Date;
    }>;
}

/**
 * Interface for association payment gateway configurations
 * Supports multiple payment processors with currency specifications
 */
export interface IAssociationPaymentGateways {
    stripe: {
        accountId: string;
        enabled: boolean;
        capabilities: string[];
        currencies: string[];
    };
    tranzilla: {
        terminalId: string;
        enabled: boolean;
        merchantId: string;
        supportedCards: string[];
    };
    defaultGateway: string;
    supportedCurrencies: string[];
}

/**
 * Enum for possible association verification and operational statuses
 * Tracks the lifecycle states of associations
 */
export enum IAssociationStatus {
    PENDING = 'PENDING',
    ACTIVE = 'ACTIVE',
    SUSPENDED = 'SUSPENDED',
    INACTIVE = 'INACTIVE',
    UNDER_REVIEW = 'UNDER_REVIEW'
}

/**
 * Comprehensive interface for Jewish charitable association data structure
 * Supports multi-language content, international operations, and secure payment processing
 */
export interface IAssociation {
    id: string;
    
    // Multi-language support for name and description
    name: { [key: string]: string };
    description: { [key: string]: string };
    
    // Contact information
    email: string;
    phone: string;
    website: string;
    socialMedia: { [platform: string]: string };
    
    // Location and legal information
    address: IAssociationAddress;
    legalInfo: IAssociationLegalInfo;
    
    // Classification and language support
    categories: string[];
    primaryLanguage: string;
    supportedLanguages: string[];
    
    // Payment processing configuration
    paymentGateways: IAssociationPaymentGateways;
    
    // Verification and status
    isVerified: boolean;
    verificationDetails: {
        lastVerified: Date;
        verifiedBy: string;
        documents: Array<{
            type: string;
            url: string;
        }>;
    };
    status: IAssociationStatus;
    
    // Operational settings
    settings: {
        autoApprovalThreshold: number;
        defaultCurrency: string;
        notificationPreferences: object;
    };
    
    // Timestamps
    createdAt: Date;
    updatedAt: Date;
}