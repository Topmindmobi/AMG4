plugins {
    id("com.android.application")
}

android {
    namespace = "ai.amgstores.app"
    // androidx.browser resolves transitively to 1.9.0-alpha04 via androidbrowserhelper,
    // which requires compileSdk 36+ and AGP 8.9.1+ (see android/build.gradle.kts).
    compileSdk = 36

    defaultConfig {
        applicationId = "ai.amgstores.app"
        minSdk = 21
        targetSdk = 36
        // Bump both on every release. versionName is what shoppers see.
        versionCode = 3
        versionName = "1.0.2"
    }

    signingConfigs {
        create("release") {
            val storeFilePath = System.getenv("ANDROID_KEYSTORE_PATH")
            if (storeFilePath != null) {
                storeFile = file(storeFilePath)
                storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
                keyAlias = System.getenv("ANDROID_KEY_ALIAS")
                keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (System.getenv("ANDROID_KEYSTORE_PATH") != null) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

dependencies {
    // Pulls in androidx.browser transitively at whatever version it requires —
    // an explicit lower pin here doesn't win (Gradle takes the highest requested
    // version among all dependencies) and just misleads about what's actually used.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.2")
    implementation("androidx.appcompat:appcompat:1.7.0")
}
