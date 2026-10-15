# APEX Refurb Management Studio 4.0.51

View inventory / View devices / View assets links on Pallets, Locations and pallet-location pages open a dedicated contents page. They no longer route to All devices or alter its filters. Each contents view shows only devices in the selected pallet or direct device location, with its own search, count, pagination and refresh.

Back returns to the originating page, including the specific pallet-location detail page. Opening a device from these contents provides a return path to the same list. Existing unsaved-change checks remain in force. Empty pallets and locations show a clear empty state instead of unrelated inventory.

No additional database migration is needed when upgrading from 4.0.49 or 4.0.50.
