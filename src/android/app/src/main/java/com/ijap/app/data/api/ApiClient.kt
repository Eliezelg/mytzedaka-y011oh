package com.ijap.app.data.api

import com.ijap.app.data.api.ApiService
import com.ijap.app.utils.Constants
import com.ijap.app.utils.SecurityUtils
import okhttp3.Cache
import okhttp3.CertificatePinner
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.adapter.rxjava3.RxJava3CallAdapterFactory
import retrofit2.converter.gson.GsonConverterFactory
import java.io.File
import java.util.concurrent.TimeUnit
import android.content.Context
import com.google.gson.GsonBuilder
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory
import javax.net.ssl.X509TrustManager

/**
 * Singleton class responsible for creating and configuring the Retrofit instance
 * with enhanced security features and cultural considerations for Jewish users.
 * Version: 1.0.0
 */
class ApiClient private constructor(private val context: Context) {

    private val cache: Cache
    private val certificatePinner: CertificatePinner
    private val apiService: ApiService
    private val secureRandom = SecureRandom()

    init {
        // Initialize cache with proper size and validation
        cache = Cache(
            directory = File(context.cacheDir, "http_cache"),
            maxSize = Constants.CACHE_SIZE_MB * 1024 * 1024L
        )

        // Configure certificate pinning for secure communication
        certificatePinner = CertificatePinner.Builder()
            .add("api.ijap.org", "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=") // Replace with actual certificate hash
            .add("*.ijap.org", "sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=") // Replace with actual certificate hash
            .build()

        // Create and configure Retrofit instance
        val okHttpClient = createOkHttpClient()
        val retrofit = createRetrofit(okHttpClient)
        apiService = retrofit.create(ApiService::class.java)
    }

    /**
     * Creates and configures OkHttpClient with comprehensive security features
     * and cultural considerations for Jewish users.
     */
    private fun createOkHttpClient(): OkHttpClient {
        val trustManagerFactory = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm())
        trustManagerFactory.init(null as java.security.KeyStore?)
        val trustManagers = trustManagerFactory.trustManagers
        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustManagers, secureRandom)

        return OkHttpClient.Builder().apply {
            // Security configurations
            certificatePinner(certificatePinner)
            sslSocketFactory(sslContext.socketFactory, trustManagers[0] as X509TrustManager)
            hostnameVerifier { hostname, session -> 
                hostname.endsWith(".ijap.org") || hostname == "api.ijap.org"
            }

            // Timeouts
            connectTimeout(Constants.REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            readTimeout(Constants.REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)
            writeTimeout(Constants.REQUEST_TIMEOUT_SECONDS, TimeUnit.SECONDS)

            // Cache configuration
            cache(cache)
            addInterceptor(createCacheInterceptor())

            // Add authentication interceptor
            addInterceptor(createAuthInterceptor())

            // Add cultural headers interceptor
            addInterceptor(createCulturalHeadersInterceptor())

            // Add retry interceptor
            addInterceptor(createRetryInterceptor())

            // Add logging interceptor for debug builds
            if (BuildConfig.DEBUG) {
                addInterceptor(HttpLoggingInterceptor().apply {
                    level = HttpLoggingInterceptor.Level.BODY
                })
            }
        }.build()
    }

    /**
     * Creates and configures Retrofit instance with custom type adapters
     * and error handling for Jewish donation platform requirements.
     */
    private fun createRetrofit(okHttpClient: OkHttpClient): Retrofit {
        val gson = GsonBuilder()
            .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ")
            .registerTypeAdapter(Double::class.java, CurrencyTypeAdapter())
            .create()

        return Retrofit.Builder()
            .baseUrl("https://api.ijap.org/${Constants.API_VERSION}/")
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create(gson))
            .addCallAdapterFactory(RxJava3CallAdapterFactory.create())
            .build()
    }

    /**
     * Creates cache control interceptor with proper validation
     * and cultural considerations.
     */
    private fun createCacheInterceptor(): Interceptor {
        return Interceptor { chain ->
            val request = chain.request()
            val response = chain.proceed(request)

            val cacheControl = if (context.isNetworkAvailable()) {
                "public, max-age=${Constants.CACHE_EXPIRY_HOURS * 60 * 60}"
            } else {
                "public, only-if-cached, max-stale=${Constants.CACHE_EXPIRY_HOURS * 60 * 60}"
            }

            response.newBuilder()
                .header("Cache-Control", cacheControl)
                .removeHeader("Pragma")
                .build()
        }
    }

    /**
     * Creates authentication interceptor with JWT token handling
     * and security validation.
     */
    private fun createAuthInterceptor(): Interceptor {
        return Interceptor { chain ->
            val request = chain.request()
            val token = SecurityUtils.getStoredAuthToken(context)

            val authenticatedRequest = if (!token.isNullOrEmpty()) {
                request.newBuilder()
                    .header("Authorization", "Bearer $token")
                    .build()
            } else {
                request
            }

            chain.proceed(authenticatedRequest)
        }
    }

    /**
     * Creates cultural headers interceptor for proper handling
     * of Hebrew language and Jewish cultural requirements.
     */
    private fun createCulturalHeadersInterceptor(): Interceptor {
        return Interceptor { chain ->
            val request = chain.request()
            val languageCode = context.getSharedPreferences(
                Constants.SHARED_PREFS_NAME,
                Context.MODE_PRIVATE
            ).getString(Constants.PREF_LANGUAGE, Constants.DEFAULT_LANGUAGE) ?: Constants.DEFAULT_LANGUAGE

            val culturalRequest = request.newBuilder()
                .header("Accept-Language", languageCode)
                .header("Content-Language", languageCode)
                .header("X-App-Timezone", "Asia/Jerusalem")
                .build()

            chain.proceed(culturalRequest)
        }
    }

    /**
     * Creates retry interceptor with exponential backoff
     * for handling network failures.
     */
    private fun createRetryInterceptor(): Interceptor {
        return Interceptor { chain ->
            var retryCount = 0
            var response = chain.proceed(chain.request())

            while (!response.isSuccessful && retryCount < Constants.MAX_RETRY_ATTEMPTS) {
                retryCount++
                val backoffDelay = Constants.RETRY_DELAY_MS * (1 shl (retryCount - 1))
                Thread.sleep(backoffDelay)
                response.close()
                response = chain.proceed(chain.request())
            }

            response
        }
    }

    /**
     * Provides thread-safe access to API service instance
     * with proper error handling.
     */
    fun getApiService(): ApiService = apiService

    companion object {
        @Volatile
        private var instance: ApiClient? = null

        fun getInstance(context: Context): ApiClient {
            return instance ?: synchronized(this) {
                instance ?: ApiClient(context.applicationContext).also { instance = it }
            }
        }
    }
}