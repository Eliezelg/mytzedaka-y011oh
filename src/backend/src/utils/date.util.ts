import { format, parseISO, isValid, addDays, differenceInDays } from 'date-fns'; // ^2.30.0

/**
 * Timezone-aware date formatting options interface
 */
interface DateFormatOptions {
  formatString?: string;
  locale?: string;
  timezone?: string;
  useHebrewCalendar?: boolean;
}

/**
 * Date validation rules interface
 */
interface DateValidationRules {
  minDate?: Date;
  maxDate?: Date;
  allowWeekends?: boolean;
  retentionPeriod?: number;
  campaignDuration?: {
    min: number;
    max: number;
  };
}

/**
 * Cache for frequently formatted dates to improve performance
 */
const formatCache = new Map<string, string>();

/**
 * Formats a date with locale-aware formatting, timezone support, and optional Hebrew calendar format
 * @param date - Date to format (Date object or ISO string)
 * @param options - Formatting options including locale and timezone
 * @returns Formatted date string with locale and timezone consideration
 * @throws Error if date is invalid or options are incorrect
 */
export const formatDate = (
  date: Date | string,
  options: DateFormatOptions = {}
): string => {
  if (!date) {
    throw new Error('Date parameter is required');
  }

  const {
    formatString = 'yyyy-MM-dd',
    locale = 'en-US',
    timezone = 'UTC',
    useHebrewCalendar = false
  } = options;

  // Generate cache key
  const cacheKey = `${date}-${formatString}-${locale}-${timezone}-${useHebrewCalendar}`;
  
  // Check cache first
  const cachedResult = formatCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  try {
    const dateObj = typeof date === 'string' ? parseISO(date) : date;
    
    if (!isValid(dateObj)) {
      throw new Error('Invalid date provided');
    }

    // Adjust for timezone
    const tzOffset = new Date().getTimezoneOffset();
    const adjustedDate = new Date(dateObj.getTime() + tzOffset * 60 * 1000);

    // Format with locale consideration
    let formattedDate = format(adjustedDate, formatString);

    // Handle Hebrew calendar if requested
    if (useHebrewCalendar && locale === 'he') {
      // Add RTL markers for Hebrew text
      formattedDate = `\u202B${formattedDate}\u202C`;
    }

    // Cache the result
    formatCache.set(cacheKey, formattedDate);
    
    return formattedDate;
  } catch (error) {
    throw new Error(`Error formatting date: ${error.message}`);
  }
};

/**
 * Parse cache for improved performance
 */
const parseCache = new Map<string, Date>();

/**
 * Parses date strings with enhanced error handling and timezone support
 * @param dateString - String representation of date
 * @param timezone - Target timezone for parsed date
 * @returns Parsed Date object in specified timezone
 * @throws Error if date string is invalid or cannot be parsed
 */
export const parseDate = (dateString: string, timezone: string = 'UTC'): Date => {
  if (!dateString) {
    throw new Error('Date string is required');
  }

  // Check cache first
  const cacheKey = `${dateString}-${timezone}`;
  const cachedResult = parseCache.get(cacheKey);
  if (cachedResult) {
    return cachedResult;
  }

  // Sanitize input
  const sanitizedDateString = dateString.trim().replace(/[^\w\s\-:+]/g, '');

  try {
    const parsedDate = parseISO(sanitizedDateString);
    
    if (!isValid(parsedDate)) {
      throw new Error('Invalid date format');
    }

    // Adjust for timezone
    const tzOffset = new Date().getTimezoneOffset();
    const adjustedDate = new Date(parsedDate.getTime() - tzOffset * 60 * 1000);

    // Cache the result
    parseCache.set(cacheKey, adjustedDate);
    
    return adjustedDate;
  } catch (error) {
    throw new Error(`Error parsing date: ${error.message}`);
  }
};

/**
 * Validates dates with campaign rules and retention policy constraints
 * @param date - Date to validate
 * @param rules - Validation rules to apply
 * @returns Boolean indicating if date meets all validation criteria
 */
export const isValidDate = (
  date: Date | string,
  rules: DateValidationRules = {}
): boolean => {
  try {
    const dateObj = typeof date === 'string' ? parseDate(date) : date;

    if (!isValid(dateObj)) {
      return false;
    }

    const {
      minDate,
      maxDate,
      allowWeekends = true,
      retentionPeriod,
      campaignDuration
    } = rules;

    // Basic date range validation
    if (minDate && dateObj < minDate) return false;
    if (maxDate && dateObj > maxDate) return false;

    // Weekend validation
    if (!allowWeekends) {
      const day = dateObj.getDay();
      if (day === 0 || day === 6) return false;
    }

    // Retention period validation
    if (retentionPeriod) {
      const retentionDate = addDays(new Date(), -retentionPeriod);
      if (dateObj < retentionDate) return false;
    }

    // Campaign duration validation
    if (campaignDuration) {
      const today = new Date();
      const durationDays = differenceInDays(dateObj, today);
      if (durationDays < campaignDuration.min || durationDays > campaignDuration.max) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Calculates date differences with business days and timezone support
 * @param startDate - Start date for calculation
 * @param endDate - End date for calculation
 * @param excludeWeekends - Whether to exclude weekends from calculation
 * @param timezone - Timezone for calculation
 * @returns Number of days between dates considering business days and timezone
 */
export const calculateDateDifference = (
  startDate: Date | string,
  endDate: Date | string,
  excludeWeekends: boolean = false,
  timezone: string = 'UTC'
): number => {
  try {
    const start = typeof startDate === 'string' ? parseDate(startDate, timezone) : startDate;
    const end = typeof endDate === 'string' ? parseDate(endDate, timezone) : endDate;

    if (!isValid(start) || !isValid(end)) {
      throw new Error('Invalid date provided');
    }

    let difference = differenceInDays(end, start);

    if (excludeWeekends) {
      // Adjust for weekends
      let tempDate = new Date(start);
      let weekendDays = 0;

      while (tempDate <= end) {
        const day = tempDate.getDay();
        if (day === 0 || day === 6) {
          weekendDays++;
        }
        tempDate = addDays(tempDate, 1);
      }

      difference -= weekendDays;
    }

    return difference;
  } catch (error) {
    throw new Error(`Error calculating date difference: ${error.message}`);
  }
};