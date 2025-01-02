package com.ijap.app.ui.common

import android.animation.ObjectAnimator
import android.view.View
import android.widget.ImageView
import android.widget.ProgressBar
import android.widget.TextView
import androidx.databinding.BindingAdapter
import com.bumptech.glide.Glide // v4.12.0
import com.bumptech.glide.load.engine.DiskCacheStrategy
import com.ijap.app.utils.CurrencyUtils
import com.ijap.app.utils.DateUtils
import com.ijap.app.utils.LocaleUtils
import timber.log.Timber // v5.0.1
import java.util.Date

/**
 * Custom data binding adapters for the IJAP Android application.
 * Provides specialized formatting and display capabilities with RTL support.
 */

/**
 * Binds currency amount to TextView with proper formatting and RTL support.
 *
 * @param view Target TextView
 * @param amount Numeric amount to format
 * @param currencyCode ISO 4217 currency code
 */
@BindingAdapter("amount", "currencyCode")
fun bindCurrencyText(view: TextView, amount: Double, currencyCode: String) {
    try {
        Timber.d("Formatting currency: $amount $currencyCode")
        
        // Format currency with cultural considerations
        val formattedAmount = CurrencyUtils.formatCurrency(
            amount = amount,
            currencyCode = currencyCode,
            useChaiNotation = true // Enable chai notation for multiples of 18
        )
        
        view.text = formattedAmount
        
        // Apply RTL layout if needed
        view.textDirection = if (LocaleUtils.isRTL(view.context)) {
            View.TEXT_DIRECTION_RTL
        } else {
            View.TEXT_DIRECTION_LTR
        }
        
        // Set content description for accessibility
        view.contentDescription = view.context.getString(
            android.R.string.ok, // Replace with actual string resource
            formattedAmount
        )
        
        Timber.d("Currency formatting completed: $formattedAmount")
    } catch (e: Exception) {
        Timber.e(e, "Error formatting currency")
        view.text = amount.toString()
    }
}

/**
 * Binds date to TextView with localized formatting and RTL support.
 *
 * @param view Target TextView
 * @param date Date to format
 */
@BindingAdapter("date")
fun bindDateText(view: TextView, date: Date) {
    try {
        // Format date using current locale
        val formattedDate = DateUtils.formatDate(
            date = date,
            locale = LocaleUtils.getCurrentLocale(view.context)
        )
        
        view.text = formattedDate
        
        // Apply RTL layout if needed
        view.textDirection = if (LocaleUtils.isRTL(view.context)) {
            View.TEXT_DIRECTION_RTL
        } else {
            View.TEXT_DIRECTION_LTR
        }
        
        // Set content description for accessibility
        view.contentDescription = formattedDate
        
    } catch (e: Exception) {
        Timber.e(e, "Error formatting date")
        view.text = date.toString()
    }
}

/**
 * Binds image URL to ImageView using Glide with performance monitoring.
 *
 * @param view Target ImageView
 * @param url Image URL to load
 */
@BindingAdapter("imageUrl")
fun bindImageUrl(view: ImageView, url: String?) {
    if (url.isNullOrEmpty()) {
        view.setImageDrawable(null)
        return
    }

    try {
        val startTime = System.currentTimeMillis()
        Timber.d("Starting image load: $url")

        Glide.with(view.context)
            .load(url)
            .diskCacheStrategy(DiskCacheStrategy.ALL)
            .timeout(30000) // 30 second timeout
            .error(android.R.drawable.ic_dialog_alert) // Replace with actual error drawable
            .placeholder(android.R.drawable.ic_menu_gallery) // Replace with actual placeholder
            .listener(object : com.bumptech.glide.request.RequestListener<android.graphics.drawable.Drawable> {
                override fun onLoadFailed(
                    e: com.bumptech.glide.load.engine.GlideException?,
                    model: Any?,
                    target: com.bumptech.glide.request.target.Target<android.graphics.drawable.Drawable>?,
                    isFirstResource: Boolean
                ): Boolean {
                    Timber.e(e, "Image load failed: $url")
                    return false
                }

                override fun onResourceReady(
                    resource: android.graphics.drawable.Drawable,
                    model: Any?,
                    target: com.bumptech.glide.request.target.Target<android.graphics.drawable.Drawable>?,
                    dataSource: com.bumptech.glide.load.DataSource?,
                    isFirstResource: Boolean
                ): Boolean {
                    val loadTime = System.currentTimeMillis() - startTime
                    Timber.d("Image loaded in ${loadTime}ms: $url")
                    return false
                }
            })
            .into(view)

        // Set content description for accessibility
        view.contentDescription = url.substringAfterLast('/')
            .substringBeforeLast('.')
            .replace(Regex("[^A-Za-z0-9]"), " ")

    } catch (e: Exception) {
        Timber.e(e, "Error loading image")
        view.setImageDrawable(null)
    }
}

/**
 * Binds campaign progress to ProgressBar with RTL support and animations.
 *
 * @param view Target ProgressBar
 * @param progress Progress value (0-100)
 * @param animate Whether to animate progress changes
 */
@BindingAdapter("progress", "animate")
fun bindCampaignProgress(view: ProgressBar, progress: Float, animate: Boolean = true) {
    try {
        // Validate progress value
        val validProgress = progress.coerceIn(0f, 100f)
        
        // Set layout direction based on locale
        view.layoutDirection = if (LocaleUtils.isRTL(view.context)) {
            View.LAYOUT_DIRECTION_RTL
        } else {
            View.LAYOUT_DIRECTION_LTR
        }
        
        if (animate) {
            ObjectAnimator.ofInt(view, "progress", validProgress.toInt()).apply {
                duration = 1000 // 1 second animation
                start()
            }
        } else {
            view.progress = validProgress.toInt()
        }
        
        // Set content description for accessibility
        view.contentDescription = "${validProgress.toInt()}%"
        
        // Handle edge cases
        when (validProgress) {
            0f -> view.visibility = View.GONE
            100f -> view.isEnabled = false
            else -> {
                view.visibility = View.VISIBLE
                view.isEnabled = true
            }
        }
        
    } catch (e: Exception) {
        Timber.e(e, "Error setting progress")
        view.progress = 0
    }
}