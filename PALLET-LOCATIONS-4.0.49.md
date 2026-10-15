# Pallet locations — version 4.0.49

Inventory now includes a Pallet locations tab. Create named storage locations, then use Move pallets to assign one or several whole pallets. Each location shows its current pallet count and a View pallets action. Use Move pallet on the Pallets page to change an existing assignment. Unassigned clears the pallet storage assignment. Every pallet remains visible on Pallets regardless of its storage location.

Storage assignments do not change device locations or the devices attached to each pallet. Existing legacy pallet location fields remain intact; the new assignment uses storageLocation. Empty locations remain available for reuse. A changed pallet assignment rejects stale move forms instead of overwriting another user's move.

All Refurbishment pages use consistent spacing, table styles and controls. Per-device Move to Parts Ordered buttons are removed from Parts required. Selection-based bulk move, export, receipts, fitting and QC flows remain.

## Deployment

Local workspaces: no manual database change needed.

Shared hub: deploy the updated hub and src/pallet-management.js source, then restart the hub. Existing data are retained. New clients explain when the older server does not expose pallet storage.

Supabase cloud: run cloud/pallet-locations-4.0.49.sql in your existing project. It is repeatable, adds a separate pallet_locations metadata column, preserves device location and pallet records, and extends the existing authenticated metadata transaction. It does not move any existing pallet. The migration is also attached to the GitHub release. The cloud controls remain disabled until the migration is available. Installing the EXE alone does not deploy a cloud schema update.
