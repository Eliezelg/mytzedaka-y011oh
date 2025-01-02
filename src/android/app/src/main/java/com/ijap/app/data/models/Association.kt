package com.ijap.app.data.models

import android.os.Parcelable
import kotlinx.parcelize.Parcelize // v1.9.0
import com.google.gson.annotations.SerializedName // v2.10.1
import com.ijap.security.annotations.Encrypted // v1.0.0

/**
 * Data class representing a Jewish charitable association with comprehensive security and validation.
 * Implements Parcelable for efficient data transfer between Android components.
 * Includes field-level encryption for sensitive data and audit logging capabilities.
 */
@Parcelize
data class Association(
    @SerializedName("id")
    val id: String,

    @Encrypted
    @SerializedName("name")
    val name: String,

    @SerializedName("description")
    val description: String,

    @SerializedName("logo_url")
    val logoUrl: String,

    @SerializedName("website_url")
    val websiteUrl: String,

    @Encrypted
    @SerializedName("email")
    val email: String,

    @Encrypted
    @SerializedName("phone")
    val phone: String,

    @SerializedName("address")
    val address: AssociationAddress,

    @SerializedName("country")
    val country: String,

    @Encrypted
    @SerializedName("legal_info")
    val legalInfo: AssociationLegalInfo,

    @Encrypted
    @SerializedName("payment_info")
    val paymentInfo: AssociationPaymentInfo,

    @SerializedName("is_verified")
    val isVerified: Boolean,

    @SerializedName("is_active")
    val isActive: Boolean,

    @SerializedName("supported_currencies")
    val supportedCurrencies: List<String>,

    @SerializedName("created_at")
    val createdAt: Long,

    @SerializedName("updated_at")
    val updatedAt: Long,

    @SerializedName("last_modified_by")
    val lastModifiedBy: String,

    @SerializedName("security_metadata")
    val securityMetadata: Map<String, String>
) : Parcelable

/**
 * Data class representing an association's address with validation support.
 * Implements Parcelable for efficient data transfer.
 */
@Parcelize
data class AssociationAddress(
    @SerializedName("street")
    val street: String,

    @SerializedName("city")
    val city: String,

    @SerializedName("state")
    val state: String,

    @SerializedName("country")
    val country: String,

    @SerializedName("postal_code")
    val postalCode: String,

    @SerializedName("is_verified")
    val isVerified: Boolean,

    @SerializedName("last_verified_at")
    val lastVerifiedAt: Long
) : Parcelable

/**
 * Data class representing an association's legal information with enhanced security.
 * Implements field-level encryption for sensitive data.
 */
@Parcelize
data class AssociationLegalInfo(
    @Encrypted
    @SerializedName("registration_number")
    val registrationNumber: String,

    @Encrypted
    @SerializedName("tax_id")
    val taxId: String,

    @SerializedName("registration_type")
    val registrationType: String,

    @SerializedName("registration_country")
    val registrationCountry: String,

    @SerializedName("registration_date")
    val registrationDate: Long,

    @Encrypted
    @SerializedName("tax_exemption_number")
    val taxExemptionNumber: String,

    @SerializedName("tax_exemption_expiry_date")
    val taxExemptionExpiryDate: Long,

    @SerializedName("compliance_metadata")
    val complianceMetadata: Map<String, String>
) : Parcelable

/**
 * Data class representing an association's payment gateway information with credential security.
 * Implements encryption for sensitive payment gateway credentials.
 */
@Parcelize
data class AssociationPaymentInfo(
    @Encrypted
    @SerializedName("stripe_account_id")
    val stripeAccountId: String,

    @Encrypted
    @SerializedName("tranzilla_terminal_id")
    val tranzillaTerminalId: String,

    @SerializedName("supported_payment_methods")
    val supportedPaymentMethods: List<String>,

    @SerializedName("gateway_settings")
    val gatewaySettings: Map<String, Any>,

    @SerializedName("is_test_mode")
    val isTestMode: Boolean,

    @SerializedName("last_verified_at")
    val lastVerifiedAt: Long,

    @SerializedName("security_metadata")
    val securityMetadata: Map<String, String>
) : Parcelable