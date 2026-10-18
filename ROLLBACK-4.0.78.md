# Return to the previous repair display

In Device Details → Parts & repair, choose **Combined view**. This restores the
previous combined list immediately. Choose **Use separate sections** to return
to the new display. The preference is saved on this computer; it does not change
inventory, part names, quantities, orders, repair progress or grades.

The previous Windows installer is retained in the GitHub **4.0.77** release:
https://github.com/apexjstool-hub/APEX-Refurb-Studio/releases/tag/untagged-4c36aff7762f35cc917f

The new display uses the existing records and counters. There is no database
migration. A 4.0.77 installation reads those records as its original combined
list. Keep your usual inventory backup and the previous installer. Do not
uninstall the app or remove its data to compare layouts; use Combined view.

Existing ordered cosmetic work appears as booked/sent. Received cosmetic work
appears as returned, and previously fitted cosmetic work appears as checked.
These are compatible display names for existing progress, not claims that old
work has been newly dispatched or inspected. New dispatch, return and check
actions are recorded in the asset audit trail.

Existing combined respray + UK keyboard lines remain one record with one set of
quantities. The replacement section references that keyboard without counting
or ordering it twice. For independent tracking on new work, add respray and UK
keyboard as separate requirements. Grade Projection still reads all work.
