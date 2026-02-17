# Android Native Build Setup Guide

Follow these steps to build the APK and fix the HTTP cleartext issue.

## 1. Install Capacitor Dependencies
Run this in your terminal:
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "IPTV Stream" com.abdo.iptvstream --web-dir=dist
```

## 2. Build the Web App
```bash
npm run build
```

## 3. Add Android Platform
```bash
npx cap add android
```

## 4. Fix Cleartext Traffic (CRITICAL!)
Open the file: `android/app/src/main/AndroidManifest.xml`

Find the `<application>` tag and add `android:usesCleartextTraffic="true"` like this:

```xml
<application
    android:allowBackup="true"
    android:icon="@mipmap/ic_launcher"
    android:label="@string/app_name"
    android:roundIcon="@mipmap/ic_launcher_round"
    android:supportsRtl="true"
    android:theme="@style/AppTheme"
    android:usesCleartextTraffic="true">  <!-- ADD THIS LINE HERE -->
```

## 5. Sync and Open Android Studio
```bash
npx cap sync
npx cap open android
```

## 6. Build APK
In Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**
