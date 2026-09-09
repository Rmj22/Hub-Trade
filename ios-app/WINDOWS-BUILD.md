# Building the .ipa from Windows (no Mac needed)

The `.github/workflows/build-ios.yml` workflow runs on a free GitHub-hosted Mac and produces the `.ipa`
(and optionally uploads it straight to TestFlight).

## 1. Push the code to GitHub
Use **Save to GitHub** in the Emergent chat bar. Private repos get 2,000 free Actions minutes/month
(macOS minutes count 10x, so ~200 Mac-minutes ≈ 10–15 builds; public repos are unlimited).

## 2. Create an App Store Connect API key
appstoreconnect.apple.com → **Users and Access → Integrations → App Store Connect API → +**
- Name: `GitHub CI`, Access: **App Manager**
- Download the `.p8` file (only downloadable once). Note the **Key ID** and **Issuer ID** shown on that page.

## 3. Add repository secrets
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**

| Secret | Value |
|---|---|
| `APPLE_TEAM_ID` | 10-char Team ID (developer.apple.com → Membership) |
| `ASC_KEY_ID` | Key ID from step 2 |
| `ASC_ISSUER_ID` | Issuer ID from step 2 |
| `ASC_API_KEY_P8` | Full contents of the `.p8` file (open in Notepad, copy everything incl. BEGIN/END lines) |
| `HUB_TRADE_URL` | Your live Hub Trade URL, e.g. `https://yourdomain.com` |

## 4. Register the apps once
- developer.apple.com → **Identifiers → +** → App IDs:
  - `com.summitofficesolution.tradehub`
  - `com.summitofficesolution.tradehub.safari`
  - `com.summitofficesolution.tradehub.safari.Extension`
- appstoreconnect.apple.com → **Apps → +** → create an app record for each of the first two Bundle IDs.

(Certificates and provisioning profiles are created automatically by the workflow via cloud signing.)

## 5. Run the build
GitHub repo → **Actions → Build iOS IPA → Run workflow** → choose `app`, `extension`, or `both`.
- The `.ipa` appears under the run's **Artifacts** (downloadable to Windows).
- With "Upload to TestFlight" checked it's also pushed to App Store Connect; it shows up in TestFlight in ~10 minutes.

## If it fails
Open the failed step, copy the line starting with `error:` and paste it in the chat.
