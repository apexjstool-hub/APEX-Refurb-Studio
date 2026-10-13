# APEX Upgrade 13: Cloud Inventory Foundation (opt-in)

This upgrade **does not create a Supabase project or activate a cloud database automatically**. No account credentials have been provided. The current APEX hub, desktop applications, and existing data remain unchanged by default.

## Setup (administrator)

1. Create a free Supabase project at https://supabase.com. In SQL Editor run `supabase.sql` once. Check for errors and verify RLS policies exist.
2. In Supabase Authentication, create/invite each staff account **without public self-signup**. Give each member a unique password. Run in SQL editor: `insert into public.apex_staff(user_id,role) values ('USER_UUID','staff');` using their actual Auth user UUID. You can add admins using role `admin`.
3. Copy `cloud-config.example.js` to `cloud-config.js`. Replace URL and **publishable (anon)** key, never a secret/service-role key. Host `cloud-staff.html`, `staff-client.js`, and `cloud-config.js` over HTTPS on a trusted static hosting service. Do not use a `file://` URL for staff rollout.
4. On the single trusted Windows computer that currently hosts **APEX Shared Hub**, copy `cloud-bridge.example.json` to `cloud-bridge.local.json`. Enter Supabase project URL and **secret server/service-role key**, the **local hub URL** and token from that computer's hub data folder. KEEP THIS FILE PRIVATE and never put it on a public website or staff computer.
5. With hub running, run `node cloud/sync-bridge.js` from the Studio folder in a separate terminal on the hub computer. Leave it running for cloud syncing. Watch the console for conflicts/errors. Install as a managed background service only after testing.
6. Test with one dummy asset first. Create it through APEX. Check that it appears in cloud, then edit its Location in the staff cloud page and confirm the change appears in APEX after the next sync cycle. Test conflict messages and restore backups before rolling out widely.

## Important design and limits

- Staff can edit supported core asset fields in the **cloud staff web page**, from anywhere, using Supabase Auth and Row Level Security. Desktop APEX still operates via the existing local hub; the bridge synchronises asset changes every ~15 seconds when both systems are reachable. It is **not** a direct Supabase client in Electron.
- Only the admin hub machine uses a Supabase secret key. Never share `cloud-bridge.local.json`, `cloud-sync-state.local.json`, or local hub token. The published web client must use only the public publishable key.
- The bridge seeds new local assets to cloud and synchronises edits to these fields: model, manufacturer, serial, location, status, condition, notes. Other rich fields remain in the existing APEX hub and are only transferred local→cloud as part of a local record update. Cloud staff UI does not edit those fields. Direct cloud-table writes by staff are blocked: only the restricted `apex_update_asset` function can change fields.
- When the same asset is edited concurrently in the cloud and locally, **the bridge stops that asset and reports a conflict**, rather than silently overwriting. Resolve by comparing data and performing a deliberate update to match one side; restart with a reviewed state if necessary. There is no automated conflict resolution UI yet.
- Deletes, new assets created directly in cloud, role-sensitive features beyond active staff, live push sockets, full reports, account management UI, and diagnostic test synchronisation are **not implemented**. Do not rely on this as a finished production rollout.
- Supabase free-tier pauses/limits may affect availability. Implement independent encrypted backups and audit log retention before operational deployment. The cloud staff page shows up to 1000 assets; pagination needs adding for larger inventories.
- Current APEX local hub should **never** be exposed directly to the public internet. Bridge talks only to `localhost` and Supabase HTTPS.
- Bridge startup detects errors and prints them. Keep existing hub backups. No destructive database migration is performed.
- An operator must configure and verify the environment. This ZIP includes source code, not an activated cloud service.
