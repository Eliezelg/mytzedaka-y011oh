package com.ijap.app.utils

import com.ijap.app.utils.Constants.DEFAULT_LANGUAGE
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Calendar
import java.util.TimeZone
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import javax.annotation.concurrent.ThreadSafe

/**
 * Thread-safe utility class providing enhanced date manipulation, formatting, and validation
 * functions with comprehensive locale and timezone support for the IJAP Android application.
 *
 * @version 1.0.0
 */
@ThreadSafe
object DateUtils {

    // Global constants
    private const val DEFAULT_DATE_FORMAT = "yyyy-MM-dd"
    private const val DEFAULT_DATETIME_FORMAT = "yyyy-MM-dd HH:mm:ss"
    private const val MIN_CAMPAIGN_DURATION_DAYS = 1
    private const val MAX_CAMPAIGN_DURATION_DAYS = 90
    private const val ISRAEL_TIMEZONE = "Asia/Jerusalem"
    private const val RTL_LOCALE_PATTERN = "dd-MM-yyyy"
    private const val DATE_FORMAT_CACHE_SIZE = 10

    // Thread-safe caches
    private val dateFormatCache = ConcurrentHashMap<String, SimpleDateFormat>(DATE_FORMAT_CACHE_SIZE)
    private val timeZoneCache = ConcurrentHashMap<String, TimeZone>()

    /**
     * Formats a date according to the specified locale and format pattern with enhanced RTL support.
     *
     * @param date The date to format
     * @param pattern The format pattern (defaults to DEFAULT_DATE_FORMAT)
     * @param locale The target locale (defaults to system locale)
     * @param timezone The target timezone (defaults to system timezone)
     * @return Formatted date string according to locale with RTL consideration
     * @throws IllegalArgumentException if date is null or pattern is invalid
     */
    @JvmStatic
    fun formatDate(
        date: Date,
        pattern: String = DEFAULT_DATE_FORMAT,
        locale: Locale = Locale.getDefault(),
        timezone: String? = null
    ): String {
        require(date != null) { "Date cannot be null" }
        
        val cacheKey = "${pattern}_${locale}_${timezone}"
        val dateFormat = dateFormatCache.getOrPut(cacheKey) {
            SimpleDateFormat(
                // Use RTL pattern for Hebrew locale
                if (locale.language == "he") RTL_LOCALE_PATTERN else pattern,
                locale
            ).apply {
                timezone?.let {
                    timeZone = timeZoneCache.getOrPut(it) {
                        TimeZone.getTimeZone(it)
                    }
                }
            }
        }

        return synchronized(dateFormat) {
            dateFormat.format(date)
        }
    }

    /**
     * Parses a date string into a Date object with enhanced timezone and locale handling.
     *
     * @param dateString The date string to parse
     * @param pattern The format pattern (defaults to DEFAULT_DATE_FORMAT)
     * @param timezone The source timezone (defaults to system timezone)
     * @param locale The source locale (defaults to system locale)
     * @return Parsed Date object with correct timezone
     * @throws IllegalArgumentException if dateString is invalid
     * @throws java.text.ParseException if parsing fails
     */
    @JvmStatic
    fun parseDate(
        dateString: String,
        pattern: String = DEFAULT_DATE_FORMAT,
        timezone: String? = null,
        locale: Locale = Locale.getDefault()
    ): Date {
        require(dateString.isNotBlank()) { "Date string cannot be empty" }

        val cacheKey = "${pattern}_${locale}_${timezone}"
        val dateFormat = dateFormatCache.getOrPut(cacheKey) {
            SimpleDateFormat(pattern, locale).apply {
                timezone?.let {
                    timeZone = timeZoneCache.getOrPut(it) {
                        TimeZone.getTimeZone(it)
                    }
                }
            }
        }

        return synchronized(dateFormat) {
            dateFormat.parse(dateString) ?: throw IllegalArgumentException("Invalid date string")
        }
    }

    /**
     * Validates a date range for campaign scheduling with timezone awareness.
     *
     * @param startDate Campaign start date
     * @param endDate Campaign end date
     * @param minDuration Minimum duration in days (defaults to MIN_CAMPAIGN_DURATION_DAYS)
     * @param maxDuration Maximum duration in days (defaults to MAX_CAMPAIGN_DURATION_DAYS)
     * @param timezone Target timezone (defaults to ISRAEL_TIMEZONE)
     * @return Boolean indicating whether the date range is valid
     * @throws IllegalArgumentException if dates are null or duration limits are invalid
     */
    @JvmStatic
    fun validateDateRange(
        startDate: Date,
        endDate: Date,
        minDuration: Int = MIN_CAMPAIGN_DURATION_DAYS,
        maxDuration: Int = MAX_CAMPAIGN_DURATION_DAYS,
        timezone: String = ISRAEL_TIMEZONE
    ): Boolean {
        require(startDate != null && endDate != null) { "Dates cannot be null" }
        require(minDuration > 0 && maxDuration >= minDuration) { "Invalid duration limits" }

        val tz = timeZoneCache.getOrPut(timezone) {
            TimeZone.getTimeZone(timezone)
        }

        val calendar = Calendar.getInstance(tz).apply {
            // Clear time components for date comparison
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }

        // Check if start date is not in the past
        val now = calendar.time
        if (startDate.before(now)) {
            return false
        }

        // Check if end date is after start date
        if (!endDate.after(startDate)) {
            return false
        }

        // Calculate duration in days considering timezone
        val durationMs = endDate.time - startDate.time
        val durationDays = (durationMs / (1000 * 60 * 60 * 24)).toInt()

        // Validate duration against limits
        return durationDays in minDuration..maxDuration
    }

    /**
     * Converts a Date to a specific timezone.
     *
     * @param date The date to convert
     * @param timezone Target timezone
     * @return Date adjusted to the target timezone
     */
    @JvmStatic
    private fun convertToTimezone(date: Date, timezone: String): Date {
        val targetTz = timeZoneCache.getOrPut(timezone) {
            TimeZone.getTimeZone(timezone)
        }
        val sourceTz = TimeZone.getDefault()
        
        val calendar = Calendar.getInstance().apply {
            time = date
            add(Calendar.MILLISECOND, 
                targetTz.getOffset(date.time) - sourceTz.getOffset(date.time))
        }
        
        return calendar.time
    }
}