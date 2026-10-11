# APEX Refurb Management Studio — Electron updates

This repository is reserved for **Windows APEX Refurb Management Studio** update releases and documentation. It is separate from the APEX Laptop Diagnostics updater.

The Cloudflare Worker, browser-only files and web deployment configuration have been removed from the current branch.

## Future Electron releases

Use the tested Electron Windows installer workflow in [RELEASE-GUIDE.md](RELEASE-GUIDE.md). Publish versioned installer artifacts only after validating installation, updates and data preservation on Windows.

Do not publish local inventory, staff credentials, Supabase service-role/secret keys, hub tokens or private bridge configuration. Supabase and the Shared Inventory Hub are separate from the application release repository.

Deleting website files from GitHub does **not** automatically delete the already deployed Cloudflare Worker or its deployment history. Disable or delete that Worker from Cloudflare separately if you want the site offline.
