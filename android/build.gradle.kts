plugins {
    // 8.9.1+ required — androidx.browser resolves transitively to a version that
    // needs compileSdk 36 (see android/app/build.gradle.kts).
    id("com.android.application") version "8.9.3" apply false
}
