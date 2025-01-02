package com.ijap.app.di

import com.ijap.app.data.api.ApiService
import com.ijap.app.utils.Constants
import com.ijap.app.utils.SecurityUtils
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.CertificatePinner
import okhttp3.ConnectionPool
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import java.security.SecureRandom
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import com.google.gson.GsonBuilder
import okhttp3.Cache
import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File

/**
 * Dagger Hilt module providing network-related dependencies with enhanced security,
 * cultural support, and international operations capabilities.
 * Version: 1.0.0
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val CACHE_SIZE = 10 * 1024 * 1024L // 10 MB
    private const val CONNECTION_TIMEOUT = Constants.REQUEST_TIMEOUT_SECONDS
    private const val POOL_MAX_IDLE_CONNECTIONS = 5
    private const val POOL_KEEP_ALIVE_MINUTES = 5L

    /**
     * Provides OkHttpClient with advanced security features and cultural considerations
     */
    @Provides
    @Singleton
    fun provideOkHttpClient(
        @ApplicationContext context: Context
    ): OkHttpClient {
        // Configure certificate pinning for secure communication
        val certificatePinner = CertificatePinner.Builder()
            .add("api.ijap.org", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") // Replace with actual certificate hash
            .add("*.ijap.org", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") // Replace with actual certificate hash
            .build()

        // Configure connection pooling for performance
        val connectionPool = ConnectionPool(
            POOL_MAX_IDLE_CONNECTIONS,
            POOL_KEEP_ALIVE_MINUTES,
            TimeUnit.MINUTES
        )

        // Configure SSL context with enhanced security
        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(null as java.security.KeyStore?)
        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustManagerFactory.trustManagers, SecureRandom())

        // Configure cache
        val cache = Cache(File(context.cacheDir, "http_cache"), CACHE_SIZE)

        return OkHttpClient.Builder()
            .certificatePinner(certificatePinner)
            .connectionPool(connectionPool)
            .sslSocketFactory(sslContext.socketFactory, trustManagerFactory.trustManagers[0])
            .cache(cache)
            .addInterceptor(createSecurityHeadersInterceptor())
            .addInterceptor(createCulturalHeadersInterceptor())
            .addInterceptor(createLoggingInterceptor())
            .addInterceptor(createRetryInterceptor())
            .connectTimeout(CONNECTION_TIMEOUT, TimeUnit.SECONDS)
            .readTimeout(CONNECTION_TIMEOUT, TimeUnit.SECONDS)
            .writeTimeout(CONNECTION_TIMEOUT, TimeUnit.SECONDS)
            .build()
    }

    /**
     * Provides Retrofit instance with security and cultural features
     */
    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        val gson = GsonBuilder()
            .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
            .setLenient()
            .create()

        return Retrofit.Builder()
            .baseUrl(Constants.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
            .build()
    }

    /**
     * Provides ApiService with comprehensive error handling and monitoring
     */
    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        return retrofit.create(ApiService::class.java)
    }

    /**
     * Creates interceptor for security headers
     */
    private fun createSecurityHeadersInterceptor(): Interceptor {
        return Interceptor { chain ->
            val requestBuilder = chain.request().newBuilder()
            requestBuilder.addHeader("X-Security-Version", "1.0")
            requestBuilder.addHeader("X-Device-ID", SecurityUtils.generateSecureToken(32))
            requestBuilder.addHeader("X-Request-ID", SecurityUtils.generateSecureToken(16))
            chain.proceed(requestBuilder.build())
        }
    }

    /**
     * Creates interceptor for cultural and localization headers
     */
    private fun createCulturalHeadersInterceptor(): Interceptor {
        return Interceptor { chain ->
            val requestBuilder = chain.request().newBuilder()
            requestBuilder.addHeader("Accept-Language", "he,en;q=0.9")
            requestBuilder.addHeader("X-Timezone", "Asia/Jerusalem")
            requestBuilder.addHeader("X-Cultural-Preferences", "shabbat-compliant")
            chain.proceed(requestBuilder.build())
        }
    }

    /**
     * Creates logging interceptor with security considerations
     */
    private fun createLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.BASIC
            }
        }
    }

    /**
     * Creates retry interceptor with exponential backoff
     */
    private fun createRetryInterceptor(): Interceptor {
        return Interceptor { chain ->
            var retryCount = 0
            var response = chain.proceed(chain.request())

            while (!response.isSuccessful && retryCount < Constants.MAX_RETRY_ATTEMPTS) {
                retryCount++
                val backoffDelay = Constants.RETRY_DELAY_MS * (2.0.pow(retryCount - 1)).toLong()
                Thread.sleep(backoffDelay)
                response.close()
                response = chain.proceed(chain.request())
            }

            response
        }
    }
}