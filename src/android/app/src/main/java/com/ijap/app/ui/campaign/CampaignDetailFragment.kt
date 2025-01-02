package com.ijap.app.ui.campaign

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.biometric.BiometricPrompt // v1.2.0
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import com.ijap.app.R
import com.ijap.app.databinding.FragmentCampaignDetailBinding
import com.ijap.app.data.models.Campaign
import com.ijap.app.utils.CurrencyUtils
import com.ijap.app.utils.SecurityUtils
import com.ijap.app.utils.ShabbatUtils
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import javax.inject.Inject
import java.util.concurrent.Executor
import androidx.core.content.ContextCompat

/**
 * Fragment displaying campaign details with enhanced security, cultural sensitivity,
 * and Shabbat-aware functionality.
 */
@AndroidEntryPoint
class CampaignDetailFragment : Fragment() {

    private var _binding: FragmentCampaignDetailBinding? = null
    private val binding get() = _binding!!

    private val viewModel: CampaignViewModel by viewModels()
    
    @Inject
    lateinit var securityUtils: SecurityUtils
    
    @Inject
    lateinit var shabbatUtils: ShabbatUtils

    private lateinit var executor: Executor
    private lateinit var biometricPrompt: BiometricPrompt
    private lateinit var promptInfo: BiometricPrompt.PromptInfo

    private var campaignId: String? = null

    companion object {
        private const val ARG_CAMPAIGN_ID = "campaign_id"
        private const val BIOMETRIC_REQUEST_CODE = 1001

        /**
         * Creates a new instance of CampaignDetailFragment with security validation.
         */
        fun newInstance(campaignId: String) = CampaignDetailFragment().apply {
            arguments = Bundle().apply {
                putString(ARG_CAMPAIGN_ID, campaignId)
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        campaignId = arguments?.getString(ARG_CAMPAIGN_ID)
        setupBiometricAuthentication()
    }

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCampaignDetailBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupSecureUI()
        observeViewModel()
        loadCampaignDetails()
    }

    private fun setupBiometricAuthentication() {
        executor = ContextCompat.getMainExecutor(requireContext())
        biometricPrompt = BiometricPrompt(this, executor,
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    super.onAuthenticationSucceeded(result)
                    loadCampaignDetails()
                }

                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    super.onAuthenticationError(errorCode, errString)
                    binding.errorView.visibility = View.VISIBLE
                    binding.errorView.text = getString(R.string.authentication_required)
                }
            })

        promptInfo = BiometricPrompt.PromptInfo.Builder()
            .setTitle(getString(R.string.biometric_prompt_title))
            .setSubtitle(getString(R.string.biometric_prompt_subtitle))
            .setNegativeButtonText(getString(R.string.biometric_prompt_cancel))
            .build()
    }

    private fun setupSecureUI() {
        with(binding) {
            // Setup RTL-aware layout
            root.layoutDirection = if (resources.configuration.layoutDirection == View.LAYOUT_DIRECTION_RTL) {
                View.LAYOUT_DIRECTION_RTL
            } else {
                View.LAYOUT_DIRECTION_LTR
            }

            // Setup donation buttons with Chai values
            setupDonationButtons()

            // Setup share functionality with security checks
            shareButton.setOnClickListener {
                if (shabbatUtils.isOperationAllowed("SHARE_CAMPAIGN")) {
                    shareCampaign()
                } else {
                    showShabbatRestrictionMessage()
                }
            }

            // Setup lottery section if applicable
            setupLotterySection()
        }
    }

    private fun observeViewModel() {
        viewLifecycleOwner.lifecycleScope.launch {
            // Observe loading state
            viewModel.isLoading.collectLatest { isLoading ->
                binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe campaign details with security validation
            viewModel.selectedCampaign.collectLatest { campaign ->
                campaign?.let {
                    if (securityUtils.validateDataIntegrity(it)) {
                        updateCampaignUI(it)
                    } else {
                        showSecurityError()
                    }
                }
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            // Observe Shabbat mode
            viewModel.isShabbatMode.collectLatest { isShabbatMode ->
                updateShabbatUI(isShabbatMode)
            }
        }
    }

    private fun updateCampaignUI(campaign: Campaign) {
        with(binding) {
            // Update campaign header with security checks
            campaignTitle.text = securityUtils.decryptString(campaign.title)
            campaignDescription.text = campaign.description

            // Update progress with culturally formatted amounts
            val progress = campaign.getProgress()
            progressBar.progress = progress
            progressText.text = getString(
                R.string.campaign_progress_format,
                progress,
                CurrencyUtils.formatCurrency(
                    amount = campaign.currentAmount,
                    currencyCode = campaign.currency,
                    useChaiNotation = true
                ),
                CurrencyUtils.formatCurrency(
                    amount = campaign.goalAmount,
                    currencyCode = campaign.currency,
                    useChaiNotation = true
                )
            )

            // Update lottery section if applicable
            campaign.lotteryDetails?.let { lottery ->
                lotterySection.visibility = View.VISIBLE
                setupLotteryDetails(lottery)
            } ?: run {
                lotterySection.visibility = View.GONE
            }

            // Update action buttons based on campaign status
            updateActionButtons(campaign)
        }
    }

    private fun setupLotteryDetails(lottery: CampaignLotteryDetails) {
        with(binding) {
            lotteryPrizesList.adapter = LotteryPrizesAdapter(
                lottery.prizes,
                lottery.currency
            )

            lotteryTicketPrice.text = CurrencyUtils.formatCurrency(
                amount = lottery.ticketPrice,
                currencyCode = lottery.currency,
                useChaiNotation = true
            )

            buyTicketsButton.setOnClickListener {
                if (shabbatUtils.isOperationAllowed("PURCHASE_LOTTERY_TICKET")) {
                    initiateTicketPurchase(lottery)
                } else {
                    showShabbatRestrictionMessage()
                }
            }
        }
    }

    private fun updateShabbatUI(isShabbatMode: Boolean) {
        with(binding) {
            // Disable interactive elements during Shabbat
            donateButton.isEnabled = !isShabbatMode
            shareButton.isEnabled = !isShabbatMode
            buyTicketsButton.isEnabled = !isShabbatMode

            // Show Shabbat mode indicator
            shabbatModeIndicator.visibility = if (isShabbatMode) View.VISIBLE else View.GONE
        }
    }

    private fun loadCampaignDetails() {
        campaignId?.let { id ->
            if (securityUtils.requiresAuthentication()) {
                biometricPrompt.authenticate(promptInfo)
            } else {
                viewModel.loadCampaignDetails(id)
            }
        }
    }

    private fun setupDonationButtons() {
        with(binding) {
            // Setup Chai-based quick donation amounts
            val chaiMultiples = listOf(1, 2, 5, 10) // Multiples of 18 (Chai)
            chaiMultiples.forEach { multiple ->
                createChaiDonationButton(multiple)
            }
        }
    }

    private fun showSecurityError() {
        binding.errorView.visibility = View.VISIBLE
        binding.errorView.text = getString(R.string.security_validation_error)
    }

    private fun showShabbatRestrictionMessage() {
        binding.errorView.visibility = View.VISIBLE
        binding.errorView.text = getString(R.string.shabbat_restriction_message)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}