# APEX Web Studio — Upgrade 20, Phase 1

A visual redesign of the actual APEX workflow navigation with functioning Supabase Cloud Staff inventory authentication and edits. This is **not** yet a full replacement for Windows Studio. Dashboard metrics use the authenticated cloud asset list (up to 1000 records); scanning, refurbishment, reports, and native desktop features are explicitly marked pending. Do not give staff access until RLS and permissions have been verified.

## Cloudflare setup

Upload `public/`, `src/`, `wrangler.jsonc` to the **root** of your `apexjstool-hub/APEX-Refurb-Studio` repo; do not upload passwords or the original Windows source. Workers Git deploy command: `npx wrangler deploy`. Set Worker variables `APEX_SUPABASE_URL` and `APEX_SUPABASE_PUBLISHABLE_KEY` under Settings → Variables and Secrets. Both are public config; never use a service-role/secret key.

## Testing

Check `/health`; verify login and active `apex_staff` membership; check only permitted assets load; edit a dummy asset and confirm revision conflict handling; sign out; test on mobile. Existing cloud data depends on prior migration/bridge. Cloudflare doesn't automatically migrate inventory. Keep your previous site and Windows source backed up. Git-based deployment only applies after commit and Cloudflare success.

## Migration roadmap

Phase 2: authorised cloud barcode intake, duplicate checks, asset creation and audit. Phase 3: refurbishment and repairs schema/API. Phase 4: report/PDF workflows. Phase 5: permission model, audit, offline rules, QA and rollout. Validate DB Row Level Security independently before production.
