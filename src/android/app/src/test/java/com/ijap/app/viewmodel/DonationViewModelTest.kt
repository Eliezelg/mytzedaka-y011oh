package com.ijap.app.viewmodel

import androidx.arch.core.executor.testing.InstantTaskExecutorRule // v2.1.0
import com.ijap.app.data.models.Donation
import com.ijap.app.data.models.PaymentMethod
import com.ijap.app.data.repository.DonationRepository
import com.ijap.app.ui.donation.DonationUiState
import com.ijap.app.ui.donation.DonationViewModel
import com.ijap.app.utils.CurrencyUtils
import com.ijap.app.utils.SecurityUtils
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestCoroutineDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runBlockingTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestRule
import java.math.BigDecimal
import java.util.Calendar
import java.util.TimeZone
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
class DonationViewModelTest {

    @get:Rule
    val testInstantTaskExecutorRule: TestRule = InstantTaskExecutorRule()

    private val testDispatcher = TestCoroutineDispatcher()
    private val donationRepository = mockk<DonationRepository>(relaxed = true)
    private val securityUtils = mockk<SecurityUtils>(relaxed = true)
    private val currencyUtils = mockk<CurrencyUtils>(relaxed = true)
    private lateinit var viewModel: DonationViewModel

    @Before
    fun setup() {
        Dispatchers.setMain(testDispatcher)
        viewModel = DonationViewModel(
            donationRepository = donationRepository,
            securityUtils = securityUtils,
            workManager = mockk(relaxed = true)
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        testDispatcher.cleanupTestCoroutines()
    }

    @Test
    fun `test donation creation with valid chai amount`() = testDispatcher.runBlockingTest {
        // Setup
        val amount = BigDecimal("180.00") // Valid chai amount (10x chai)
        val currency = "USD"
        val associationId = "test_association"
        val paymentMethod = mockk<PaymentMethod> {
            every { id } returns "pm_test"
            every { type } returns PaymentMethodType.CREDIT_CARD
            every { isValid() } returns true
        }

        val donationSlot = slot<Donation>()
        coEvery { 
            donationRepository.createDonation(capture(donationSlot))
        } returns flowOf(mockk(relaxed = true))

        // Execute
        viewModel.createDonation(
            amount = amount,
            currency = currency,
            associationId = associationId,
            paymentMethod = paymentMethod,
            isChaiAmount = true
        )

        // Verify
        coVerify { donationRepository.createDonation(any()) }
        assertEquals(amount.toDouble(), donationSlot.captured.amount)
        assertTrue(donationSlot.captured.isChaiAmount)
        assertEquals(currency, donationSlot.captured.currency)
    }

    @Test
    fun `test donation validation during Shabbat time`() = testDispatcher.runBlockingTest {
        // Setup
        val calendar = Calendar.getInstance(TimeZone.getTimeZone("Asia/Jerusalem"))
        calendar.set(Calendar.DAY_OF_WEEK, Calendar.SATURDAY)
        calendar.set(Calendar.HOUR_OF_DAY, 12) // Middle of Shabbat

        val amount = BigDecimal("100.00")
        val paymentMethod = mockk<PaymentMethod>(relaxed = true)

        // Execute
        viewModel.createDonation(
            amount = amount,
            currency = "ILS",
            associationId = "test_association",
            paymentMethod = paymentMethod,
            isShabbatCompliant = true
        )

        // Verify donation is scheduled for after Shabbat
        coVerify { 
            donationRepository.createDonation(match { 
                it.status == Donation.DonationStatus.SCHEDULED 
            })
        }
    }

    @Test
    fun `test offline donation processing`() = testDispatcher.runBlockingTest {
        // Setup
        val amount = BigDecimal("36.00")
        val paymentMethod = mockk<PaymentMethod>(relaxed = true)
        
        every { securityUtils.encryptData(any(), any()) } returns "encrypted_data"
        coEvery { donationRepository.createDonation(any()) } throws Exception("Network error")

        // Execute
        viewModel.createDonation(
            amount = amount,
            currency = "USD",
            associationId = "test_association",
            paymentMethod = paymentMethod
        )

        // Verify offline handling
        verify { securityUtils.encryptData(any(), any()) }
        coVerify { donationRepository.syncDonations() }
    }

    @Test
    fun `test security validation for sensitive donation data`() = testDispatcher.runBlockingTest {
        // Setup
        val amount = BigDecimal("100.00")
        val paymentMethod = mockk<PaymentMethod> {
            every { id } returns "pm_test"
            every { type } returns PaymentMethodType.CREDIT_CARD
        }

        val securityMetadataSlot = slot<Map<String, String>>()
        coEvery { 
            securityUtils.encryptData(any(), capture(securityMetadataSlot))
        } returns "encrypted_data"

        // Execute
        viewModel.createDonation(
            amount = amount,
            currency = "USD",
            associationId = "test_association",
            paymentMethod = paymentMethod
        )

        // Verify security measures
        verify { 
            securityUtils.encryptData(any(), any())
        }
        assertTrue(securityMetadataSlot.captured.containsKey("encryption_version"))
    }

    @Test
    fun `test donation amount validation with currency rules`() = testDispatcher.runBlockingTest {
        // Setup
        val invalidAmount = BigDecimal("-50.00")
        val paymentMethod = mockk<PaymentMethod>(relaxed = true)

        // Execute
        viewModel.createDonation(
            amount = invalidAmount,
            currency = "ILS",
            associationId = "test_association",
            paymentMethod = paymentMethod
        )

        // Verify validation failure
        assertEquals(
            DonationUiState.Error("Invalid donation amount"),
            viewModel.uiState.value
        )
    }

    @Test
    fun `test recurring donation setup`() = testDispatcher.runBlockingTest {
        // Setup
        val amount = BigDecimal("100.00")
        val paymentMethod = mockk<PaymentMethod>(relaxed = true)

        val donationSlot = slot<Donation>()
        coEvery { 
            donationRepository.createDonation(capture(donationSlot))
        } returns flowOf(mockk(relaxed = true))

        // Execute
        viewModel.createDonation(
            amount = amount,
            currency = "USD",
            associationId = "test_association",
            paymentMethod = paymentMethod,
            isRecurring = true
        )

        // Verify recurring setup
        assertTrue(donationSlot.captured.isRecurring)
        coVerify { donationRepository.createDonation(match { it.isRecurring }) }
    }

    @Test
    fun `test anonymous donation handling`() = testDispatcher.runBlockingTest {
        // Setup
        val amount = BigDecimal("54.00")
        val paymentMethod = mockk<PaymentMethod>(relaxed = true)

        val donationSlot = slot<Donation>()
        coEvery { 
            donationRepository.createDonation(capture(donationSlot))
        } returns flowOf(mockk(relaxed = true))

        // Execute
        viewModel.createDonation(
            amount = amount,
            currency = "EUR",
            associationId = "test_association",
            paymentMethod = paymentMethod,
            isAnonymous = true
        )

        // Verify anonymous handling
        assertTrue(donationSlot.captured.isAnonymous)
        verify { securityUtils.encryptData(any(), match { it.contains("anonymous") }) }
    }

    @Test
    fun `test donation state progression`() = testDispatcher.runBlockingTest {
        // Setup
        val amount = BigDecimal("180.00")
        val paymentMethod = mockk<PaymentMethod>(relaxed = true)
        val states = mutableListOf<DonationUiState>()

        viewModel.uiState.value.let { states.add(it) }

        // Execute
        viewModel.createDonation(
            amount = amount,
            currency = "USD",
            associationId = "test_association",
            paymentMethod = paymentMethod
        )

        // Verify state progression
        assertTrue(states[0] is DonationUiState.Loading)
        coVerify { donationRepository.createDonation(any()) }
    }
}