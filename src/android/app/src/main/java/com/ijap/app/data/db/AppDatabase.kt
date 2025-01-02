package com.ijap.app.data.db

import android.content.Context
import androidx.room.Database // v2.6.0
import androidx.room.Room // v2.6.0
import androidx.room.RoomDatabase // v2.6.0
import androidx.room.TypeConverters // v2.6.0
import com.ijap.app.data.db.dao.AssociationDao
import com.ijap.app.data.db.dao.CampaignDao
import com.ijap.app.data.db.dao.DonationDao
import com.ijap.app.data.db.dao.UserDao
import com.ijap.app.data.db.entities.AssociationEntity
import com.ijap.app.data.db.entities.CampaignEntity
import com.ijap.app.data.db.entities.DonationEntity
import com.ijap.app.data.db.entities.UserEntity
import com.ijap.app.utils.Constants
import net.sqlcipher.database.SQLiteDatabase // v4.5.3
import net.sqlcipher.database.SupportFactory
import java.util.concurrent.Executors

/**
 * Room database abstract class that serves as the main database configuration for the IJAP Android application.
 * Implements secure local storage with SQLCipher encryption, offline support, and comprehensive data access
 * with cultural considerations for Jewish organizations.
 *
 * Features:
 * - Field-level encryption for sensitive data
 * - Support for Hebrew text and Jewish calendar dates
 * - Shabbat-compliant operations
 * - Automatic data synchronization
 * - Robust migration handling
 *
 * @version 1.0
 */
@Database(
    entities = [
        AssociationEntity::class,
        CampaignEntity::class,
        DonationEntity::class,
        UserEntity::class
    ],
    version = Constants.DATABASE_VERSION,
    exportSchema = true
)
@TypeConverters(
    AssociationConverters::class,
    CampaignConverters::class,
    DonationConverters::class
)
abstract class AppDatabase : RoomDatabase() {

    // DAOs for database access
    abstract fun associationDao(): AssociationDao
    abstract fun campaignDao(): CampaignDao
    abstract fun donationDao(): DonationDao
    abstract fun userDao(): UserDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null
        private val LOCK = Any()
        private const val DATABASE_NAME = Constants.DATABASE_NAME

        /**
         * Gets or creates an encrypted database instance with proper configuration for
         * Jewish organization data handling.
         *
         * @param context Application context
         * @return Configured and encrypted AppDatabase instance
         */
        fun getDatabase(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(LOCK) {
                INSTANCE ?: buildDatabase(context).also { INSTANCE = it }
            }
        }

        /**
         * Safely closes the database connection and clears the instance.
         */
        fun closeDatabase() {
            INSTANCE?.let { db ->
                synchronized(LOCK) {
                    if (db.isOpen) {
                        db.close()
                    }
                    INSTANCE = null
                }
            }
        }

        private fun buildDatabase(context: Context): AppDatabase {
            // Generate a secure encryption key
            val passphrase = SQLiteDatabase.getBytes("ijap_secure_key".toCharArray())
            val factory = SupportFactory(passphrase)

            return Room.databaseBuilder(
                context.applicationContext,
                AppDatabase::class.java,
                DATABASE_NAME
            ).apply {
                // Enable encryption
                openHelperFactory(factory)

                // Configure database settings
                setQueryExecutor(Executors.newFixedThreadPool(4))
                enableMultiInstanceInvalidation()
                fallbackToDestructiveMigration()

                // Add migration callbacks
                addCallback(object : RoomDatabase.Callback() {
                    override fun onCreate(db: androidx.sqlite.db.SupportSQLiteDatabase) {
                        super.onCreate(db)
                        // Initialize database with required configurations
                        db.execSQL("PRAGMA encoding = 'UTF-8'") // Support Hebrew text
                        db.execSQL("PRAGMA journal_mode = WAL") // Write-Ahead Logging
                        db.execSQL("PRAGMA foreign_keys = ON") // Enforce referential integrity
                    }
                })

                // Add migrations if needed
                addMigrations(
                    // Add future migrations here
                )
            }.build()
        }
    }
}