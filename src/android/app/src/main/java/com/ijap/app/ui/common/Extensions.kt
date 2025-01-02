package com.ijap.app.ui.common

import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import android.widget.EditText
import android.widget.ImageView
import android.view.LayoutInflater
import android.view.accessibility.AccessibilityEvent
import java.lang.ref.WeakReference
import com.ijap.app.ui.common.ViewUtils.dpToPx
import com.ijap.app.ui.common.ViewUtils.setAccessibilityText

/**
 * Extension functions for Android UI components providing enhanced accessibility
 * and RTL layout support for the IJAP application.
 *
 * @since 1.0.0
 */

/**
 * Sets accessibility description with proper announcement support.
 *
 * @param description The accessibility description text
 * @param announceImmediately Whether to announce the change immediately via TalkBack
 */
fun View.setAccessibilityDescription(description: String, announceImmediately: Boolean = false) {
    setAccessibilityText(this, description, announceImmediately)
}

/**
 * Sets margins with RTL layout support.
 *
 * @param start Start margin in dp
 * @param top Top margin in dp
 * @param end End margin in dp
 * @param bottom Bottom margin in dp
 */
fun View.setRtlAwareMargins(start: Int, top: Int, end: Int, bottom: Int) {
    val layoutParams = layoutParams as? ViewGroup.MarginLayoutParams ?: return
    val context = context ?: return
    
    layoutParams.apply {
        marginStart = dpToPx(context, start.toFloat())
        topMargin = dpToPx(context, top.toFloat())
        marginEnd = dpToPx(context, end.toFloat())
        bottomMargin = dpToPx(context, bottom.toFloat())
    }
    
    this.layoutParams = layoutParams
}

/**
 * Sets RTL-aware layout direction for ViewGroup and its children.
 *
 * @param isRtl Whether to use RTL layout direction
 */
fun ViewGroup.setRtlAwareLayoutDirection(isRtl: Boolean) {
    layoutDirection = if (isRtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR
    
    // Recursively apply to all child views
    for (i in 0 until childCount) {
        getChildAt(i)?.let { child ->
            child.layoutDirection = layoutDirection
            (child as? ViewGroup)?.setRtlAwareLayoutDirection(isRtl)
        }
    }
}

/**
 * Sets text with proper accessibility announcement.
 *
 * @param text The text to set
 * @param announceChange Whether to announce the text change
 */
fun TextView.setAccessibleText(text: String?, announceChange: Boolean = false) {
    this.text = text
    if (announceChange && !text.isNullOrEmpty()) {
        announceForAccessibility(text)
        sendAccessibilityEvent(AccessibilityEvent.TYPE_VIEW_FOCUSED)
    }
}

/**
 * Configures EditText for accessibility with proper input type and hints.
 *
 * @param hint The hint text
 * @param contentDescription The accessibility content description
 */
fun EditText.configureAccessibility(hint: String, contentDescription: String) {
    this.hint = hint
    setAccessibilityDescription(contentDescription)
    importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
}

/**
 * Sets image with accessibility description.
 *
 * @param resId The resource ID of the image
 * @param contentDescription The accessibility description for the image
 */
fun ImageView.setAccessibleImage(resId: Int, contentDescription: String) {
    setImageResource(resId)
    setAccessibilityDescription(contentDescription)
}

/**
 * Extension to safely handle view inflation with proper error handling.
 *
 * @param layoutResId The layout resource ID to inflate
 * @param root The parent view to attach to
 * @param attachToRoot Whether to attach the inflated layout to the root
 * @return The inflated view or null if inflation fails
 */
fun LayoutInflater.safeInflate(
    layoutResId: Int,
    root: ViewGroup?,
    attachToRoot: Boolean = false
): View? = try {
    inflate(layoutResId, root, attachToRoot)
} catch (e: Exception) {
    null
}

/**
 * Sets view padding with RTL support.
 *
 * @param start Start padding in dp
 * @param top Top padding in dp
 * @param end End padding in dp
 * @param bottom Bottom padding in dp
 */
fun View.setRtlAwarePadding(start: Int, top: Int, end: Int, bottom: Int) {
    val context = context ?: return
    setPaddingRelative(
        dpToPx(context, start.toFloat()),
        dpToPx(context, top.toFloat()),
        dpToPx(context, end.toFloat()),
        dpToPx(context, bottom.toFloat())
    )
}

/**
 * Extension to handle view visibility states with accessibility announcement.
 *
 * @param visible Whether the view should be visible
 * @param announceVisibilityChange Whether to announce the visibility change
 */
fun View.setAccessibleVisibility(visible: Boolean, announceVisibilityChange: Boolean = false) {
    visibility = if (visible) View.VISIBLE else View.GONE
    if (announceVisibilityChange) {
        val announcement = if (visible) {
            contentDescription
        } else {
            context.getString(android.R.string.cancel)
        }
        announcement?.let { announceForAccessibility(it) }
    }
}

/**
 * Extension to enable/disable view with proper accessibility state.
 *
 * @param enabled Whether the view should be enabled
 * @param announceState Whether to announce the state change
 */
fun View.setAccessibleState(enabled: Boolean, announceState: Boolean = false) {
    isEnabled = enabled
    if (announceState) {
        val stateDescription = if (enabled) {
            context.getString(android.R.string.ok)
        } else {
            context.getString(android.R.string.cancel)
        }
        announceForAccessibility(stateDescription)
    }
}