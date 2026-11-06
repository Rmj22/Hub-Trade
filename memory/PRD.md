
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

## 2026-06 Custom domain
- Domain www.trademainhub.com (Namecheap) added to CORS_ORIGINS, Capacitor server.url, Safari extension URLs/manifest. User must add CNAME in Namecheap + custom domain in Emergent Deploy and set CORS_ORIGINS in production env.

## Deployment check #3
- .env patterns re-added to .gitignore by platform auto-commit for the 3rd time; removed. Always strip before deploy check.

## 2026-06 Free trial code
- TRIAL_CODE="HUBTRADE10", TRIAL_DAYS="10" in backend/.env. POST /api/membership/redeem-trial (owner). Grants Medium plan, status "trial", one per company (trial_used). /auth/me auto-expires → status "expired", plan None. UI: Membership page redeem box + status line. Verified via curl + screenshot.

## 2026-06 Trial reminder email
- .emergent/crons.yml: trial-reminders daily 14:00 UTC → POST /api/cron/trial-reminders (Bearer WEBHOOK_CRON_SECRET, idempotent via X-Webhook-Id in db.cron_runs, BackgroundTasks). run_trial_reminders() emails owners of trial companies ending within 2 days (once, trial_reminder_sent flag) with FRONTEND_URL/app/membership upgrade link. Added _assert_safe_email gate + _post_email helper (also used by estimate send). Verified: 401 no auth, accepted, duplicate, email 202 to delivered@resend.dev.
- Production: add WEBHOOK_CRON_SECRET, TRIAL_CODE, TRIAL_DAYS, FRONTEND_URL=https://www.trademainhub.com to Deployments → Secrets.

## 2026-06 Trial ended email
- run_trial_ended() in same daily cron: companies with trial_ends_at <= now → set expired/plan None, email owners "trial has ended" with Reactivate link, once (trial_ended_email_sent). Verified: sent 1, re-run sent 0.

## 2026-06 Phase 1+2 (roadmap)
- Crew Assignment: PUT /api/jobs/{id}/crew, CrewModal on Jobs page (pages/Jobs.js), assignment notifications. Job PUT uses exclude_unset so crew not wiped.
- Schedule: db.schedule {date,job_id,employee_ids,vehicle_ids,equipment_ids,notes}; GET/PUT(upsert, id for move)/DELETE /api/schedule; pages/Schedule.js (week strip + day detail). Local-date keys.
- Estimate approval+deposit: Estimate.deposit_percent (default 25), public_token on send, email link FRONTEND_URL/estimate/{token}; GET /api/public/estimates/{token}, POST .../approve (e-signature), POST .../deposit → Stripe Checkout (mode payment, sandbox key); _fulfil_payment handles kind=deposit via status poll + webhook. pages/PublicEstimate.js. Tests: iteration_9, iteration_10 pass (resend status bug fixed).
- Phase 3 pending: Offline mode (clock-in/out + photos queued, cached jobs/crew read-only).

## 2026-06 Phase 3 Offline mode v1
- lib/offline.js: cachedGet (localStorage ht:cache:*), queue (ht:queue) for clock-in/out (+at timestamp) and job-photo (dataUrl→/upload→POST /jobs/{id}/photos), flushQueue on online/Sync now, useOffline hook. public/sw.js app-shell SW (prod only). OfflineBanner in Layout. AuthContext caches /auth/me (ht:user) so offline reload stays logged in. CrudManager/TimeCards/Team read-only cached offline. Backend: TimeCardAction.at (clamped to now), POST /api/jobs/{id}/photos. Tests: iteration_11, iteration_12.

## 2026-06 Estimate PDF
- backend/estimate_pdf.py (reportlab): branded letter PDF, line items, notes, signature block (signed: name/time/IP/deposit; unsigned: blank line). GET /api/estimates/{id}/pdf (owner/foreman), GET /api/public/estimates/{token}/pdf (customer). Buttons on Estimates card (estimate-pdf-btn) and public page (public-pdf-btn). Verified by rendering PDFs.
