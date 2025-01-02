package com.ijap.app.viewmodel

import com.ijap.app.data.models.Campaign
import com.ijap.app.data.repository.CampaignRepository
import com.ijap.app.ui.campaign.CampaignViewModel
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestCoroutineDispatcher
import kotlinx.coroutines.test.TestCoroutineScope
import kotlinx.coroutines.test.runBlockingTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.Mockito
import org.mockito.MockitoAnnotations
import org.mockito.junit.MockitoJUnitRunner
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

// Test constants
private const val TEST_CAMPAIGN_ID = "test_campaign_1"
private const val TEST_ERROR_MESSAGE = "Failed to load campaigns"
private const val SHABBAT_MODE_MESSAGE = "Operation not available during Shabbat"
private val TEST_CURRENCIES = listOf("USD", "ILS", "EUR")

@ExperimentalCoroutinesApi
@RunWith(MockitoJUnitRunner::class)
class CampaignViewModelTest {

    @Mock
    private lateinit var campaignRepository: CampaignRepository

    private val testDispatcher = TestCoroutineDispatcher()
    private val testScope = TestCoroutineScope(testDispatcher)

    private lateinit var viewModel: CampaignViewModel
    private var isShabbatMode = false

    @Before
    fun setup() {
        MockitoAnnotations.openMocks(this)
        viewModel = CampaignViewModel(campaignRepository)
    }

    @Test
    fun `test initial state`() = testScope.runBlockingTest {
        // Verify initial states
        assertFalse(viewModel.isLoading.value)
        assertTrue(viewModel.campaigns.value.isEmpty())
        assertNull(viewModel.error.value)
        assertNull(viewModel.selectedCampaign.value)
        assertFalse(viewModel.isShabbatMode.value)
    }

    @Test
    fun `test loadCampaigns success`() = testScope.runBlockingTest {
        // Create test campaign data
        val testCampaigns = listOf(
            createTestCampaign("USD", true),
            createTestCampaign("ILS", true),
            createTestCampaign("EUR", false)
        )

        // Mock repository response
        Mockito.`when`(campaignRepository.getCampaigns(false))
            .thenReturn(flowOf(testCampaigns))

        // Load campaigns
        viewModel.loadCampaigns()

        // Verify loading states
        assertTrue(viewModel.isLoading.value)
        
        // Advance coroutines
        testDispatcher.advanceUntilIdle()

        // Verify final state
        assertFalse(viewModel.isLoading.value)
        assertEquals(3, viewModel.campaigns.value.size)
        assertNull(viewModel.error.value)
    }

    @Test
    fun `test loadCampaigns error`() = testScope.runBlockingTest {
        // Mock repository error
        Mockito.`when`(campaignRepository.getCampaigns(false))
            .thenThrow(RuntimeException(TEST_ERROR_MESSAGE))

        // Load campaigns
        viewModel.loadCampaigns()

        // Advance coroutines
        testDispatcher.advanceUntilIdle()

        // Verify error state
        assertFalse(viewModel.isLoading.value)
        assertTrue(viewModel.campaigns.value.isEmpty())
        assertEquals(TEST_ERROR_MESSAGE, viewModel.error.value)
    }

    @Test
    fun `test loadCampaignDetails success`() = testScope.runBlockingTest {
        // Create test campaign
        val testCampaign = createTestCampaign("USD", true)

        // Mock repository response
        Mockito.`when`(campaignRepository.getCampaignById(TEST_CAMPAIGN_ID))
            .thenReturn(flowOf(testCampaign))

        // Load campaign details
        viewModel.loadCampaignDetails(TEST_CAMPAIGN_ID)

        // Advance coroutines
        testDispatcher.advanceUntilIdle()

        // Verify state
        assertFalse(viewModel.isLoading.value)
        assertNotNull(viewModel.selectedCampaign.value)
        assertEquals(TEST_CAMPAIGN_ID, viewModel.selectedCampaign.value?.id)
        assertNull(viewModel.error.value)
    }

    @Test
    fun `test Shabbat mode campaign loading`() = testScope.runBlockingTest {
        // Enable Shabbat mode
        val shabbatModeFlow = MutableStateFlow(true)
        Mockito.`when`(campaignRepository.getCampaigns(false))
            .thenReturn(flowOf(emptyList()))

        // Load campaigns during Shabbat
        viewModel.loadCampaigns()

        // Advance coroutines
        testDispatcher.advanceUntilIdle()

        // Verify Shabbat mode behavior
        assertFalse(viewModel.isLoading.value)
        assertTrue(viewModel.campaigns.value.isEmpty())
        assertTrue(viewModel.error.value?.contains("Shabbat") ?: false)
    }

    @Test
    fun `test currency formatting in campaigns`() = testScope.runBlockingTest {
        // Create test campaigns with different currencies
        val testCampaigns = TEST_CURRENCIES.map { currency ->
            createTestCampaign(currency, true)
        }

        // Mock repository response
        Mockito.`when`(campaignRepository.getCampaigns(false))
            .thenReturn(flowOf(testCampaigns))

        // Load campaigns
        viewModel.loadCampaigns()

        // Advance coroutines
        testDispatcher.advanceUntilIdle()

        // Verify currency formatting
        viewModel.campaigns.value.forEach { campaign ->
            assertTrue(campaign.currency in TEST_CURRENCIES)
            assertTrue(campaign.goalAmount >= 0)
        }
    }

    @Test
    fun `test campaign validation`() = testScope.runBlockingTest {
        // Create test campaign with invalid data
        val invalidCampaign = createTestCampaign("USD", true).copy(
            goalAmount = -100.0,
            startDate = System.currentTimeMillis() - 86400000 // Past date
        )

        // Mock repository response
        Mockito.`when`(campaignRepository.getCampaignById(TEST_CAMPAIGN_ID))
            .thenReturn(flowOf(invalidCampaign))

        // Load campaign details
        viewModel.loadCampaignDetails(TEST_CAMPAIGN_ID)

        // Advance coroutines
        testDispatcher.advanceUntilIdle()

        // Verify validation error
        assertNotNull(viewModel.error.value)
    }

    private fun createTestCampaign(
        currency: String,
        isShabbatCompliant: Boolean
    ): Campaign = Campaign(
        id = UUID.randomUUID().toString(),
        title = "Test Campaign",
        description = "Test Description",
        goalAmount = 1800.0,
        currency = currency,
        startDate = System.currentTimeMillis(),
        endDate = System.currentTimeMillis() + 86400000,
        associationId = "test_association",
        status = Campaign.STATUS_ACTIVE,
        lastModifiedBy = "test_user",
        isLottery = false
    )
}