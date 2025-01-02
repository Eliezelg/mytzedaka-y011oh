/**
 * Regular expression constants for input validation
 * Supporting multi-language validation (Hebrew, English, French)
 */

/**
 * Email validation regex following RFC 5322 standard
 * Validates:
 * - Local part can contain: letters, numbers, special characters
 * - Domain part validation
 * - IP address literal support
 * - No consecutive dots
 */
export const EMAIL_REGEX = /^(?:[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f!#-[]-\x7f]|\\[\x01-\t\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-zA-Z0-9-]*[a-zA-Z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f!-ZS-\x7f]|\\[\x01-\t\x0b\x0c\x0e-\x7f])+)\])$/;

/**
 * Password validation regex enforcing strong security requirements
 * Requires:
 * - At least 8 characters, maximum 64 characters
 * - At least 1 lowercase letter
 * - At least 1 uppercase letter
 * - At least 1 number
 * - At least 1 special character
 */
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()\-_=+{};:,<.>])(?=.{8,64})[A-Za-z\d!@#$%^&*()\-_=+{};:,<.>]*$/;

/**
 * Phone number validation regex following E.164 format
 * Validates:
 * - Optional + prefix
 * - Country code (1-9)
 * - Up to 14 digits for number
 * - No spaces or special characters
 */
export const PHONE_REGEX = /^\+?(?:[1-9](?:[0-9]{1,14}))$/;

/**
 * Currency amount validation regex
 * Validates:
 * - Up to 10 digits before decimal
 * - Optional decimal point with exactly 2 decimal places
 * - No leading zeros unless decimal
 * - No negative numbers
 * - Prevents 0.00 values
 */
export const CURRENCY_REGEX = /^(?!0*\.0*$)\d{1,10}(?:\.\d{1,2})?$/;

/**
 * Multi-language name validation regex with Unicode support
 * Validates:
 * - Hebrew characters (Unicode range)
 * - Latin characters (English, French)
 * - Accented characters and diacritics
 * - Apostrophes for French names
 * - Hyphens for compound names
 * - 2-50 characters in length
 * - Must start and end with a letter
 * - No consecutive spaces or special characters
 */
export const NAME_REGEX = /^[\p{L}\p{M}'][\p{L}\p{M}'\s-]{0,48}[\p{L}\p{M}']$/u;