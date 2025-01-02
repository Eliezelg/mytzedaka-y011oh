package com.ijap.app.viewmodel

import androidx.arch.core.executor.testing.InstantTaskExecutorRule
import com.ijap.app.data.models.User
import com.ijap.app.data.repository.AuthRepository
import com.ijap.app.data.repository.AuthRepository.AuthState
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.test.TestCoroutineDispatcher
import kotlinx.coroutines.test.runBlockingTest
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith
import org.mockito.Mock
import org.mockito.junit.MockitoJUnitRunner
import org.mockito.kotlin.any
import org.mockito.kotlin.verify
import org.mockito.kotlin.whenever
import java.util.Locale
import java.util.TimeZone

@ExperimentalCoroutinesApi
@RunWith(MockitoJUnitRunner::class)
class AuthViewModelTest {

    @get:Rule
    val instantTaskExecutorRule = InstantTaskExecutorRule()

    @Mock
    private lateinit var mockAuthRepository: AuthRepository

    private val testDispatcher = TestCoroutineDispatcher()
    private lateinit var viewModel: AuthViewModel

    // Test constants
    companion object {
        private const val TEST_EMAIL = "test@example.com"
        private const val TEST_PASSWORD = "Password123!"
        private const val TEST_2FA_CODE = "123456"
        private const val TEST_HEBREW_EMAIL = "בדיקה@example.com"
        private const val TEST_JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
        private const val TEST_FIRST_NAME = "John"
        private const val TEST_LAST_NAME = "Doe"
    }

    @Before
    fun setup() {
        viewModel = AuthViewModel(mockAuthRepository, testDispatcher)
    }

    @Test
    fun `test successful login with email and password`() = runBlockingTest {
        // Given
        val mockUser = createMockUser()
        whenever(mockAuthRepository.login(TEST_EMAIL, TEST_PASSWORD))
            .thenReturn(flowOf(Result.success(mockUser)))

        // When
        viewModel.login(TEST_EMAIL, TEST_PASSWORD)

        // Then
        verify(mockAuthRepository).login(TEST_EMAIL, TEST_PASSWORD)
        assert(viewModel.authState.value is AuthState.Authenticated)
        assert((viewModel.authState.value as AuthState.Authenticated).user == mockUser)
    }

    @Test
    fun `test login with invalid credentials`() = runBlockingTest {
        // Given
        whenever(mockAuthRepository.login(TEST_EMAIL, TEST_PASSWORD))
            .thenReturn(flowOf(Result.failure(AuthRepository.AuthException("Invalid credentials"))))

        // When
        viewModel.login(TEST_EMAIL, TEST_PASSWORD)

        // Then
        verify(mockAuthRepository).login(TEST_EMAIL, TEST_PASSWORD)
        assert(viewModel.authState.value is AuthState.Error)
        assert((viewModel.authState.value as AuthState.Error).message == "Invalid credentials")
    }

    @Test
    fun `test successful 2FA verification`() = runBlockingTest {
        // Given
        val mockUser = createMockUser()
        whenever(mockAuthRepository.verifyTwoFactor(TEST_2FA_CODE, TEST_JWT_TOKEN))
            .thenReturn(flowOf(Result.success(mockUser)))

        // When
        viewModel.verifyTwoFactor(TEST_2FA_CODE, TEST_JWT_TOKEN)

        // Then
        verify(mockAuthRepository).verifyTwoFactor(TEST_2FA_CODE, TEST_JWT_TOKEN)
        assert(viewModel.authState.value is AuthState.Authenticated)
    }

