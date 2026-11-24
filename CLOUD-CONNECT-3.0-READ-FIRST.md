# APEX Cloud Connect 3.0 — verified foundation, not a deployed cloud service

## Purpose
Use Supabase HTTPS for Diagnostics on different networks, preserving local Hub fallback and explicit manual Sync.

## Current source support
- Diagnostics has password-based staff login, token refresh, manual-only cloud Send, and a durable per-asset offline outbox.
- This upgrade adds encrypted session restoration on the **same Windows PC** via Electron safeStorage, and securely forgets it on logout.
- Management Studio includes the `apex-device-intake` Edge Function and SQL migrations for report receipts and mappings.
- The cloud connection requires the live Supabase function, schema and permissions to be deployed and verified. Source presence is not proof of deployment.

## Preflight
On a developer machine, run `npm run cloud:preflight` in the Management Studio source folder. This verifies required files, **not** the live backend.

## Before production use
1. Back up the database and verify its existing schema/migration status in a nonproduction environment.
2. Confirm staff-access policy and deploy the Edge Function and SQL *only after review*.
3. Test one spare asset end to end with manual Sync and inspect Pass/Fail notes in Management Studio.
4. Test retries, idempotency, revoked accounts, offline behavior, and update from the existing working Hub version.
5. Plan separate device enrolment and admin approval for a true no-login experience on *new* Windows PCs. Do not use a reusable shared service-role key or embed staff credentials into a portable SSD.

## Known limitations
- A brand-new PC must be securely authorised before Cloud Sync; this source does **not** implement approval without login.
- Electron safeStorage is bound to the Windows user/computer. Moving the portable SSD to a different PC does not transfer its cloud session.
- VPN and LAN discovery are separate; the original working LAN path remains.
- No production deployment or Windows EXE was performed.
