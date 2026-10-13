# APEX internet cloud device integration — development foundation

This package includes **server-side cloud intake groundwork**, not a completed, deployed mobile/diagnostics integration.

## Verified existing transport
- RefurbFlow Android: `SmartInventoryClient.kt`, LAN discovery and `/v1/refurb-intake`, UDP 4218 / TCP 4217.
- APEX Diagnostics: `native/smart-inventory-client.js`, LAN discovery and `/v1/diagnostic-intake`.
- Management Studio: Supabase staff login plus cloud asset RPC. The legacy shared-hub data is separate.

## New server-side files
- `device-cloud-intake.sql`: staff-authenticated transactional RPC; asset must already exist; no silent new devices.
- `supabase/functions/apex-device-intake/index.ts`: JWT-authenticated HTTPS entry point using public Supabase key and signed-in user token, **never service-role keys**.
- Accepted reports are stored in the asset payload under `diagnosticsIntake` or `refurbflowIntake`. Additional UI work is required to display them, and to map refurbishment parts into the shared job workflow.

## Incomplete, do not release as "cloud-connected Android/Diagnostics" yet
1. Add staff login/token-refresh UI to both Diagnostics and Android. The LAN pairing tokens are NOT Supabase credentials.
2. Implement opt-in HTTPS send + durable retries using stable event IDs in both device apps.
3. Wire the Management Studio report views to the new intake report journals and parts workflow.
4. Deploy the Edge Function with JWT verification, apply/test the SQL on a backed-up test dataset, verify RLS and access revocation.
5. Test disconnected operation, retries, simultaneous updates, malicious payloads and both app builds.

Do not expose any 4217 hub endpoint publicly. Do not copy a Supabase service-role or secret key into either app. No database changes were made by generating this ZIP.
