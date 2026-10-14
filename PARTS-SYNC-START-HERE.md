# APEX 4.0.19 — RefurbFlow Parts Needed sync

Install the 4.0.19 NSIS update on your trusted HUB PC first, then close/reopen APEX. The existing enabled bridge will restart using the new parts-sync code. If sync was stopped, use Admin Centre → Hub sync controls → Start cloud sync.

Wait 15–30 seconds and refresh Parts Needed while signed into your shared cloud account. No phone update or rescan is needed for reports already saved on this Hub.

The sync log now includes `refurb-parts added=N, updated=N, review-skipped=N`. Added/updated requirements should appear in cloud Parts Needed. Later duplicate cycles should show added=0/updated=0.

This uses the existing apex_refurb_workflow cloud table. No new SQL migration is introduced. If the log says this workflow is not installed, run the project's existing cloud/shared-refurb-workflow.sql setup once in Supabase; do not replace your database.

Cloud orders, received/fitted quantities, IDs, QC, technician and manual parts are preserved. Unchanged reports do not recreate a requirement you removed. Concurrent cloud writes cause a reread/retry. Permanently deleted/recycled assets, identity conflicts and completed/on-hold jobs are not reopened. Their requirements require review.

The bridge imports requirements from saved reports; it does not mirror Hub purchasing, repair completion or QC back and forth. Those should be managed in the shared cloud workspace.
