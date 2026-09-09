# Hub Trade — iOS App (.ipa)

An `.ipa` must be built on a Mac with Xcode 15+ and your Apple Developer account. This folder contains everything needed so it is a single command.

## One-time setup (on your Mac)
1. Install Xcode from the Mac App Store, open it once, and sign in: Xcode → Settings → Accounts → add your Apple ID.
2. Install Node 18+ (`brew install node`) and CocoaPods (`sudo gem install cocoapods`).
3. Edit `capacitor.config.json` → set `server.url` to your deployed Hub Trade URL (https).
4. In App Store Connect create an app with Bundle ID `com.summitofficesolution.tradehub`.

## Build the .ipa
```bash
cd ios-app
TEAM_ID=XXXXXXXXXX bash scripts/build-ipa.sh
```
Your Team ID is at developer.apple.com → Membership. Output: `build/ipa/App.ipa`.

## Upload to TestFlight / App Store
- Easiest: open the **Transporter** app (Mac App Store), drag the `.ipa` in, click Deliver.
- Or: `xcrun altool --upload-app -f build/ipa/App.ipa -t ios --apiKey KEY_ID --apiIssuer ISSUER_ID`

## Safari Extension .ipa
```bash
cd safari-extension
TEAM_ID=XXXXXXXXXX bash scripts/build-ipa.sh
```
Bundle ID `com.summitofficesolution.tradehub.safari` (extension target is auto-nested as `.Extension`). Output: `safari-extension/build/ipa/Hub Trade.ipa`.

## Common errors
| Error | Fix |
|---|---|
| `No signing certificate` | Xcode → Settings → Accounts → Manage Certificates → + Apple Distribution |
| `No profiles for bundle id` | Register the Bundle ID at developer.apple.com → Identifiers; `-allowProvisioningUpdates` then creates the profile |
| `AppIcon missing` | Run `safari-extension/scripts/install-appicon.sh` (extension) or add 1024×1024 icon in `ios/App/App/Assets.xcassets/AppIcon.appiconset` |
| `ITMS-90xxx` on upload | Bump `CFBundleVersion` in `ios/App/App/Info.plist` for each upload |
