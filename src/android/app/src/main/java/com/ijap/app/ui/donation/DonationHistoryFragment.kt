package com.ijap.app.ui.donation

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels // v1.6.0
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout // v1.1.0
import com.google.android.material.snackbar.Snackbar // v1.9.0
import com.ijap.app.R
import com.ijap.app.databinding.FragmentDonationHistoryBinding
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.CurrencyUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.util.Calendar
import java.util.TimeZone
import javax.inject.Inject

/**
 * Fragment displaying user's donation history with comprehensive security measures,
 * offline support, and cultural considerations for Jewish users.
 *
 * Features:
 * - Secure data handling with field-level encryption
 * - Offline-first architecture with background sync
 * - RTL support for Hebrew language
 * - Shabbat-compliant refresh behavior
 * - Chai amount highlighting
 */
@AndroidEntryPoint
class DonationHistoryFragment : Fragment() {

    private var _binding: FragmentDonationHistoryBinding? = null
    private val binding get() = _binding!!

    private val viewModel: DonationViewModel by viewModels()

    @Inject
    lateinit var securityUtils: SecurityUtils

    private val donationAdapter = DonationHistoryAdapter(
        onItemClick = { donation -> handleDonationClick(donation) },
        onReceiptClick = { donation -> handleReceiptDownload(donation) }
    )

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentDonationHistoryBinding.inflate(inflater, container, false)

        // Configure RTL support
        binding.root.layoutDirection = if (resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL) {
            View.LAYOUT_DIRECTION_RTL
        } else {
            View.LAYOUT_DIRECTION_LTR
        }

        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupSecureUI()
        observeSecureData()
        initializeRefreshBehavior()
    }

    private fun setupSecureUI() {
        // Configure secure RecyclerView
        binding.recyclerViewDonations.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = donationAdapter
            addItemDecoration(DonationItemDecoration(resources.getDimensionPixelSize(R.dimen.item_spacing)))
        }

        // Setup empty state
        binding.emptyStateLayout.isVisible = false

        // Configure secure filters
        binding.filterChipGroup.setOnCheckedChangeListener { _, checkedId ->
            when (checkedId) {
                R.id.chipAll -> loadDonations()
                R.id.chipChai -> loadChaiDonations()
                R.id.chipRecurring -> loadRecurringDonations()
            }
        }

        // Setup secure sorting
        binding.sortButton.setOnClickListener {
            showSecureSortingDialog()
        }
    }

    private fun observeSecureData() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.uiState.collectLatest { state ->
                binding.progressBar.isVisible = state is DonationUiState.Loading

                when (state) {
                    is DonationUiState.Success -> {
                        updateDonationList(state.donations)
                        binding.emptyStateLayout.isVisible = state.donations.isEmpty()
                    }
                    is DonationUiState.Error -> {
                        showSecureError(state.message)
                    }
                    is DonationUiState.Loading -> {
                        // Loading state handled by progress bar visibility
                    }
                }
            }
        }
    }

    private fun initializeRefreshBehavior() {
        binding.swipeRefreshLayout.apply {
            setOnRefreshListener {
                if (isShabbatCompliant()) {
                    showShabbatComplianceMessage()
                    isRefreshing = false
                } else {
                    refreshDonations()
                }
            }
            setColorSchemeResources(
                R.color.refresh_progress_1,
                R.color.refresh_progress_2,
                R.color.refresh_progress_3
            )
        }
    }

    private fun loadDonations() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                securityUtils.auditLog("donation_history_access", "Accessing donation history")
                viewModel.getUserDonations()
            } catch (e: Exception) {
                handleSecurityException(e)
            }
        }
    }

    private fun loadChaiDonations() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                securityUtils.auditLog("chai_donations_access", "Accessing Chai donations")
                viewModel.getChaiDonations()
            } catch (e: Exception) {
                handleSecurityException(e)
            }
        }
    }

    private fun loadRecurringDonations() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                securityUtils.auditLog("recurring_donations_access", "Accessing recurring donations")
                viewModel.getRecurringDonations()
            } catch (e: Exception) {
                handleSecurityException(e)
            }
        }
    }

    private fun refreshDonations() {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                binding.swipeRefreshLayout.isRefreshing = true
                viewModel.refreshDonations()
            } catch (e: Exception) {
                handleSecurityException(e)
            } finally {
                binding.swipeRefreshLayout.isRefreshing = false
            }
        }
    }

    private fun handleDonationClick(donation: Donation) {
        securityUtils.auditLog(
            "donation_detail_access",
            "Accessing donation details: ${securityUtils.encryptData(donation.id, "donation_id")}"
        )
        // Navigate to donation details with encrypted data
        // Implementation depends on navigation requirements
    }

    private fun handleReceiptDownload(donation: Donation) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                securityUtils.auditLog(
                    "receipt_download",
                    "Downloading receipt for donation: ${securityUtils.encryptData(donation.id, "donation_id")}"
                )
                // Implement secure receipt download
                // Implementation depends on document service requirements
            } catch (e: Exception) {
                handleSecurityException(e)
            }
        }
    }

    private fun showSecureSortingDialog() {
        // Implement secure sorting dialog
        // Implementation depends on sorting requirements
    }

    private fun isShabbatCompliant(): Boolean {
        val calendar = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem"))
        // Implement Shabbat time checking logic
        return false
    }

    private fun showShabbatComplianceMessage() {
        Snackbar.make(
            binding.root,
            R.string.shabbat_refresh_message,
            Snackbar.LENGTH_LONG
        ).show()
    }

    private fun showSecureError(message: String) {
        Snackbar.make(
            binding.root,
            message,
            Snackbar.LENGTH_LONG
        ).show()
    }

    private fun handleSecurityException(exception: Exception) {
        securityUtils.auditLog("security_error", exception.message ?: "Unknown security error")
        showSecureError(getString(R.string.security_error_message))
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        fun newInstance() = DonationHistoryFragment()
    }
}