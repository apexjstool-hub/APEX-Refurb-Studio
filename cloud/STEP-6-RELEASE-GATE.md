# Cloud Inventory — Step 6 release gate

This development branch is NOT APPROVED for production or merging.

## Source changes added
- Supabase access-token renewal via in-memory refresh token, serialized across simultaneous requests.
- Duplicate/conflict feedback, revision-guarded asset edits.
- Explicit refusal to show truncated inventory and trash results.
- Cloud writes never silently fall back to local storage.

## Blocking checks before Step 7
- Run Node syntax checks and Electron startup tests on Windows.
- Fix inventory pagination (currently 1,000-record cap), refresh/revision-map races and expired-token errors surfaced by network helpers.
- Verify cloud metadata SQL is valid, including insert defaults and row locking, and test all move, undo, location/pallet deletion cases.
- Audit SECURITY DEFINER functions for role least privilege, payload validation, document limits and access revocation.
- Review workflow integrity: global workflow JSON has version checks, but purchases and asset changes are not atomic with each other.
- Confirm admin-only mutations are enforced in database RPCs rather than only the Electron renderer.
- Confirm all UI routes have cloud equivalents; unsupported ones must be explicitly disabled with explanatory messages.
- Validate offline save ambiguity, login/revocation, simultaneous edits, two PCs and distinct authorised staff.
- Review and apply migrations in test Supabase project before touching production.
- Do not merge, distribute an EXE, or run unreviewed SQL on live records.

Source review is not a substitute for end-to-end tests. Close every blocker before release.
