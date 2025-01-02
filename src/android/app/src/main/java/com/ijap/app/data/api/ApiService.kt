package com.ijap.app.data.api

import com.ijap.app.data.models.Association
import com.ijap.app.data.models.Campaign
import com.ijap.app.data.models.Donation
import com.ijap.app.utils.SecurityUtils
import io.reactivex.rxjava3.core.Single // v3.1.5
import okhttp3.MultipartBody // v2.9.0
import okhttp3.RequestBody // v2.9.0
import retrofit2.http.* // v2.9.0
import java.io.File

/**
 * Retrofit service interface defining REST API endpoints for the IJAP Android application.
 * Implements comprehensive security measures, cultural support, and documentation automation.
 * Version: 1.0.0
 */
interface ApiService {

    // Association Endpoints

    /**
     * Retrieves list of Jewish charitable associations with filtering and RTL support
     */
    @GET("${ApiEndpoints.ASSOCIATIONS}")
    @Headers("Cache-Control: max-age=900") // 15 minutes cache
    fun getAssociations(
        @Query("page") page: Int,
        @Query("limit") limit: Int,
        @Query("search") search: String? = null,
        @Query("country") country: String? = null,
        @Query("language") language: String? = null,
        @Query("currency") currency: String? = null
    ): Single<List<Association>>

    /**
     * Retrieves detailed association information by ID
     */
    @GET("${ApiEndpoints.ASSOCIATIONS}/{id}")
    fun getAssociationById(
        @Path("id") associationId: String
    ): Single<Association>

    // Campaign Endpoints

    /**
     * Retrieves active campaigns with cultural and religious considerations
     */
    @GET("${ApiEndpoints.CAMPAIGNS}")
    fun getCampaigns(
        @Query("association_id") associationId: String? = null,
        @Query("status") status: String? = null,
        @Query("is_lottery") isLottery: Boolean? = null,
        @Query("is_shabbat_compliant") isShabbatCompliant: Boolean? = null,
        @Query("language") language: String? = null
    ): Single<List<Campaign>>

    /**
     * Creates new campaign with comprehensive validation
     */
    @POST("${ApiEndpoints.CAMPAIGNS}")
    @Headers("Content-Type: application/json")
    fun createCampaign(
        @Body campaign: Campaign
    ): Single<Campaign>

    // Donation Endpoints

    /**
     * Processes secure donation with payment gateway integration
     */
    @POST("${ApiEndpoints.DONATIONS}")
    @Headers("Content-Type: application/json")
    fun createDonation(
        @Body donation: Donation
    ): Single<Donation>

    /**
     * Retrieves donation history with security measures
     */
    @GET("${ApiEndpoints.DONATIONS}")
    fun getDonations(
        @Query("user_id") userId: String? = null,
        @Query("association_id") associationId: String? = null,
        @Query("campaign_id") campaignId: String? = null,
        @Query("status") status: String? = null,
        @Query("start_date") startDate: Long? = null,
        @Query("end_date") endDate: Long? = null
    ): Single<List<Donation>>

    // Document Management

    /**
     * Generates official tax receipt with proper formatting
     */
    @GET("documents/tax-receipt/{donation_id}")
    @Headers("Content-Type: application/pdf")
    fun generateTaxReceipt(
        @Path("donation_id") donationId: String,
        @Query("language") language: String,
        @Query("format") format: String = "pdf"
    ): Single<File>

    /**
     * Uploads and verifies association documents
     */
    @Multipart
    @POST("documents/verify")
    fun verifyDocument(
        @Part document: MultipartBody.Part,
        @Part("metadata") metadata: RequestBody,
        @Part("document_type") documentType: RequestBody
    ): Single<VerificationResult>

    // Payment Methods

    /**
     * Retrieves supported payment methods with gateway-specific details
     */
    @GET("payment-methods")
    fun getPaymentMethods(
        @Query("currency") currency: String,
        @Query("country") country: String
    ): Single<List<PaymentMethod>>

    /**
     * Validates payment method with security checks
     */
    @POST("payment-methods/validate")
    fun validatePaymentMethod(
        @Body paymentMethod: PaymentMethod
    ): Single<ValidationResult>

    // Cultural Support

    /**
     * Retrieves localized content with RTL support
     */
    @GET("localization/{language}")
    fun getLocalizedContent(
        @Path("language") language: String,
        @Query("section") section: String? = null
    ): Single<Map<String, String>>

    /**
     * Validates Shabbat-compliant transaction timing
     */
    @GET("shabbat/validate")
    fun validateShabbatCompliance(
        @Query("timestamp") timestamp: Long,
        @Query("timezone") timezone: String
    ): Single<ShabbatValidation>
}

/**
 * Data class for document verification results
 */
data class VerificationResult(
    val isValid: Boolean,
    val verificationId: String,
    val status: String,
    val details: Map<String, Any>
)

/**
 * Data class for payment method validation results
 */
data class ValidationResult(
    val isValid: Boolean,
    val gatewayResponse: String,
    val validationDetails: Map<String, Any>
)

/**
 * Data class for Shabbat compliance validation
 */
data class ShabbatValidation(
    val isCompliant: Boolean,
    val nextValidTime: Long?,
    val timezone: String,
    val details: Map<String, Any>
)