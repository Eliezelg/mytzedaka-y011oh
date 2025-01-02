package com.ijap.app.ui.campaign

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment // v1.6.1
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.GridLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.dialog.MaterialAlertDialogBuilder // v1.9.0
import com.google.android.material.search.SearchBar
import com.google.android.material.snackbar.Snackbar
import com.ijap.app.R
import com.ijap.app.databinding.FragmentCampaignListBinding
import com.ijap.app.utils.SecurityUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.concurrent.atomic.AtomicBoolean
import javax.inject.Inject

/**
 * Fragment displaying a secure, culturally-sensitive list of fundraising campaigns
 * with Shabbat mode awareness and offline capabilities.
 */
@AndroidEntryPoint
class CampaignListFragment : Fragment() {

    private var _binding: FragmentCampaignListBinding? = null
    private val binding get() = _binding!!

    private val viewModel: CampaignViewModel by viewModels()
    private lateinit var campaignAdapter: CampaignAdapter

    @Inject
    lateinit var securityUtils: SecurityUtils

    private val isRefreshing = AtomicBoolean(false)
    private var isShabbatMode = false
    private var isOffline = false

    companion object {
        private const val GRID_SPAN_COUNT = 2
        private const val SECURITY_KEY_ALIAS = "campaign_list_key"

        fun newInstance() = CampaignListFragment()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Initialize security context
        securityUtils.showBiometricPrompt(
            requireActivity(),
            object : SecurityUtils.BiometricAuthCallback {
                override fun onAuthSuccess() {
                    initializeSecureComponents()
                }

                override fun onAuthError(errorCode: Int, errorMessage: String, remainingRetries: Int) {
                    handleSecurityError(errorCode, errorMessage, remainingRetries)
                }
            }
        )
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCampaignListBinding.inflate(inflater, container, false)

        setupRecyclerView()
        setupSwipeRefresh()
        setupSearch()
        observeViewModel()

        return binding.root
    }

    private fun setupRecyclerView() {
        campaignAdapter = CampaignAdapter(
            onCampaignClick = { campaign ->
                if (!isShabbatMode) {
                    navigateToCampaignDetails(campaign.id)
                }
            }
        )

        binding.recyclerView.apply {
            layoutManager = GridLayoutManager(context, GRID_SPAN_COUNT)
            adapter = campaignAdapter
            setHasFixedSize(true)
            
            // Add scroll listener for pagination
            addOnScrollListener(object : RecyclerView.OnScrollListener() {
                override fun onScrolled(recyclerView: RecyclerView, dx: Int, dy: Int) {
                    super.onScrolled(recyclerView, dx, dy)
                    if (!isShabbatMode && !isOffline) {
                        handlePagination(recyclerView)
                    }
                }
            })
        }
    }

    private fun setupSwipeRefresh() {
        binding.swipeRefreshLayout.apply {
            setOnRefreshListener {
                if (!isShabbatMode && !isOffline) {
                    refreshCampaigns()
                } else {
                    isRefreshing = false
                    binding.swipeRefreshLayout.isRefreshing = false
                    showModeRestrictionsDialog()
                }
            }
        }
    }

    private fun setupSearch() {
        binding.searchBar.apply {
            setOnQueryTextListener(object : SearchBar.OnQueryTextListener {
                override fun onQueryTextSubmit(query: String?): Boolean {
                    if (!isShabbatMode) {
                        performSecureSearch(query)
                    }
                    return true
                }

                override fun onQueryTextChange(newText: String?): Boolean {
                    if (!isShabbatMode) {
                        performSecureSearch(newText)
                    }
                    return true
                }
            })
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            // Observe campaigns
            launch {
                viewModel.campaigns.collectLatest { campaigns ->
                    val decryptedCampaigns = campaigns.map { campaign ->
                        securityUtils.decryptData(campaign.toString(), SECURITY_KEY_ALIAS)
                    }
                    campaignAdapter.submitList(decryptedCampaigns)
                }
            }

            // Observe loading state
            launch {
                viewModel.isLoading.collectLatest { isLoading ->
                    binding.swipeRefreshLayout.isRefreshing = isLoading
                }
            }

            // Observe Shabbat mode
            launch {
                viewModel.isShabbatMode.collectLatest { shabbatMode ->
                    handleShabbatMode(shabbatMode)
                }
            }

            // Observe offline mode
            launch {
                viewModel.isOffline.collectLatest { offline ->
                    handleOfflineMode(offline)
                }
            }

            // Observe errors
            launch {
                viewModel.error.collectLatest { error ->
                    error?.let { showError(it) }
                }
            }
        }
    }

