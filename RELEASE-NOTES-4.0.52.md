# APEX Refurb Management Studio 4.0.52

Pallet locations now have a Delete location action. Only empty locations can be deleted; occupied locations must have their pallets moved out first. Deleting a location never removes pallets or devices.

Create pallet includes an editable Pallet name or number field. Keep the suggested number or enter a unique custom name, including spaces and punctuation. Names preserve their entered case and are checked for duplicates without case sensitivity. Existing pallet names are retained.

Pallets inside a location now appear in a table matching the main Pallets register, with description, creation date, pallet location, inventory count, View inventory, Move pallet and Delete empty pallet actions. View inventory retains the dedicated contents navigation.

The shared cloud metadata function is updated for these actions; the included repeatable cloud SQL contains the changes. Shared-hub deployments must also update their hub/source. Local workspaces need no manual database change.