    @Test
    fun `test RTL support with Hebrew email`() = runBlockingTest {
        // Given
        val mockUser = createMockUser(email = TEST_HEBREW_EMAIL)
        whenever(mockAuthRepository.login(TEST_HEBREW_EMAIL, TEST_PASSWORD))
            .thenReturn(flowOf(Result.success(mockUser)))

        // Set Hebrew locale
        Locale.setDefault(Locale("he", "IL"))

        // When
        viewModel.login(TEST_HEBREW_EMAIL, TEST_PASSWORD)

        // Then
        verify(mockAuthRepository).login(TEST_HEBREW_EMAIL, TEST_PASSWORD)
        assert(viewModel.authState.value is AuthState.Authenticated)
        assert((viewModel.authState.value as AuthState.Authenticated).user.email == TEST_HEBREW_EMAIL)
    }

    @Test
    fun `test Shabbat mode authentication restrictions`() = runBlockingTest {
        // Given
        val jerusalemTimeZone = TimeZone.getTimeZone("Asia/Jerusalem")
        TimeZone.setDefault(jerusalemTimeZone)
        
        // Simulate Shabbat time (Friday evening)
        val shabbatTime = System.currentTimeMillis() // Would be set to actual Shabbat time
        whenever(mockAuthRepository.login(any(), any()))
            .thenReturn(flowOf(Result.failure(
                AuthRepository.AuthException("Authentication not available during Shabbat")
            )))

        // When
        viewModel.login(TEST_EMAIL, TEST_PASSWORD)

        // Then
        assert(viewModel.authState.value is AuthState.Error)
        assert((viewModel.authState.value as AuthState.Error).message.contains("Shabbat"))
    }

    @Test
    fun `test successful registration`() = runBlockingTest {
        // Given
        val mockUser = createMockUser()
        whenever(mockAuthRepository.register(
            TEST_EMAIL,
            TEST_PASSWORD,
            TEST_FIRST_NAME,
            TEST_LAST_NAME
        )).thenReturn(flowOf(Result.success(mockUser)))

        // When
        viewModel.register(TEST_EMAIL, TEST_PASSWORD, TEST_FIRST_NAME, TEST_LAST_NAME)

        // Then
        verify(mockAuthRepository).register(
            TEST_EMAIL,
            TEST_PASSWORD,
            TEST_FIRST_NAME,
            TEST_LAST_NAME
        )
        assert(viewModel.authState.value is AuthState.Authenticated)
    }

    @Test
    fun `test successful logout`() = runBlockingTest {
        // Given
        whenever(mockAuthRepository.logout())
            .thenReturn(Unit)

        // When
        viewModel.logout()

        // Then
        verify(mockAuthRepository).logout()
        assert(viewModel.authState.value is AuthState.NotAuthenticated)
    }

    @Test
    fun `test password validation with cultural requirements`() = runBlockingTest {
        // Test various password scenarios including chai (18) character lengths
        val validPasswords = listOf(
            "Chai18!@Password",  // 18 characters
            "Pass123!@#Word",    // Standard strong password
            "Jerusalem2023!@"    // Location-based password
        )

        val invalidPasswords = listOf(
            "short1!", // Too short
            "nouppercase123!", // No uppercase
            "NOLOWERCASE123!", // No lowercase
            "NoSpecialChars123" // No special chars
        )

        validPasswords.forEach { password ->
            assert(viewModel.validatePassword(password)) { "Password $password should be valid" }
        }

        invalidPasswords.forEach { password ->
            assert(!viewModel.validatePassword(password)) { "Password $password should be invalid" }
        }
    }

    private fun createMockUser(
        email: String = TEST_EMAIL,
        isVerified: Boolean = true,
        isTwoFactorEnabled: Boolean = false
    ) = User(
        id = "test_user_id",
        email = email,
        firstName = TEST_FIRST_NAME,
        lastName = TEST_LAST_NAME,
        phoneNumber = null,
        preferredLanguage = "en",
        preferredCurrency = "USD",
        isEmailVerified = isVerified,
        isTwoFactorEnabled = isTwoFactorEnabled,
        isNotificationsEnabled = true,
        role = "DONOR",
        createdAt = System.currentTimeMillis(),
        updatedAt = System.currentTimeMillis()
    )
}