    private fun handleShabbatMode(enabled: Boolean) {
        isShabbatMode = enabled
        binding.apply {
            searchBar.isEnabled = !enabled
            swipeRefreshLayout.isEnabled = !enabled
            
            if (enabled) {
                showShabbatModeDialog()
            }
        }
    }

    private fun handleOfflineMode(offline: Boolean) {
        isOffline = offline
        binding.apply {
            if (offline) {
                Snackbar.make(
                    root,
                    R.string.offline_mode_message,
                    Snackbar.LENGTH_INDEFINITE
                ).setAction(R.string.retry) {
                    refreshCampaigns()
                }.show()
            }
        }
    }

    private fun showShabbatModeDialog() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.shabbat_mode_title)
            .setMessage(R.string.shabbat_mode_message)
            .setPositiveButton(R.string.acknowledge) { dialog, _ ->
                dialog.dismiss()
            }
            .setCancelable(false)
            .show()
    }

    private fun showModeRestrictionsDialog() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(if (isShabbatMode) R.string.shabbat_mode_title else R.string.offline_mode_title)
            .setMessage(if (isShabbatMode) R.string.shabbat_mode_restrictions else R.string.offline_mode_restrictions)
            .setPositiveButton(R.string.acknowledge) { dialog, _ ->
                dialog.dismiss()
            }
            .show()
    }

    private fun refreshCampaigns() {
        if (isRefreshing.compareAndSet(false, true)) {
            viewModel.loadCampaigns(forceRefresh = true)
            isRefreshing.set(false)
        }
    }

    private fun performSecureSearch(query: String?) {
        // Implement secure search with input sanitization
        val sanitizedQuery = query?.trim()?.take(100)?.replace(Regex("[^A-Za-z0-9\\s]"), "")
        viewModel.searchCampaigns(sanitizedQuery)
    }

    private fun handlePagination(recyclerView: RecyclerView) {
        val layoutManager = recyclerView.layoutManager as GridLayoutManager
        val lastVisibleItem = layoutManager.findLastVisibleItemPosition()
        val totalItemCount = layoutManager.itemCount

        if (lastVisibleItem + 5 >= totalItemCount) {
            viewModel.loadMoreCampaigns()
        }
    }

    private fun navigateToCampaignDetails(campaignId: String) {
        // Implement secure navigation with encrypted campaign ID
        val encryptedId = securityUtils.encryptData(campaignId, SECURITY_KEY_ALIAS)
        // Navigation implementation
    }

    private fun showError(error: String) {
        Snackbar.make(
            binding.root,
            error,
            Snackbar.LENGTH_LONG
        ).show()
    }

    private fun initializeSecureComponents() {
        // Initialize security-sensitive components after authentication
        viewModel.loadCampaigns()
    }

    private fun handleSecurityError(errorCode: Int, errorMessage: String, remainingRetries: Int) {
        if (remainingRetries > 0) {
            showSecurityRetryDialog(remainingRetries)
        } else {
            requireActivity().finish()
        }
    }

    private fun showSecurityRetryDialog(remainingRetries: Int) {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle(R.string.security_error_title)
            .setMessage(getString(R.string.security_retry_message, remainingRetries))
            .setPositiveButton(R.string.retry) { _, _ ->
                // Retry authentication
                onCreate(null)
            }
            .setNegativeButton(R.string.cancel) { _, _ ->
                requireActivity().finish()
            }
            .setCancelable(false)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}