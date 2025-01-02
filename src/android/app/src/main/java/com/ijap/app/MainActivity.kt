package com.ijap.app

import android.os.Bundle
import android.view.MenuItem
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.google.android.material.bottomnavigation.BottomNavigationView
import com.ijap.app.ui.common.Extensions.visible
import com.ijap.app.ui.common.Extensions.gone
import com.ijap.app.ui.common.ViewUtils
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject
import android.content.res.Configuration
import android.view.View
import androidx.core.view.ViewCompat
import androidx.navigation.ui.NavigationUI
import java.util.Locale

/**
 * MainActivity serves as the primary entry point for the IJAP Android application.
 * Implements bottom navigation, multi-language support, and accessibility features.
 *
 * @since 1.0.0
 */
@AndroidEntryPoint
class MainActivity : AppCompatActivity() {

    private lateinit var navController: NavController
    private lateinit var bottomNav: BottomNavigationView

    @Inject
    lateinit var languageManager: LanguageManager

    @Inject
    lateinit var navigationStateTracker: NavigationStateTracker

    @Inject
    lateinit var accessibilityManager: AccessibilityManager

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        initializeNavigation()
        setupLanguageSupport()
        configureAccessibility()
        restoreNavigationState(savedInstanceState)
    }

    private fun initializeNavigation() {
        // Initialize NavController
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHostFragment.navController

        // Setup bottom navigation
        bottomNav = findViewById(R.id.bottom_navigation)
        bottomNav.setupWithNavController(navController)
        
        // Configure navigation item selection
        bottomNav.setOnItemSelectedListener { item ->
            onNavigationItemSelected(item)
        }

        // Setup navigation UI state handling
        navController.addOnDestinationChangedListener { _, destination, _ ->
            when (destination.id) {
                R.id.homeFragment, R.id.donateFragment, 
                R.id.campaignsFragment, R.id.profileFragment -> {
                    bottomNav.visible()
                }
                else -> bottomNav.gone()
            }
        }
    }

    private fun setupLanguageSupport() {
        // Configure RTL support based on current locale
        val currentLocale = languageManager.getCurrentLocale()
        val isRtl = currentLocale.language in arrayOf("he", "ar")
        ViewUtils.setRtlLayoutDirection(window.decorView, isRtl)

        // Apply RTL layout to bottom navigation
        ViewCompat.setLayoutDirection(bottomNav, 
            if (isRtl) ViewCompat.LAYOUT_DIRECTION_RTL else ViewCompat.LAYOUT_DIRECTION_LTR)
    }

    private fun configureAccessibility() {
        // Configure accessibility features
        bottomNav.apply {
            contentDescription = getString(R.string.bottom_navigation_description)
            importantForAccessibility = View.IMPORTANT_FOR_ACCESSIBILITY_YES
        }

        // Setup accessibility announcements for navigation
        accessibilityManager.setupNavigationAnnouncements(bottomNav)
    }

    private fun onNavigationItemSelected(item: MenuItem): Boolean {
        // Track navigation state
        navigationStateTracker.trackNavigation(item.itemId)

        // Handle navigation with proper animation
        return try {
            when (item.itemId) {
                R.id.homeFragment -> {
                    navController.navigate(R.id.homeFragment)
                    announceNavigationChange(getString(R.string.home_screen))
                    true
                }
                R.id.donateFragment -> {
                    navController.navigate(R.id.donateFragment)
                    announceNavigationChange(getString(R.string.donate_screen))
                    true
                }
                R.id.campaignsFragment -> {
                    navController.navigate(R.id.campaignsFragment)
                    announceNavigationChange(getString(R.string.campaigns_screen))
                    true
                }
                R.id.profileFragment -> {
                    navController.navigate(R.id.profileFragment)
                    announceNavigationChange(getString(R.string.profile_screen))
                    true
                }
                else -> false
            }
        } catch (e: Exception) {
            // Log navigation error and return false
            false
        }
    }

    private fun announceNavigationChange(screenName: String) {
        accessibilityManager.announceForAccessibility(this, 
            getString(R.string.navigation_announcement, screenName))
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        navigationStateTracker.saveState(outState)
    }

    private fun restoreNavigationState(savedInstanceState: Bundle?) {
        savedInstanceState?.let {
            navigationStateTracker.restoreState(it)?.let { destinationId ->
                bottomNav.selectedItemId = destinationId
            }
        }
    }

    fun handleLanguageChange(languageCode: String) {
        // Update locale configuration
        val locale = when (languageCode) {
            "he" -> Locale("he")
            "fr" -> Locale("fr")
            else -> Locale("en")
        }

        // Update configuration
        val config = Configuration(resources.configuration)
        config.setLocale(locale)
        resources.updateConfiguration(config, resources.displayMetrics)

        // Update RTL layout if needed
        val isRtl = languageCode == "he"
        ViewUtils.setRtlLayoutDirection(window.decorView, isRtl)

        // Recreate activity to apply changes
        recreate()

        // Update accessibility language
        accessibilityManager.updateLanguage(locale)
    }

    override fun onDestroy() {
        super.onDestroy()
        // Cleanup resources
        navigationStateTracker.cleanup()
        accessibilityManager.cleanup()
    }

    companion object {
        private const val TAG = "MainActivity"
    }
}