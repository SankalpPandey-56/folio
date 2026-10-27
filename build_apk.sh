#!/usr/bin/env bash
# Folio - Android APK Automated Build Script
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "==> Syncing web assets to Android WebView..."
cp public/index.html android/app/src/main/assets/index.html
cp -R public/css/ android/app/src/main/assets/css/
cp -R public/js/ android/app/src/main/assets/js/
cp public/manifest.json android/app/src/main/assets/manifest.json
cp public/sw.js android/app/src/main/assets/sw.js
cp -R public/assets/ android/app/src/main/assets/assets/

echo "==> Building debug APK with Gradle..."
cd "$SCRIPT_DIR/android"
./gradlew assembleDebug

echo "==> Copying APK binaries..."
cp app/build/outputs/apk/debug/app-debug.apk "$SCRIPT_DIR/Folio.apk"
cp app/build/outputs/apk/debug/app-debug.apk "$SCRIPT_DIR/public/Folio.apk"

echo "✓ Build successful: Folio.apk ($(ls -lh "$SCRIPT_DIR/Folio.apk" | awk '{print $5}'))"
