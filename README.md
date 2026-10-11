# APEX Cloud Inventory — first online deployment

This is the **Cloud Staff Inventory** page from APEX Upgrade 19, **not** the complete Electron/Windows Management Studio. It can sign in with an authorised Supabase account and edit supported asset fields, provided the appropriate RLS policies exist and cloud inventory has been populated.

## Deploy with Cloudflare Workers Builds

1. In Cloudflare Dashboard > Workers & Pages > Create, choose **Import a repository** and select `apexjstool-hub/APEX-Refurb-Studio` and branch `main`.
2. Select a **Worker** (not a static-only Pages project) and set the root directory to `/`.
3. Set the **Build command** to `echo No build required` if required, and **Deploy command** to `npx wrangler deploy`. Cloudflare may auto-detect `wrangler.jsonc`.
4. In the Worker settings, add two **text variables**: `APEX_SUPABASE_URL` = `https://YOUR-PROJECT.supabase.co` and `APEX_SUPABASE_PUBLISHABLE_KEY` = the Supabase `sb_publishable_...` key. Redeploy after changing settings if Cloudflare prompts you. These are *public browser configuration*, not secrets.
5. Never put the Supabase `sb_secret_...` / `service_role` key, database password, hub token, or private bridge configuration in GitHub, Worker variables used by browser code, or build output.
6. Visit the Cloudflare `workers.dev` HTTPS URL; sign in using an existing authorised Supabase user. `/health` should return JSON. An empty asset list means the cloud database still needs inventory records; deploying the website alone does not migrate inventory.

## Safety and limitations

- Staff edits are controlled by Supabase row-level security policies; verify the configured policies before inviting staff.
- This app contacts Supabase directly over HTTPS and does **not** connect to a local Windows hub. The older hub-to-Supabase bridge is a separate service and won't run on Cloudflare Workers.
- The first deployment provides only the cloud asset table and editing fields. Scanning, full refurbishment workflows, PDF reports, and admin features require further browser migration.
- Every commit to `main` can trigger a new web deployment after Cloudflare Git integration is enabled. Test changes before inviting employees.
- If Cloudflare's UI differs, consult its current Workers Builds documentation for the Git-integrated Worker flow.
