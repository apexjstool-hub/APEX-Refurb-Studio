# APEX Management Studio 4.4.5 — Authorised SSD Cloud Connect 3.2

Stable release of APEX Management Studio with **Cloud Devices** administration for portable APEX Diagnostics SSDs.

- Approve portable SSD public identity code through Settings > Cloud Devices.
- List and revoke authorised SSDs; last-use details are shown when available.
- Existing inventory, Completed QA, label printing, diagnostics reports and local Hub are preserved.
- Existing app ID (`com.apex.inventory`) and stable GitHub updater remain unchanged.
- Requires the existing APEX Supabase project to have the `apex-portable-ssd` Edge Function and device registry deployed.
- Does not change the current Diagnostics client automatically; Diagnostics 2.51.4 is a separate application.
- No disk encryption required, but an unencrypted SSD identity can be copied if someone gains access to the drive. Revoke a lost SSD promptly.

For reliable rollout, verify SSD approval and revocation and manually sync a test asset from a different Wi-Fi before installing across all workstations.

**Rollback:** Previous v4.4.4 installer remains available as an earlier GitHub release. Back up app data and database according to your normal procedure before upgrading production systems.
