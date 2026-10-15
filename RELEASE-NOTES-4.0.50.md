# APEX Refurb Management Studio 4.0.50

Work queue now has a compact overview for active jobs, deliveries and fitting, clearer device rows, and progress indicators. Existing filters, selection, order, receipt, fitting, QC and return-to-queue actions are retained.

Inventory > Pallet locations > View pallets opens a dedicated page for the chosen location. It shows the location name, total pallet and inventory counts, and one section per pallet. Each pallet has a View inventory hyperlink that opens Inventory filtered to that pallet and clears unrelated filters. Empty pallets show zero inventory, and empty locations have a clear empty state. The page supports refreshing, moving a pallet and returning to the locations overview.

This release uses the existing pallet storage data. Cloud users already on 4.0.49 do not need another database migration. Pallets remain on the main Pallets page.
