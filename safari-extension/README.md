# Hub Trade Companion — Safari Web Extension

A companion Safari (and Chromium/Firefox-compatible) Web Extension for **Hub Trade**. It gives quick links into the app, lets you capture job notes from any page (toolbar popup, right-click a selection, or an on-page button), and shows a badge with your pending note count.

## File structure

```
safari-extension/
├── manifest.json                 # MV3 manifest (permissions, action, background, content scripts, icons)
├── background/
│   └── service-worker.js         # MV3 background service worker (context menu, notes, badge, messaging)
├── content/
│   ├── content.js                # Injected on Hub Trade pages: floating "Quick note" button + toasts
│   └── content.css               # Styles for the injected UI
├── popup/
│   ├── popup.html                # Toolbar popup markup
│   ├── popup.css                 # Popup styles (dark / volt theme)
│   └── popup.js                  # Popup logic (quick links + notes CRUD via messaging)
└── icons/
    ├── icon-16.png  icon-32.png  icon-48.png  icon-128.png   # WebExtension icons (manifest)
    ├── icon-256.png icon-512.png                             # store / high-res
    └── Icon.png                                              # 1024×1024 — for the Xcode APP WRAPPER
```

All JS/CSS referenced by `manifest.json`:
- `background/service-worker.js`
- `content/content.js`, `content/content.css`
- popup assets are referenced from `popup/popup.html` (`popup.css`, `popup.js`)
- icons: `icons/icon-16|32|48|128.png`

---

## ⚠️ Fixing: "Build input file cannot be found: .../Hub Trade/Resources/Icon.png"

This error comes from the **Xcode app wrapper** that `safari-web-extension-converter` generates — not from the extension bundle. The generated App target references an app icon named `Icon.png` in its `Resources`, but the file is missing. **This is unrelated to domains** — no custom domain, signing, or developer account is required to fix it.

**Recommended — one command (no custom domain, fully offline):**
```bash
# run from inside safari-extension/, pass your generated Xcode project's root folder
bash scripts/fix-icon.sh /path/to/generated/xcode/project-root "Hub Trade"
```
The script copies the generated `icons/Icon.png` into `Hub Trade/Resources/Icon.png` (and any other `Resources/` folder that references it). Then in Xcode: **Product ▸ Clean Build Folder (⇧⌘K) ▸ Build (⌘B)**.

**Optional — give the app a real icon set (also domain-free):** drag `xcode-appicon/Assets.xcassets/AppIcon.appiconset` into your app target's `Assets.xcassets` (replace the empty `AppIcon`). This removes the need for the loose `Icon.png` entirely.

**Manual alternatives (pick one):**

1. **Add the provided icon** — copy `icons/Icon.png` (1024×1024, generated here) into the missing location and add it to the target:
   ```bash
   cp safari-extension/icons/Icon.png "Hub Trade/Hub Trade/Resources/Icon.png"
   ```
   Then in Xcode: right-click the **Resources** group → *Add Files to "Hub Trade"…* → select `Icon.png` → ensure **Target Membership** includes the **Hub Trade** app target. Clean build folder (⇧⌘K) and rebuild.

2. **Or remove the stale reference** — In Xcode, select the app target → **Build Phases → Copy Bundle Resources**, find the red (missing) `Icon.png`, and delete that entry. Also delete any red `Icon.png` reference in the Project Navigator. Rebuild.

> Tip: If you'd rather use a proper asset catalog, drag the PNGs into `Assets.xcassets → AppIcon` for the app target and set the app icon there, then remove the loose `Icon.png` reference.

---

---

## ⚠️ "Exporting for App Store Distribution failed. Please download the logs artifact"

This generic Organizer message hides the real cause, which is written in the export log. **Read the real error first:**
- Xcode **Organizer ▸ Distribute App** failure ▸ **Show Logs** (gear/▸ icon) ▸ open **`IDEDistribution.standard.log`** and copy the lines after `error:`.

For a freshly converted Safari Web Extension, the cause is almost always one of these three — fix in order:

**1) App icon not set (`CFBundleIconName` missing).** Most common. Install the provided icon set:
```bash
bash scripts/install-appicon.sh /path/to/generated/xcode/project-root "Hub Trade"
```
Then in Xcode (app target): **Build Settings ▸ "Asset Catalog App Icon Set Name" = `AppIcon`**, and **General ▸ App Icon Source = `AppIcon`**. Clean Build Folder → re-Archive.

**2) Extension bundle ID is not a child of the app bundle ID.** App Store upload REQUIRES the extension's bundle identifier to be prefixed by the app's. Example:
- App: `com.yourcompany.hubtrade`
- Extension: `com.yourcompany.hubtrade.Extension`  ✅ (must start with the app's ID)

Set both under each target ▸ **Signing & Capabilities ▸ Bundle Identifier**. They must be **unique** and **registered** (Automatic signing with your Team will register them).

**3) No matching App Store Connect record / signing.** Before you can export for App Store:
- In **App Store Connect**, create an app record using the **app's** bundle ID (`com.yourcompany.hubtrade`).
- In Xcode, select your **Team** on both targets and use **Automatic** signing (needs a **paid** Apple Developer Program membership — the free account cannot export for App Store).
- Ensure the archive's **version (CFBundleShortVersionString)** and **build (CFBundleVersion)** are set and the build number is higher than any previously uploaded.

**Other frequent log errors & fixes**
- `Missing Info.plist value CFBundleIconName` → do step 1.
- `No profiles for '…' were found` / `requires a provisioning profile` → step 3 (select Team + Automatic signing).
- `App Store Connect Operation Error … bundle identifier … already exists` → the app record uses a different ID; match it or create the record with your ID.
- `Invalid Bundle. The bundle at '…appex' … CFBundleVersion must match the app` → make the extension's version/build equal the app's.
- `Asset validation failed … icon … alpha channel` → not applicable here (all provided icons are opaque RGB).

> Tip: paste the exact `error:` line from `IDEDistribution.standard.log` and the app + extension bundle IDs, and the fix is usually one of the above.

---

## Build / run in Safari (macOS)

1. Convert the extension to an Xcode project:
   ```bash
   xcrun safari-web-extension-converter /path/to/safari-extension --project-location ./HubTradeExtension --app-name "Hub Trade"
   ```
2. Open the generated `.xcodeproj` in Xcode.
3. Apply the **Icon.png fix** above if you hit the build error.
4. Select the app scheme and **Run** (⌘R). The container app launches.
5. Enable it: **Safari → Settings → Extensions → Hub Trade Companion** (turn on).
   - For unsigned local builds: **Safari → Settings → Advanced → “Show features for web developers”**, then **Develop → Allow Unsigned Extensions**.
6. Grant the extension access to `trade-hub-910.emergent.host` when prompted.

## Test in Chrome/Edge (quick sanity check)
`chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the `safari-extension/` folder.

## Notes
- The extension is **self-contained**: notes are stored locally via `storage.local`. It requires **no backend changes** and does not send your data anywhere.
- Update the domains in `manifest.json` (`host_permissions` + `content_scripts.matches`) and the default URL in `background/service-worker.js` / `popup/popup.js` if your production domain changes.
