# APEX 4.0.19 — one administrator account

## On your trusted inventory hub PC
1. Install APEX-Refurb-Studio-Setup-4.0.19.exe. Close old APEX / old standalone hub first, then launch the updated APEX.
2. Sign in using your MAIN shared administrator email/password. You do not need to switch to the local admin account.
3. Open Admin Centre and unlock it with the SAME account password.
4. If the hub is not connected, use Automatic tool connections → Start sharing on this PC. Existing hub inventory is retained in the existing shared-hub directory.
5. In Hub sync controls, save your private bridge secret ONCE on this hub PC if it is not already configured. Existing private bridge configuration is reused.
6. Test hub & cloud, review the existing first-sync notice, and Start cloud sync. Once enabled, sync resumes when the updated hub starts on future launches.
7. Settings → Users / Admin Centre → Users manages staff accounts with your main administrator login.

## On your other PC
Install the same update and sign in with your main shared administrator account. Connect once to the EXISTING trusted hub using Inventory connection → Advanced / existing hub (its private LAN address and hub admin token). Do not start a second empty hub on this PC.
After that, Admin Centre uses the connected hub to list/create/manage staff and test/start/stop cloud sync. The private cloud secret is not copied to this PC; its secret-entry controls are hidden for a remote hub.
These remote controls require a trusted LAN or VPN connection to the hub. Do not forward the hub port onto the public internet. This release does not add an internet-hosted management portal or cloud relay. The hub PC and APEX must remain running.

## Android receipts
Intake verification reports whether a hub receipt's Asset ID is present in cloud inventory when you use a shared cloud account. Saved to Hub is not automatically proof that cloud sync completed. Test/start the hub sync and check again.
The bridge now imports saved RefurbFlow parts requirements into cloud Parts Needed, including parts-only edits and earlier saved reports. Cloud orders, received/fitted quantities, manual requirements and QC remain authoritative. This is not full two-way replication of local refurbishment progress. Completed/on-hold jobs and serial conflicts require review; deleted assets are not resurrected.

## Updates
The installed EXE still uses the existing GitHub Update Centre. The GitHub build creates a draft stable v4.0.19 with its NSIS Setup EXE, blockmap and latest.yml. Test it, then publish the draft normally (prerelease off) to make it available to installed PCs.
