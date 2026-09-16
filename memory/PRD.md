
## 2026-06 iOS .ipa packaging
- Added /app/ios-app (Capacitor wrapper, bundle com.summitofficesolution.tradehub) with scripts/build-ipa.sh + README.
- Added /app/safari-extension/scripts/build-ipa.sh for the extension iOS .ipa (com.summitofficesolution.tradehub.safari).
- .ipa must be built on macOS/Xcode; cannot be produced in this environment. User must set TEAM_ID and server.url.

## 2026-06 Deployment health check
- Removed .env ignores from /app/.gitignore (was a deploy blocker).
- Added Mongo projections to dashboard, weekly_report, job_cost in server.py. Deployment agent: PASS/WARN (deployable).

## 2026-06 Code review fixes
- Fixed hook deps (AuthContext, Dashboard, Membership, AuditLogs, CrudManager, AdminControl), empty catch, index-as-key in Estimates (_key), nested ternaries, extracted inline column/field arrays (Resources, Team), removed craco console.warn, split server.py dashboard()/weekly_report() into helpers (_count, _hourly_rates, _sum_field, _data_entry_summary). Regression: iteration_7.json all pass.

## 2026-06 Windows build path
- Added .github/workflows/build-ios.yml (GitHub Actions macOS runner builds app + extension .ipa, uploads to TestFlight via ASC API key). Docs: ios-app/WINDOWS-BUILD.md. Required secrets: APPLE_TEAM_ID, ASC_KEY_ID, ASC_ISSUER_ID, ASC_API_KEY_P8, HUB_TRADE_URL.

## 2026-06 iOS project modernisation
- ios-app upgraded to Capacitor 8.5.2 (SPM, no CocoaPods), committed Xcode project ios/App/App.xcodeproj, UIScene lifecycle (SceneDelegate), deployment target iOS 16.0, bundle com.summitofficesolution.tradehub, 1024px AppIcon. CI uses macos-26 + Node 22. Cannot compile here (no Xcode).

## 2026-06 Deployment check #2
- .env ignore patterns had been re-added to .gitignore by an auto-commit; removed again. NOTE for future agents: verify .gitignore has no .env patterns before deploy.

## 2026-06 Code review round 2
- Split Dashboard/AuditLogs/AdminControl/Estimates/CrudManager into sub-components (components/dashboard, audit, admin, estimates, crud). Removed console.* calls; magic numbers → constants (lib/plans.js, POLL_INTERVAL_MS etc.); test truthiness asserts; random test passwords. Regression: iteration_8.json all pass; pytest 37/37.
- NOTE: hook-dep findings for module imports (api, errMsg) and `is None` checks in server.py are false positives — intentionally left.
