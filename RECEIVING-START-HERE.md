# APEX 4.0.20 — receive parts and enable phone fitting

Install the new Windows release and sign into your shared cloud workspace.
1. Open Parts Ordered → View parts for the laptop.
2. If Review duplicates is shown, review the proposed untouched imported duplicates FIRST and remove only unintended repeated requirements. Entries with received/fitted work, notes or purchase-order links are not offered for removal. Manual requirements are retained. No automatic cleanup runs.
3. Click Mark received beside each physical part that has arrived. Confirm the actual quantity. You can record receipt without making a supplier purchase order; existing linked orders are updated when present.
4. Received quantities must now show in Studio.
5. In Android Repair Station, refresh the job. Received in Studio should update and Record parts fitted becomes available. No Android reinstall is needed for this workflow.

Board movement is not a receipt. Receipt does not mark a part fitted. Local Hub receipts remain local; use the shared cloud workspace for quantities the cloud-connected phone reads.

Repeated Hub/bridge imports reuse imported requirements by Asset ID and part name instead of adding the same requirement for each scan/report. Required quantities can increase without erasing received/fitted progress. Manual same-name requirements remain separate. Cloud intake received directly from a phone still uses its deployed database intake function; this release does not redeploy that function. Existing duplicates are always reviewed before removal.

Receipts carry actor/timestamp audit entries; stale repeated submissions are rejected. Cloud revision checks continue to protect concurrent phone/Studio updates. Completed/on-hold jobs cannot receive parts until their stage is changed.
