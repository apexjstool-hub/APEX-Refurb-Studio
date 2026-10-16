# APEX 4.0.65

- Scan an existing pallet name or PALLET: name to load its active devices on Scan. Repeated scans do not duplicate devices.
- Review and move the list to a new pallet using the normal bulk transfer action. A pallet that would exceed the 300-device limit is not partially loaded.
- Rename existing pallets from Pallets and pallet location details. All active member devices receive the new pallet name and an asset history entry. Storage location, contents and descriptions remain.
- Cloud rename uses the included pallet-rename.sql staff-only atomic RPC.
- Print replacement pallet labels after renaming; old barcodes still contain the old name.

Download APEX-Refurb-Studio-Setup-4.0.65.exe from release Assets.
