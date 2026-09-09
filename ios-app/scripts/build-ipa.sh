#!/usr/bin/env bash
# Builds Hub Trade.ipa for App Store / TestFlight. Run on macOS with Xcode installed.
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM_ID="${TEAM_ID:-}"
[ -z "$TEAM_ID" ] && { echo "Usage: TEAM_ID=XXXXXXXXXX bash scripts/build-ipa.sh"; exit 1; }

command -v xcodebuild >/dev/null || { echo "Xcode not found. Install from the Mac App Store."; exit 1; }

[ -d node_modules ] || npm install
[ -d ios ] || npx cap add ios
npx cap sync ios

sed "s/YOUR_TEAM_ID/$TEAM_ID/" ExportOptions.plist > build/ExportOptions.plist 2>/dev/null || { mkdir -p build; sed "s/YOUR_TEAM_ID/$TEAM_ID/" ExportOptions.plist > build/ExportOptions.plist; }

xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/HubTrade.xcarchive \
  DEVELOPMENT_TEAM="$TEAM_ID" PRODUCT_BUNDLE_IDENTIFIER=com.summitofficesolution.tradehub \
  -allowProvisioningUpdates archive

xcodebuild -exportArchive -archivePath build/HubTrade.xcarchive \
  -exportOptionsPlist build/ExportOptions.plist -exportPath build/ipa -allowProvisioningUpdates

echo "Done: $(ls build/ipa/*.ipa)"
echo "Upload: xcrun altool --upload-app -f build/ipa/*.ipa -t ios --apiKey KEY_ID --apiIssuer ISSUER_ID  (or use Transporter app)"
