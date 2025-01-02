package com.ijap.app.ui.association

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.text.TextUtilsCompat
import androidx.core.view.ViewCompat
import androidx.core.view.isVisible
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.recyclerview.widget.LinearLayoutManager
import com.bumptech.glide.Glide // v4.15.1
import com.bumptech.glide.load.resource.drawable.DrawableTransitionOptions
import com.ijap.app.R
import com.ijap.app.databinding.FragmentAssociationDetailBinding
import com.ijap.app.data.models.Association
import com.ijap.app.ui.campaign.CampaignPagingAdapter
import com.ijap.app.ui.payment.PaymentGatewaySelector
import com.ijap.app.util.LocaleManager
import com.ijap.app.util.SecurityUtils
import com.ijap.app.util.UiState
import com.ijap.app.util.ViewUtils
import com.ijap.security.annotations.SecureScreen
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import timber.log.Timber // v5.0.1
import java.util.Locale
import javax.inject.Inject

/**
 * Fragment for displaying detailed information about a Jewish charitable association.
 * Implements secure data handling, RTL support, and payment gateway integration.
 */
@AndroidEntryPoint
@SecureScreen
class AssociationDetailFragment : Fragment() {

    companion object {
        private const val ARG_ASSOCIATION_ID = "association_id"
        private const val ANIMATION_DURATION = 300L

        fun newInstance(associationId: String) = AssociationDetailFragment().apply {
            arguments = Bundle().apply {
                putString(ARG_ASSOCIATION_ID, associationId)
            }
        }
    }

    @Inject
    lateinit var localeManager: LocaleManager

    @Inject
    lateinit var securityUtils: SecurityUtils

    private val viewModel: AssociationViewModel by viewModels()
    private var _binding: FragmentAssociationDetailBinding? = null
    private val binding get() = _binding!!

    private lateinit var campaignAdapter: CampaignPagingAdapter
    private lateinit var paymentSelector: PaymentGatewaySelector
    private var associationId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        associationId = arguments?.getString(ARG_ASSOCIATION_ID)
        securityUtils.initializeSecureContext()
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentAssociationDetailBinding.inflate(inflater, container, false)
        setupRtlSupport()
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        
        setupUI()
        setupSecureObservers()
        initializePaymentGateway()
        setupCampaignList()
        
        associationId?.let { id ->
            viewModel.getAssociationById(id)
        } ?: run {
            showError(getString(R.string.error_invalid_association))
        }
    }

    private fun setupRtlSupport() {
        val isRtl = TextUtilsCompat.getLayoutDirectionFromLocale(
            localeManager.getCurrentLocale()
        ) == ViewCompat.LAYOUT_DIRECTION_RTL

        ViewCompat.setLayoutDirection(binding.root, 
            if (isRtl) ViewCompat.LAYOUT_DIRECTION_RTL 
            else ViewCompat.LAYOUT_DIRECTION_LTR
        )
    }

    private fun setupUI() {
        with(binding) {
            toolbar.setNavigationOnClickListener { requireActivity().onBackPressed() }
            
            donateButton.setOnClickListener {
                paymentSelector.showPaymentOptions(
                    viewModel.selectedAssociation.value?.paymentInfo
                )
            }

            refreshLayout.setOnRefreshListener {
                associationId?.let { id ->
                    viewModel.getAssociationById(id, forceRefresh = true)
                }
            }

            setupAccessibility()
        }
    }

    private fun setupAccessibility() {
        with(binding) {
            associationName.contentDescription = getString(R.string.cd_association_name)
            donateButton.contentDescription = getString(R.string.cd_donate_button)
            campaignsList.contentDescription = getString(R.string.cd_campaigns_list)
        }
    }

    private fun setupSecureObservers() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewModel.associationState.collectLatest { state ->
                when (state) {
                    is UiState.Loading -> showLoading(true)
                    is UiState.Success -> {
                        showLoading(false)
                        viewModel.selectedAssociation.value?.let { association ->
                            updateUISecurely(association)
                        }
                    }
                    is UiState.Error -> {
                        showLoading(false)
                        showError(state.message)
                    }
                    else -> Unit
                }
            }
        }
    }

    private fun updateUISecurely(association: Association) {
        try {
            with(binding) {
                // Decrypt and display sensitive information
                val decryptedAssociation = securityUtils.decryptAssociationData(association)
                
                associationName.text = decryptedAssociation.name
                descriptionText.text = decryptedAssociation.description
                
                // Load logo with security headers
                Glide.with(this@AssociationDetailFragment)
                    .load(decryptedAssociation.logoUrl)
                    .transition(DrawableTransitionOptions.withCrossFade(ANIMATION_DURATION))
                    .error(R.drawable.ic_association_placeholder)
                    .into(logoImage)

                // Display verification status
                verificationBadge.isVisible = decryptedAssociation.isVerified
                
                // Setup payment methods
                setupPaymentMethods(decryptedAssociation.paymentInfo)
                
                // Update campaigns list
                campaignAdapter.submitList(decryptedAssociation.campaigns)
                
                // Setup contact information
                contactInfo.apply {
                    email.text = decryptedAssociation.email
                    phone.text = decryptedAssociation.phone
                    website.text = decryptedAssociation.websiteUrl
                }

                // Display legal information securely
                legalInfo.apply {
                    registrationNumber.text = decryptedAssociation.legalInfo.registrationNumber
                    taxExemption.text = decryptedAssociation.legalInfo.taxExemptionNumber
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to update UI with association data")
            showError(getString(R.string.error_loading_association))
        }
    }

    private fun initializePaymentGateway() {
        paymentSelector = PaymentGatewaySelector(
            fragment = this,
            securityUtils = securityUtils,
            onPaymentSelected = { gateway, amount ->
                viewModel.selectedAssociation.value?.let { association ->
                    processSecurePayment(association, gateway, amount)
                }
            }
        )
    }

    private fun setupCampaignList() {
        campaignAdapter = CampaignPagingAdapter()
        binding.campaignsList.apply {
            layoutManager = LinearLayoutManager(context)
            adapter = campaignAdapter
        }
    }

    private fun processSecurePayment(
        association: Association,
        gateway: String,
        amount: Double
    ) {
        viewLifecycleOwner.lifecycleScope.launch {
            try {
                val paymentResult = viewModel.processPayment(
                    associationId = association.id,
                    gateway = gateway,
                    amount = amount
                )
                handlePaymentResult(paymentResult)
            } catch (e: Exception) {
                Timber.e(e, "Payment processing failed")
                showError(getString(R.string.error_payment_failed))
            }
        }
    }

    private fun showLoading(isLoading: Boolean) {
        binding.progressBar.isVisible = isLoading
        binding.refreshLayout.isRefreshing = isLoading
    }

    private fun showError(message: String) {
        ViewUtils.showErrorSnackbar(
            binding.root,
            message,
            getString(R.string.action_retry)
        ) {
            associationId?.let { id ->
                viewModel.getAssociationById(id, forceRefresh = true)
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}