
## 2026-06 iOS .ipa packaging
- Added /app/ios-app (Capacitor wrapper, bundle com.summitofficesolution.tradehub) with scripts/build-ipa.sh + README.
- Added /app/safari-extension/scripts/build-ipa.sh for the extension iOS .ipa (com.summitofficesolution.tradehub.safari).
- .ipa must be built on macOS/Xcode; cannot be produced in this environment. User must set TEAM_ID and server.url.
