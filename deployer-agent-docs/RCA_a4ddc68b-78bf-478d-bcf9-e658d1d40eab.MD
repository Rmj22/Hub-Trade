# RCA — Free-trial shows "10 days left" instead of 15 (trademainhub.com)

## Problem
After a new owner signs up in production, the trial banner shows "10 days left" instead of the expected 15. Preview (TRIAL_DAYS="15") shows 15 correctly.

## Evidence
1. **Production secret `TRIAL_DAYS` exists but is NOT 15.**
   - `list_secrets` on the active run (a4ddc68b-78bf-478d-bcf9-e658d1d40eab) with `equals {"TRIAL_DAYS":"15"}` → `{"name":"TRIAL_DAYS","is_empty":false,"matches_expected":false}`.
   - Present, non-empty, but its stored value does not equal "15". (Value never revealed.)

2. **Most recent company in prod DB confirms the effective value is 10 days.**
   - DB `trade-hub-910-test_database`, collection `companies`, newest by `trial_started_at`:
     - name: "Sheldon's Laundry"
     - trial_started_at: 2026-11-23T22:14:44.466329+00:00
     - trial_ends_at:   2026-12-03T22:14:44.466311+00:00
   - Difference = **exactly 10 days**, matching the banner ("10 days left") and the backend logic `trial_ends_at = now + TRIAL_DAYS days`.

## Root cause
The production `TRIAL_DAYS` secret holds a value other than 15 (effectively 10, per the DB span). Backend default is 15, so this is an overriding stale/incorrect prod secret value. System keys are not involved; `TRIAL_DAYS` is a user-owned custom secret.

## Fix
- **User action:** In Deployment Panel → Secrets, set `TRIAL_DAYS` to `15` (to match preview), then redeploy. New signups after redeploy will get a 15-day trial. Existing companies already created with a 10-day `trial_ends_at` will not be retroactively changed.

## Notes
- No code change required — backend logic and default are correct.
- No deploy or secret change was made during this investigation, per instruction.
