package com.ijap.app.ui.settings

import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.ListPreference
import androidx.preference.PreferenceManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.ijap.app.utils.LocaleUtils
import com.ijap.app.utils.Constants
import java.util.Locale
import java.util.HashMap

/**
 * Fragment responsible for managing language settings with Material Design 3.0 implementation
 * and comprehensive RTL support for Hebrew, English, and French languages.
 *
 * @version 1.0.0
 */
class LanguageSettingFragment : PreferenceFragmentCompat() {

    private companion object {
        private const val TAG = "LanguageSettingFragment"
    }

    private lateinit var languagePreference: ListPreference
    private var currentLocale: Locale = Locale.getDefault()
    private val preferenceCache = HashMap<String, String>()

    /**
     * Creates a new instance of LanguageSettingFragment
     */
    fun newInstance(): LanguageSettingFragment {
        return LanguageSettingFragment()
    }

    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        setPreferencesFromResource(R.xml.language_preferences, rootKey)
        setupLanguagePreference()
    }

    /**
     * Configures the language preference with Material Design 3.0 theming and cultural sensitivity
     */
    private fun setupLanguagePreference() {
        languagePreference = findPreference<ListPreference>(Constants.PREF_LANGUAGE)?.apply {
            val localeInfoList = LocaleUtils.getSupportedLocales()
            
            // Configure entries with both native and English names
            entries = localeInfoList.map { 
                "${it.nativeName} (${it.displayName})"
            }.toTypedArray()
            
            entryValues = localeInfoList.map { 
                it.locale.language 
            }.toTypedArray()

            // Set current language
            val currentLanguage = LocaleUtils.getCurrentLanguageCode(requireContext())
            value = currentLanguage
            preferenceCache[Constants.PREF_LANGUAGE] = currentLanguage

            // Update summary to show current language
            summary = entries[findIndexOfValue(value)]

            // Configure change listener with material dialog
            setOnPreferenceChangeListener { _, newValue ->
                onLanguageSelected(newValue.toString())
                true
            }
        } ?: throw IllegalStateException("Language preference not found")

        // Apply Material Design 3.0 styling
        languagePreference.layoutResource = R.layout.preference_material_design
    }

    /**
     * Handles language selection with Material Dialog and RTL transition support
     */
    private fun onLanguageSelected(newLanguage: String) {
        val currentLanguage = LocaleUtils.getCurrentLanguageCode(requireContext())
        
        if (newLanguage != currentLanguage) {
            val wasRTL = LocaleUtils.isRTL(requireContext())
            val willBeRTL = newLanguage == "he"

            MaterialAlertDialogBuilder(requireContext(), R.style.MaterialAlertDialog_Material3)
                .setTitle(R.string.language_change_title)
                .setMessage(R.string.language_change_message)
                .setPositiveButton(R.string.confirm) { _, _ ->
                    try {
                        // Update locale
                        val updatedContext = LocaleUtils.setLocale(requireContext(), newLanguage)
                        
                        // Update cache
                        preferenceCache[Constants.PREF_LANGUAGE] = newLanguage
                        
                        // Handle RTL transition
                        if (wasRTL != willBeRTL) {
                            // Force layout direction update
                            (view?.parent as? ViewGroup)?.layoutDirection = 
                                if (willBeRTL) ViewGroup.LAYOUT_DIRECTION_RTL 
                                else ViewGroup.LAYOUT_DIRECTION_LTR
                        }

                        // Recreate activity with transition
                        requireActivity().apply {
                            finish()
                            startActivity(Intent(this, this::class.java))
                            overridePendingTransition(
                                R.anim.fade_in,
                                R.anim.fade_out
                            )
                        }
                    } catch (e: Exception) {
                        // Revert to previous language on error
                        LocaleUtils.setLocale(requireContext(), currentLanguage)
                        showErrorDialog()
                    }
                }
                .setNegativeButton(R.string.cancel, null)
                .show()
        }
    }

    /**
     * Shows error dialog with Material Design 3.0 styling
     */
    private fun showErrorDialog() {
        MaterialAlertDialogBuilder(requireContext(), R.style.MaterialAlertDialog_Material3)
            .setTitle(R.string.error_title)
            .setMessage(R.string.language_change_error)
            .setPositiveButton(R.string.ok, null)
            .show()
    }

    /**
     * Returns the current language code
     */
    fun getCurrentLanguage(): String {
        return preferenceCache[Constants.PREF_LANGUAGE] 
            ?: LocaleUtils.getCurrentLanguageCode(requireContext())
    }
}