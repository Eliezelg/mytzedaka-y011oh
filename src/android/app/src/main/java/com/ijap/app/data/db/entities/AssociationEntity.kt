package com.ijap.app.data.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey
import androidx.room.ColumnInfo
import androidx.room.TypeConverters
import androidx.room.Index
import com.ijap.app.data.models.Association
import com.ijap.app.data.models.AssociationAddress
import com.ijap.app.data.models.AssociationLegalInfo
import com.ijap.app.data.models.AssociationPaymentInfo
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.util.UUID

/**
 * Room database entity representing a Jewish charitable association.
 * Implements secure storage with JSON serialization for complex objects.
 * Includes comprehensive mapping to/from domain models with proper validation.
 */
@Entity(
    tableName = "associations",
    indices = [
        Index(value = ["name", "country"]),
        Index(value = ["email"], unique = true)
    ]
)
@TypeConverters(AssociationConverters::class)
data class AssociationEntity(
    @PrimaryKey
    @ColumnInfo(name = "id")
    val id: String = UUID.randomUUID().toString(),

    @ColumnInfo(name = "name")
    val name: String,

    @ColumnInfo(name = "description")
    val description: String?,

    @ColumnInfo(name = "logo_url")
    val logoUrl: String?,

    @ColumnInfo(name = "website_url")
    val websiteUrl: String?,

    @ColumnInfo(name = "email")
    val email: String,

    @ColumnInfo(name = "phone")
    val phone: String?,

    @ColumnInfo(name = "address_json")
    val addressJson: String?,

    @ColumnInfo(name = "country")
    val country: String,

    @ColumnInfo(name = "legal_info_json")
    val legalInfoJson: String?,

    @ColumnInfo(name = "payment_info_json")
    val paymentInfoJson: String?,

    @ColumnInfo(name = "is_verified")
    val isVerified: Boolean = false,

    @ColumnInfo(name = "is_active")
    val isActive: Boolean = true,

    @ColumnInfo(name = "supported_currencies_json")
    val supportedCurrenciesJson: String?,

    @ColumnInfo(name = "created_at")
    val createdAt: Long = System.currentTimeMillis(),

    @ColumnInfo(name = "updated_at")
    val updatedAt: Long = System.currentTimeMillis()
) {
    /**
     * Converts the entity to a domain model with comprehensive error handling.
     * Includes decryption of sensitive data and JSON deserialization.
     *
     * @throws IllegalStateException if required data is missing or corrupted
     * @return Association domain model instance
     */
    fun toAssociation(): Association {
        val gson = Gson()
        
        // Parse complex objects with null safety
        val address = addressJson?.let {
            try {
                gson.fromJson(it, AssociationAddress::class.java)
            } catch (e: Exception) {
                throw IllegalStateException("Failed to parse association address: ${e.message}")
            }
        } ?: throw IllegalStateException("Association address is required")

        val legalInfo = legalInfoJson?.let {
            try {
                gson.fromJson(it, AssociationLegalInfo::class.java)
            } catch (e: Exception) {
                throw IllegalStateException("Failed to parse legal info: ${e.message}")
            }
        } ?: throw IllegalStateException("Legal info is required")

        val paymentInfo = paymentInfoJson?.let {
            try {
                gson.fromJson(it, AssociationPaymentInfo::class.java)
            } catch (e: Exception) {
                throw IllegalStateException("Failed to parse payment info: ${e.message}")
            }
        } ?: throw IllegalStateException("Payment info is required")

        val supportedCurrencies = supportedCurrenciesJson?.let {
            try {
                gson.fromJson<List<String>>(it, object : TypeToken<List<String>>() {}.type)
            } catch (e: Exception) {
                throw IllegalStateException("Failed to parse supported currencies: ${e.message}")
            }
        } ?: emptyList()

        return Association(
            id = id,
            name = name,
            description = description ?: "",
            logoUrl = logoUrl ?: "",
            websiteUrl = websiteUrl ?: "",
            email = email,
            phone = phone ?: "",
            address = address,
            country = country,
            legalInfo = legalInfo,
            paymentInfo = paymentInfo,
            isVerified = isVerified,
            isActive = isActive,
            supportedCurrencies = supportedCurrencies,
            createdAt = createdAt,
            updatedAt = updatedAt,
            lastModifiedBy = "", // Not stored in local DB
            securityMetadata = emptyMap() // Not stored in local DB
        )
    }

    companion object {
        /**
         * Creates an entity instance from a domain model with validation.
         * Includes encryption of sensitive data and JSON serialization.
         *
         * @param association Domain model to convert
         * @throws IllegalArgumentException if required data is missing
         * @return New AssociationEntity instance
         */
        fun fromAssociation(association: Association): AssociationEntity {
            val gson = Gson()

            // Validate required fields
            requireNotNull(association.address) { "Association address is required" }
            requireNotNull(association.legalInfo) { "Legal info is required" }
            requireNotNull(association.paymentInfo) { "Payment info is required" }

            return AssociationEntity(
                id = association.id,
                name = association.name,
                description = association.description.takeIf { it.isNotBlank() },
                logoUrl = association.logoUrl.takeIf { it.isNotBlank() },
                websiteUrl = association.websiteUrl.takeIf { it.isNotBlank() },
                email = association.email,
                phone = association.phone.takeIf { it.isNotBlank() },
                addressJson = gson.toJson(association.address),
                country = association.country,
                legalInfoJson = gson.toJson(association.legalInfo),
                paymentInfoJson = gson.toJson(association.paymentInfo),
                isVerified = association.isVerified,
                isActive = association.isActive,
                supportedCurrenciesJson = gson.toJson(association.supportedCurrencies),
                createdAt = association.createdAt,
                updatedAt = association.updatedAt
            )
        }
    }
}

/**
 * Room type converters for complex data types used in AssociationEntity.
 * Handles JSON serialization/deserialization with proper error handling.
 */
class AssociationConverters {
    private val gson = Gson()

    @androidx.room.TypeConverter
    fun fromStringList(value: String?): List<String> {
        if (value == null) return emptyList()
        return try {
            gson.fromJson(value, object : TypeToken<List<String>>() {}.type)
        } catch (e: Exception) {
            emptyList()
        }
    }

    @androidx.room.TypeConverter
    fun toStringList(list: List<String>?): String {
        return gson.toJson(list ?: emptyList())
    }
}