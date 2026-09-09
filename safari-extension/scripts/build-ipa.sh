#!/usr/bin/env bash
# Builds the iOS .ipa for the Hub Trade Safari Web Extension. Run on macOS with Xcode.
set -euo pipefail
cd "$(dirname "$0")/.."

TEAM_ID="${TEAM_ID:-}"
[ -z "$TEAM_ID" ] && { echo "Usage: TEAM_ID=XXXXXXXXXX bash scripts/build-ipa.sh"; exit 1; }
BUNDLE_ID="com.summitofficesolution.tradehub.safari"

if [ ! -d "xcode/Hub Trade" ]; then
  xcrun safari-web-extension-converter . --project-location xcode --app-name "Hub Trade" \
    --bundle-identifier "$BUNDLE_ID" --ios-only --no-open --force --copy-resources
  bash scripts/install-appicon.sh "xcode/Hub Trade" || true
fi

mkdir -p build
cat > build/ExportOptions.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>teamID</key><string>$TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>destination</key><string>export</string>
</dict></plist>
EOF

xcodebuild -project "xcode/Hub Trade/Hub Trade.xcodeproj" -scheme "Hub Trade (iOS)" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath build/HubTradeExt.xcarchive \
  DEVELOPMENT_TEAM="$TEAM_ID" -allowProvisioningUpdates archive

xcodebuild -exportArchive -archivePath build/HubTradeExt.xcarchive \
  -exportOptionsPlist build/ExportOptions.plist -exportPath build/ipa -allowProvisioningUpdates

echo "Done: $(ls build/ipa/*.ipa)"
