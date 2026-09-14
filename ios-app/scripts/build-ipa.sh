#!/usr/bin/env bash
# Builds Hub Trade.ipa for App Store / TestFlight. Requires macOS + Xcode 26+ + Node 22+.
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM_ID="${TEAM_ID:-}"
[ -z "$TEAM_ID" ] && { echo "Usage: TEAM_ID=XXXXXXXXXX bash scripts/build-ipa.sh"; exit 1; }
command -v xcodebuild >/dev/null || { echo "Xcode not found. Install Xcode 26+ from the Mac App Store."; exit 1; }

[ -d node_modules ] || npm install
npx cap sync ios

mkdir -p build
sed "s/YOUR_TEAM_ID/$TEAM_ID/" ExportOptions.plist > build/ExportOptions.plist

xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/HubTrade.xcarchive \
  DEVELOPMENT_TEAM="$TEAM_ID" CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates -skipPackagePluginValidation archive

xcodebuild -exportArchive -archivePath build/HubTrade.xcarchive \
  -exportOptionsPlist build/ExportOptions.plist -exportPath build/ipa -allowProvisioningUpdates

echo "Done: $(ls build/ipa/*.ipa)"
echo "Upload with the Transporter app, or: xcrun altool --upload-app -f build/ipa/*.ipa -t ios --apiKey KEY_ID --apiIssuer ISSUER_ID"
