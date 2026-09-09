
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
