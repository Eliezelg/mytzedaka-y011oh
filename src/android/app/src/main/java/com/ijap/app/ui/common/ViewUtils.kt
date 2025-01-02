package com.ijap.app.ui.common

import android.content.Context
import android.view.View
import android.util.TypedValue
import android.view.animation.Animation
import android.view.animation.AnimationUtils
import java.lang.ref.WeakReference
import android.view.animation.AlphaAnimation
import android.view.accessibility.AccessibilityEvent
import android.os.Build
import android.util.DisplayMetrics
import android.view.View.VISIBLE
import android.view.View.GONE

/**
 * Utility object providing optimized view manipulation functions for the IJAP Android application.
 * Implements memory-efficient operations with enhanced error handling and accessibility support.
 * 
 * @since 1.0.0
 */
object ViewUtils {
    // Cache for display metrics to optimize dimension conversions
    private var displayMetricsRef: WeakReference<DisplayMetrics>? = null
    
    // Cache for animations to prevent repeated instantiation
    private var fadeInAnimation: AlphaAnimation? = null
    private var fadeOutAnimation: AlphaAnimation? = null

    /**
     * Converts density-independent pixels (dp) to pixels (px) with display metrics caching.
     *
     * @param context The context used to get display metrics
     * @param dp The value in dp to convert
     * @return The converted value in pixels, or 0 if context is null
     */
    fun dpToPx(context: Context?, dp: Float): Int {
        if (context == null) return 0

        val displayMetrics = displayMetricsRef?.get() ?: run {
            context.resources.displayMetrics.also { metrics ->
                displayMetricsRef = WeakReference(metrics)
            }
        }

        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            dp,
            displayMetrics
        ).toInt()
    }

    /**
     * Converts pixels (px) to density-independent pixels (dp).
     *
     * @param context The context used to get display metrics
     * @param px The value in pixels to convert
     * @return The converted value in dp, or 0 if context is null
     */
    fun pxToDp(context: Context?, px: Int): Float {
        if (context == null) return 0f

        val displayMetrics = displayMetricsRef?.get() ?: run {
            context.resources.displayMetrics.also { metrics ->
                displayMetricsRef = WeakReference(metrics)
            }
        }

        return px / (displayMetrics.densityDpi.toFloat() / DisplayMetrics.DENSITY_DEFAULT)
    }

    /**
     * Applies an optimized fade in animation to a view with optional listener support.
     *
     * @param view The view to animate
     * @param duration The duration of the animation in milliseconds
     * @param listener Optional animation listener
     */
    fun fadeIn(view: View?, duration: Long = 300L, listener: Animation.AnimationListener? = null) {
        if (view == null) return

        view.visibility = VISIBLE
        
        val animation = fadeInAnimation ?: AlphaAnimation(0f, 1f).also {
            fadeInAnimation = it
        }

        animation.duration = duration
        animation.setAnimationListener(listener)

        // Enable hardware acceleration if available
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            view.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        }

        view.startAnimation(animation)
    }

    /**
     * Applies an optimized fade out animation to a view with optional listener support.
     *
     * @param view The view to animate
     * @param duration The duration of the animation in milliseconds
     * @param listener Optional animation listener
     */
    fun fadeOut(view: View?, duration: Long = 300L, listener: Animation.AnimationListener? = null) {
        if (view == null) return

        val animation = fadeOutAnimation ?: AlphaAnimation(1f, 0f).also {
            fadeOutAnimation = it
        }

        animation.duration = duration
        animation.setAnimationListener(object : Animation.AnimationListener {
            override fun onAnimationStart(animation: Animation) {
                listener?.onAnimationStart(animation)
            }

            override fun onAnimationEnd(animation: Animation) {
                view.visibility = GONE
                listener?.onAnimationEnd(animation)
                
                // Reset layer type after animation
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    view.setLayerType(View.LAYER_TYPE_NONE, null)
                }
            }

            override fun onAnimationRepeat(animation: Animation) {
                listener?.onAnimationRepeat(animation)
            }
        })

        view.startAnimation(animation)
    }

    /**
     * Sets accessibility content description with TalkBack announcement support.
     *
     * @param view The view to configure accessibility for
     * @param text The accessibility text to set
     * @param announceForTalkBack Whether to announce the text for TalkBack
     */
    fun setAccessibilityText(view: View?, text: String?, announceForTalkBack: Boolean = false) {
        if (view == null) return

        view.contentDescription = text
        view.importantForAccessibility = if (!text.isNullOrEmpty()) {
            View.IMPORTANT_FOR_ACCESSIBILITY_YES
        } else {
            View.IMPORTANT_FOR_ACCESSIBILITY_NO
        }

        if (announceForTalkBack && !text.isNullOrEmpty()) {
            view.announceForAccessibility(text)
            view.sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_FOCUSED)
        }
    }

    /**
     * Sets the layout direction for RTL support.
     *
     * @param view The view to configure RTL layout for
     * @param isRtl Whether to use RTL layout
     */
    fun setRtlLayoutDirection(view: View?, isRtl: Boolean) {
        if (view == null) return

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            view.layoutDirection = if (isRtl) {
                View.LAYOUT_DIRECTION_RTL
            } else {
                View.LAYOUT_DIRECTION_LTR
            }
        }
    }

    /**
     * Cleans up cached resources to prevent memory leaks.
     * Should be called when the application is being destroyed.
     */
    fun cleanup() {
        displayMetricsRef?.clear()
        displayMetricsRef = null
        fadeInAnimation = null
        fadeOutAnimation = null
    }
}