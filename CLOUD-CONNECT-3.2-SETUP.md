# APEX Cloud Connect 3.2 — Authorised Portable SSD (preview)

**No encrypted drive, VPN, repeated staff login or IP entry required after SSD approval.**

## Security & deployment gate

This is source code, not an installed Windows EXE and **not deployed** to production Supabase. Keep the current working apps/release intact until a staging test succeeds. Authorising SSDs means anyone who obtains/copies an unencrypted SSD's private credential can submit diagnostic reports until revoked. No broad database access is granted. Use only trusted SSDs and revoke lost devices immediately.

1. Back up your existing database. Review `cloud/portable-ssd-3.2.sql` and run it in SQL Editor on the intended Supabase project. It only adds dedicated tables/index and restrictive policies; it does not replace your existing intake function.
2. Deploy `cloud/supabase/functions/apex-portable-ssd/index.ts` as **`apex-portable-ssd`** with **JWT verification disabled for this dedicated function only**. The function performs its own two types of authentication: Supabase staff JWT for administrator actions, or signed one-time nonce for diagnostics uploads. Keep JWT verification **enabled** on your existing `apex-device-intake` function.
3. Configure the Edge Function's server-only `SUPABASE_SERVICE_ROLE_KEY` secret. **Never put it in the Electron app, public ZIP settings, renderer or SSD.** Supabase provides `SUPABASE_URL`; check environment configuration. Do not share any service-role key in chat.
4. Build and install this preview Management Studio from source on Windows, then sign in to cloud inventory as a cloud **admin** and unlock Settings. Open Settings → Cloud Devices.
5. Build the companion Diagnostics 2.51.4 portable Windows EXE. Put it on the intended SSD and run it **from the SSD**, not a copy on C:. Diagnostics → Connection Details → Authorised SSD → Generate approval code → Copy. The **public-only** approval code must be transferred to Management Studio. Approve it there. The **private** key remains on the SSD in `APEX-Portable-Identity/device-key.json`, never shared through chat or Management Studio.
6. Test Diagnostics on another Wi-Fi: Check SSD authorisation → expect `Authorised SSD · Cloud Connected`. Save one spare asset and verify Pass/Fail + notes in Management Studio. Sync only takes place on deliberate Save/Sync; offline queue remains local.
7. In Management Studio → Cloud Devices, revoke the SSD and confirm the next check/upload is denied. Test an SSD with no approval is also denied. Only then consider a production release.

## Known limits

- The first approval requires an authenticated cloud administrator and unlocked Settings; it is **not** automatic approval of random SSDs.
- Device credential is stored in plain form on an unencrypted SSD, per requested workflow. Anyone who steals/copies that credential may impersonate it. A copied SSD has the same identity; a removable-drive serial number does not secure the key.
- Keep Windows and the portable Diagnostics source trusted; malware on the test laptop could read an unlocked SSD. Approval is limited to diagnostic report uploads and is revocable.
- If Diagnostics is launched from an installed EXE instead of the portable SSD, the identity may be stored beside that EXE; always run the EXE directly from the SSD.
- Cross-network upload requires HTTPS internet access to the Supabase project. No internet = queued locally until manual Sync.
- Secure production rollout also needs Edge Function rate limits/monitoring, credential recovery procedure, and staging end-to-end Windows tests.
