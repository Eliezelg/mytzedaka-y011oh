/**
 * Currency utility functions for the International Jewish Association Donation Platform
 * Provides comprehensive currency handling with special support for Israeli market
 * @version 1.0.0
 */

import { IDonation } from '../interfaces/donation.interface';

// Supported currencies with validation
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'ILS'] as const;
export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

// Default currency for the platform
export const DEFAULT_CURRENCY: SupportedCurrency = 'USD';

// Minimum donation amounts per currency (ILS minimum set to 18 for cultural significance)
export const MIN_DONATION_AMOUNTS: Record<SupportedCurrency, number> = {
    USD: 5,
    EUR: 5,
    ILS: 18
};

// Currency symbols with security considerations
export const CURRENCY_SYMBOLS: Record<SupportedCurrency, string> = {
    USD: '$',
    EUR: '€',
    ILS: '₪'
};

// Currency-specific decimal place requirements
export const CURRENCY_DECIMAL_PLACES: Record<SupportedCurrency, number> = {
    USD: 2,
    EUR: 2,
    ILS: 0  // Israeli Shekel typically doesn't use decimal places
};

// Cache for NumberFormat instances
const formattersCache = new Map<string, Intl.NumberFormat>();

/**
 * Formats a number as a currency string with appropriate symbol and decimal places
 * Includes RTL support for Israeli Shekel
 * @param amount - The amount to format
 * @param currencyCode - The currency code (USD, EUR, ILS)
 * @returns Formatted currency string
 * @throws Error if currency is not supported
 */
export function formatCurrency(amount: number, currencyCode: string): string {
    if (!isSupportedCurrency(currencyCode)) {
        throw new Error(`Unsupported currency: ${currencyCode}`);
    }

    const cacheKey = `${currencyCode}`;
    let formatter = formattersCache.get(cacheKey);

    if (!formatter) {
        formatter = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: CURRENCY_DECIMAL_PLACES[currencyCode as SupportedCurrency],
            maximumFractionDigits: CURRENCY_DECIMAL_PLACES[currencyCode as SupportedCurrency]
        });
        formattersCache.set(cacheKey, formatter);
    }

    // Add RTL markers for ILS
    const formattedAmount = formatter.format(amount);
    return currencyCode === 'ILS' ? `\u200e${formattedAmount}\u200f` : formattedAmount;
}

/**
 * Validates if an amount meets the currency-specific requirements
 * @param amount - The amount to validate
 * @param currencyCode - The currency code
 * @returns boolean indicating if amount is valid
 * @throws Error if currency is not supported
 */
export function validateCurrencyAmount(amount: number, currencyCode: string): boolean {
    if (!isSupportedCurrency(currencyCode)) {
        throw new Error(`Unsupported currency: ${currencyCode}`);
    }

    const typedCurrency = currencyCode as SupportedCurrency;

    // Basic amount validation
    if (!Number.isFinite(amount) || amount <= 0) {
        return false;
    }

    // Check minimum amount
    if (amount < MIN_DONATION_AMOUNTS[typedCurrency]) {
        return false;
    }

    // Validate decimal places
    const decimalPlaces = (amount.toString().split('.')[1] || '').length;
    if (decimalPlaces > CURRENCY_DECIMAL_PLACES[typedCurrency]) {
        return false;
    }

    // Check for numeric overflow
    if (amount > Number.MAX_SAFE_INTEGER) {
        return false;
    }

    return true;
}

/**
 * Returns the symbol for a given currency code
 * @param currencyCode - The currency code
 * @returns The currency symbol
 * @throws Error if currency is not supported
 */
export function getCurrencySymbol(currencyCode: string): string {
    if (!isSupportedCurrency(currencyCode)) {
        throw new Error(`Unsupported currency: ${currencyCode}`);
    }

    // Sanitize and return the currency symbol
    return CURRENCY_SYMBOLS[currencyCode as SupportedCurrency];
}

/**
 * Returns the minimum donation amount for a given currency
 * @param currencyCode - The currency code
 * @returns The minimum donation amount
 * @throws Error if currency is not supported
 */
export function getMinimumAmount(currencyCode: string): number {
    if (!isSupportedCurrency(currencyCode)) {
        throw new Error(`Unsupported currency: ${currencyCode}`);
    }

    return MIN_DONATION_AMOUNTS[currencyCode as SupportedCurrency];
}

/**
 * Checks if a currency code is supported by the platform
 * @param currencyCode - The currency code to check
 * @returns boolean indicating if currency is supported
 */
export function isSupportedCurrency(currencyCode: string): boolean {
    if (!currencyCode || typeof currencyCode !== 'string') {
        return false;
    }

    const sanitizedCode = currencyCode.toUpperCase().trim();
    return SUPPORTED_CURRENCIES.includes(sanitizedCode as SupportedCurrency);
}

/**
 * Type guard for SupportedCurrency
 * @param currency - The currency to check
 * @returns Type predicate for SupportedCurrency
 */
export function isSupportedCurrencyType(currency: string): currency is SupportedCurrency {
    return isSupportedCurrency(currency);
}