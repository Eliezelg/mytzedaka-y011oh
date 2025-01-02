import { format, parseISO, isValid, isBefore, isAfter, differenceInDays, isSameDay } from 'date-fns'; // v2.30.0
import { he, fr, enUS } from 'date-fns/locale'; // v2.30.0

// Constants for date formatting and locale mapping
const DEFAULT_DATE_FORMAT = 'yyyy-MM-dd';
const DISPLAY_DATE_FORMAT = 'MMM dd, yyyy';
const LOCALE_MAP = {
  en: enUS,
  he: he,
  fr: fr
};

/**
 * Formats a date according to the specified format and locale with RTL support
 * @param date - Date to format (Date object or ISO string)
 * @param formatString - Optional format string (defaults to DISPLAY_DATE_FORMAT)
 * @param locale - Optional locale code (defaults to 'en')
 * @returns Formatted date string or error message if invalid
 */
export const formatDate = (
  date: Date | string,
  formatString: string = DISPLAY_DATE_FORMAT,
  locale: keyof typeof LOCALE_MAP = 'en'
): string => {
  try {
    const dateObj = date instanceof Date ? date : parseISO(date);
    
    if (!isDateValid(dateObj)) {
      throw new Error('Invalid date provided');
    }

    const localeObj = LOCALE_MAP[locale];
    const formattedDate = format(dateObj, formatString, { locale: localeObj });

    // Handle RTL formatting for Hebrew locale
    if (locale === 'he') {
      return `\u200F${formattedDate}\u200E`; // Add RTL and LTR marks for proper rendering
    }

    return formattedDate;
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
};

/**
 * Validates if a date is valid and within reasonable range
 * @param date - Date to validate (Date object or ISO string)
 * @returns Boolean indicating if date is valid and reasonable
 */
export const isDateValid = (date: Date | string): boolean => {
  try {
    const dateObj = date instanceof Date ? date : parseISO(date);
    
    if (!isValid(dateObj)) {
      return false;
    }

    // Check if date is within reasonable range (100 years past to 30 years future)
    const now = new Date();
    const minDate = new Date(now.getFullYear() - 100, 0, 1);
    const maxDate = new Date(now.getFullYear() + 30, 11, 31);

    return !isBefore(dateObj, minDate) && !isAfter(dateObj, maxDate);
  } catch (error) {
    return false;
  }
};

/**
 * Calculates the absolute difference in days between two dates
 * @param startDate - Start date (Date object or ISO string)
 * @param endDate - End date (Date object or ISO string)
 * @returns Number of days between dates or -1 if invalid
 */
export const calculateDateDifference = (
  startDate: Date | string,
  endDate: Date | string
): number => {
  try {
    const start = startDate instanceof Date ? startDate : parseISO(startDate);
    const end = endDate instanceof Date ? endDate : parseISO(endDate);

    if (!isDateValid(start) || !isDateValid(end)) {
      throw new Error('Invalid date(s) provided');
    }

    // Normalize dates to UTC to handle timezone differences
    const startUTC = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
    const endUTC = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));

    return Math.abs(differenceInDays(endUTC, startUTC));
  } catch (error) {
    console.error('Date difference calculation error:', error);
    return -1;
  }
};

/**
 * Checks if a date falls within a specified range (inclusive)
 * @param date - Date to check (Date object or ISO string)
 * @param startDate - Range start date (Date object or ISO string)
 * @param endDate - Range end date (Date object or ISO string)
 * @returns Boolean indicating if date is within range
 */
export const isDateInRange = (
  date: Date | string,
  startDate: Date | string,
  endDate: Date | string
): boolean => {
  try {
    const dateObj = date instanceof Date ? date : parseISO(date);
    const startObj = startDate instanceof Date ? startDate : parseISO(startDate);
    const endObj = endDate instanceof Date ? endDate : parseISO(endDate);

    if (!isDateValid(dateObj) || !isDateValid(startObj) || !isDateValid(endObj)) {
      return false;
    }

    // Normalize all dates to UTC for consistent comparison
    const dateUTC = new Date(Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()));
    const startUTC = new Date(Date.UTC(startObj.getFullYear(), startObj.getMonth(), startObj.getDate()));
    const endUTC = new Date(Date.UTC(endObj.getFullYear(), endObj.getMonth(), endObj.getDate()));

    return (isAfter(dateUTC, startUTC) || isSameDay(dateUTC, startUTC)) &&
           (isBefore(dateUTC, endUTC) || isSameDay(dateUTC, endUTC));
  } catch (error) {
    console.error('Date range check error:', error);
    return false;
  }
};

/**
 * Formats a date relative to current time with locale support
 * @param date - Date to format (Date object or ISO string)
 * @param locale - Locale code for formatting
 * @returns Localized relative time string
 */
export const formatRelativeTime = (
  date: Date | string,
  locale: keyof typeof LOCALE_MAP = 'en'
): string => {
  try {
    const dateObj = date instanceof Date ? date : parseISO(date);
    
    if (!isDateValid(dateObj)) {
      throw new Error('Invalid date provided');
    }

    const now = new Date();
    const diffDays = differenceInDays(dateObj, now);
    const localeObj = LOCALE_MAP[locale];

    // Custom relative time formatting based on difference
    if (diffDays === 0) {
      return format(dateObj, "'Today at' HH:mm", { locale: localeObj });
    } else if (diffDays === 1) {
      return format(dateObj, "'Tomorrow at' HH:mm", { locale: localeObj });
    } else if (diffDays === -1) {
      return format(dateObj, "'Yesterday at' HH:mm", { locale: localeObj });
    } else if (Math.abs(diffDays) < 7) {
      return format(dateObj, "EEEE 'at' HH:mm", { locale: localeObj });
    } else {
      return format(dateObj, DISPLAY_DATE_FORMAT, { locale: localeObj });
    }
  } catch (error) {
    console.error('Relative time formatting error:', error);
    return 'Invalid Date';
  }
};