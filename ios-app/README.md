# Hub Trade — iOS App (.ipa)

Native iOS wrapper built with **Capacitor 8.5.2** (Swift Package Manager, no CocoaPods).
Requirements: **Xcode 26+**, **Node 22+**, iOS deployment target **16.0**. Bundle ID: `com.summitofficesolution.tradehub`.
The Xcode project is committed at `ios/App/App.xcodeproj` — open it directly (no `.xcworkspace`).

## One-time setup (on a Mac)
1. Install Xcode 26+ from the Mac App Store, open it once, and sign in: Xcode → Settings → Accounts → add your Apple ID.
2. Install Node 22+ (`brew install node`).
3. Edit `capacitor.config.json` → set `server.url` to your deployed Hub Trade URL (https).
4. The App Store Connect app record for `com.summitofficesolution.tradehub` must already exist.

## Build the .ipa
```bash
cd ios-app
TEAM_ID=XXXXXXXXXX bash scripts/build-ipa.sh
```
Your Team ID is at developer.apple.com → Membership. Output: `build/ipa/App.ipa`.

No Mac? See `WINDOWS-BUILD.md` — GitHub Actions builds it on a cloud Mac.

## Upload to TestFlight / App Store
- Easiest: open the **Transporter** app (Mac App Store), drag the `.ipa` in, click Deliver.
- Or: `xcrun altool --upload-app -f build/ipa/App.ipa -t ios --apiKey KEY_ID --apiIssuer ISSUER_ID`

## Bumping the version
Edit `ios/App/App.xcodeproj/project.pbxproj`: `MARKETING_VERSION` (user-visible, e.g. 1.0.1) and `CURRENT_PROJECT_VERSION` (build number — must increase on every upload).

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
| `ITMS-90xxx` on upload | Bump `CURRENT_PROJECT_VERSION` in `project.pbxproj` for each upload |
| Package resolution failed | Xcode → File → Packages → Reset Package Caches |

