package com.ijap.app.viewmodel

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import com.ijap.app.data.models.Association
import com.ijap.app.data.repository.AssociationRepository
import com.ijap.app.data.repository.NetworkState
import com.ijap.app.ui.association.AssociationViewModel
import com.ijap.app.ui.association.PaginatedList
import com.ijap.app.ui.association.UiState
import com.ijap.app.util.LocaleManager
import com.ijap.app.util.PerformanceTracker
import com.ijap.security.SecurityUtils // v1.0.0
import com.ijap.test.security.SecurityTestUtils // v1.0.0
import com.ijap.test.localization.LocalizationTestUtils // v1.0.0
import io.mockk.*
import io.mockk.impl.annotations.MockK
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.*
import org.junit.After
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import java.util.*
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@ExperimentalCoroutinesApi
@RunWith(RobolectricTestRunner::class)
class AssociationViewModelTest {

    @get:Rule
    val instantExecutorRule = InstantTaskExecutorRule()

    private val testDispatcher = StandardTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    @MockK
    private lateinit var associationRepository: AssociationRepository

    @MockK
    private lateinit var localeManager: LocaleManager

    @MockK
    private lateinit var performanceTracker: PerformanceTracker

    private lateinit var viewModel: AssociationViewModel
    private lateinit var securityTestUtils: SecurityTestUtils
    private lateinit var localizationTestUtils: LocalizationTestUtils

    companion object {
        private const val TEST_TIMEOUT = 5000L
        private const val SEARCH_DEBOUNCE = 300L
        private val TEST_LOCALE = Locale("en")
    }

    @Before
    fun setup() {
        MockKAnnotations.init(this)
        Dispatchers.setMain(testDispatcher)

        securityTestUtils = SecurityTestUtils()
        localizationTestUtils = LocalizationTestUtils()

        // Setup default mocks
        coEvery { associationRepository.networkState } returns MutableStateFlow(NetworkState.IDLE)
        coEvery { localeManager.getCurrentLanguage() } returns "en"
        coEvery { performanceTracker.startTrace(any()) } returns mockk(relaxed = true)

        viewModel = AssociationViewModel(
            associationRepository,
            localeManager,
            performanceTracker
        )
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
        clearAllMocks()
    }

    @Test
    fun `initial state should be Initial`() = testScope.runTest {
        assertEquals(UiState.Initial, viewModel.uiState.value)
    }

    @Test
    fun `loadAssociations should update UI state and associations`() = testScope.runTest {
        // Given
        val testAssociations = createTestAssociations()
        coEvery { 
            associationRepository.getAssociations(any(), any()) 
        } returns flowOf(testAssociations)

        // When
        viewModel.loadAssociations()
        advanceUntilIdle()

        // Then
        assertEquals(UiState.Success, viewModel.uiState.value)
        assertEquals(
            PaginatedList(
                items = testAssociations.take(20),
                totalItems = testAssociations.size,
                currentPage = 1,
                hasNextPage = testAssociations.size > 20
            ),
            viewModel.associations.value
        )
    }

    @Test
    fun `searchAssociations should debounce and filter results`() = testScope.runTest {
        // Given
        val searchQuery = "Test Association"
        val searchResults = createTestAssociations().filter { 
            it.name.contains(searchQuery, ignoreCase = true) 
        }
        coEvery { 
            associationRepository.searchAssociations(searchQuery, TEST_LOCALE) 
        } returns flowOf(searchResults)

        // When
        viewModel.searchAssociations(searchQuery)
        advanceTimeBy(SEARCH_DEBOUNCE + 100)
        advanceUntilIdle()

        // Then
        assertEquals(UiState.Success, viewModel.uiState.value)
        assertEquals(
            PaginatedList(
                items = searchResults,
                totalItems = searchResults.size,
                currentPage = 1,
                hasNextPage = false
            ),
            viewModel.associations.value
        )
    }

    @Test
    fun `updateLanguage should refresh data with new locale`() = testScope.runTest {
        // Given
        val newLanguage = "he"
        val hebrewAssociations = createTestAssociations(locale = Locale(newLanguage))
        coEvery { localeManager.setLanguage(newLanguage) } just runs
        coEvery { 
            associationRepository.getAssociations(true, Locale(newLanguage)) 
        } returns flowOf(hebrewAssociations)

        // When
        viewModel.updateLanguage(newLanguage)
        advanceUntilIdle()

        // Then
        assertEquals(newLanguage, viewModel.currentLanguage.value)
        assertEquals(UiState.Success, viewModel.uiState.value)
        coVerify { localeManager.setLanguage(newLanguage) }
    }

    @Test
    fun `selectAssociation should update selected association`() = testScope.runTest {
        // Given
        val testAssociation = createTestAssociations().first()

        // When
        viewModel.selectAssociation(testAssociation)

        // Then
        assertEquals(testAssociation, viewModel.selectedAssociation.value)
    }

    @Test
    fun `clearSelection should reset selected association`() = testScope.runTest {
        // Given
        viewModel.selectAssociation(createTestAssociations().first())

        // When
        viewModel.clearSelection()

        // Then
        assertEquals(null, viewModel.selectedAssociation.value)
    }

    @Test
    fun `loadAssociations should handle errors`() = testScope.runTest {
        // Given
        coEvery { 
            associationRepository.getAssociations(any(), any()) 
        } throws Exception("Network error")

        // When
        viewModel.loadAssociations()
        advanceUntilIdle()

        // Then
        assertTrue(viewModel.uiState.value is UiState.Error)
    }

    @Test
    fun `searchAssociations should handle empty results`() = testScope.runTest {
        // Given
        val query = "NonexistentAssociation"
        coEvery { 
            associationRepository.searchAssociations(query, TEST_LOCALE) 
        } returns flowOf(emptyList())

        // When
        viewModel.searchAssociations(query)
        advanceTimeBy(SEARCH_DEBOUNCE + 100)
        advanceUntilIdle()

        // Then
        assertEquals(UiState.Success, viewModel.uiState.value)
        assertEquals(
            PaginatedList(
                items = emptyList(),
                totalItems = 0,
                currentPage = 1,
                hasNextPage = false
            ),
            viewModel.associations.value
        )
    }

    private fun createTestAssociations(
        count: Int = 30,
        locale: Locale = TEST_LOCALE
    ): List<Association> {
        return List(count) { index ->
            mockk<Association> {
                every { id } returns "test_id_$index"
                every { name } returns "Test Association $index"
                every { isActive } returns true
                every { isVerified } returns true
                every { country } returns locale.country
                every { supportedCurrencies } returns listOf("USD", "EUR", "ILS")
            }
        }
    }
}