# APEX 4.0.20 — Inventory workflow, Pallets and template exports

## Track refurbishment on Inventory → All devices
Each row now shows recorded ordered/received/fitted unit counts and a repair-details button. Expand the laptop to see each required part, next actions, technician and the latest recorded activity. You can order parts for that laptop, mark receipt, record fitting, review duplicates and open QC without leaving Inventory.

Ordered counts come from non-draft purchase-order lines. Moving a laptop to the Parts Ordered board does not create a purchase order and is shown separately in expanded details. Direct receipts are shown as received stock, not fabricated purchase orders. Stage filters can find partially ready jobs with fitting available even if other parts are awaiting delivery. All device data, existing pagination and View/Label/Delete actions remain available.

## Pallets
Use Inventory → Pallets to create a numbered pallet, give it a label, view its devices, or delete an empty pallet. Assign a device from Device details → Overview → Pallet, then Save. Pallet filters and a Pallet column are available on All devices. This reuses the existing local/shared/cloud pallet system.

The existing assignment model uses a direct location OR a pallet for new assignments. Selecting a pallet changes the direct location to Unassigned; selecting a direct location removes the pallet assignment. Historical stored assignments are retained until you change them. Move devices off a pallet before deleting it.

## Parts Excel export
Parts Needed exports (selected/all) and Reports → Refurb parts Excel use the supplied Int Refurb Parts Template layout. Recorded Asset ID, make/model, CPU, RAM, storage, serial and part names are filled. Unknown device fields and all part-cost inputs stay blank. The Parts Total formulas remain editable and calculate the four cost cells.

Four part slots are retained per row. A laptop with more than four parts continues on another row with its device information repeated. Quantities above one are included beside the part name. The table grows beyond the original template size without omitting records. Asset IDs/serials are stored as text so leading zeros are retained. The original template is embedded in src/templates/refurb-parts-template.json. Other Excel/CSV exports and print reports are unchanged.

## Install and source
Install APEX-Refurb-Studio-Setup-4.0.20.exe. No new cloud SQL migration is introduced; existing shared inventory/pallet/workflow functions remain required. No live database records are modified just by installing.

The GitHub build creates a draft stable release with the NSIS EXE, blockmap and latest.yml. Test the release, then publish normally to make it available in APEX Update Centre. Download editable source from the GitHub repository using Code → Download ZIP. The GitHub updater and Supabase connections retain their configuration.
