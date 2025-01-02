# IJAP Android Application ProGuard Rules
# Version: 1.0

#-------------------------------------------
# General Application Rules
#-------------------------------------------
-optimizationpasses 5
-dontusemixedcaseclassnames
-dontskipnonpubliclibraryclasses
-dontpreverify
-verbose
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
-keepattributes *Annotation*,EnclosingMethod,Signature,Exceptions,InnerClasses

# Keep source file names, line numbers for stack traces
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

#-------------------------------------------
# IJAP Application Specific Rules
#-------------------------------------------
# Keep all model classes
-keep class com.ijap.app.data.models.** { *; }
-keep class com.ijap.app.data.api.** { *; }
-keep class com.ijap.app.data.db.entities.** { *; }

# Keep all security related classes
-keep class com.ijap.app.security.crypto.** { *; }
-keep class com.ijap.app.biometric.** { *; }

# Payment processing classes
-keep class com.ijap.app.payment.** { *; }
-keepclassmembers class com.ijap.app.payment.** {
    private <fields>;
    public <methods>;
}

#-------------------------------------------
# Payment Gateway Integration Rules
#-------------------------------------------
# Stripe SDK Rules
-keep class com.stripe.android.** { *; }
-keep class com.stripe.android.model.** { *; }
-keepclassmembers class * { 
    @com.stripe.android.annotations.* *; 
}

# Tranzilla SDK Rules
-keep class com.tranzilla.sdk.** { *; }
-keepclassmembers class * {
    @com.tranzilla.annotations.* *; 
}

#-------------------------------------------
# Security & Cryptography Rules
#-------------------------------------------
# Biometric authentication
-keep class androidx.biometric.** { *; }

# Cryptography
-keep class javax.crypto.** { *; }
-keep class javax.security.** { *; }
-keep class androidx.security.crypto.** { *; }
-keep class com.google.crypto.tink.** { *; }

# Keep all enum values
-keepclassmembers class * extends java.lang.Enum {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

#-------------------------------------------
# Firebase Configuration Protection
#-------------------------------------------
# Protect Firebase configuration
-keepclassmembers class **.R$* {
    public static <fields>;
}
-keep class com.google.firebase.** { *; }
-keep class com.google.android.gms.** { *; }

#-------------------------------------------
# Serialization & Parcelable Rules
#-------------------------------------------
# Keep Serializable classes
-keepclassmembers class * implements java.io.Serializable {
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# Keep Parcelable classes
-keep class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator *;
}

#-------------------------------------------
# Retrofit & Network Rules
#-------------------------------------------
# Retrofit
-keepattributes Signature
-keepattributes Exceptions
-keep class retrofit2.** { *; }
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

#-------------------------------------------
# Kotlin Specific Rules
#-------------------------------------------
# Keep Kotlin Coroutines
-keepclassmembernames class kotlinx.** {
    volatile <fields>;
}
-keepclassmembers class kotlin.Metadata {
    public <methods>;
}

#-------------------------------------------
# Debugging Rules for Release Builds
#-------------------------------------------
# Remove Android logging
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
    public static *** w(...);
    public static *** e(...);
}

# Keep Timber logging only for crash reporting
-keep class timber.log.Timber { *; }
-keep class timber.log.Timber$Tree { *; }

#-------------------------------------------
# PCI DSS Compliance Rules
#-------------------------------------------
# Protect payment card data
-keep class com.ijap.app.payment.models.CardData {
    private <fields>;
    <init>();
}
-keepclassmembers class com.ijap.app.payment.security.** {
    private <fields>;
}

# Secure key storage
-keep class com.ijap.app.security.keystore.** { *; }