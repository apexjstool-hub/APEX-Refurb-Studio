# APEX 4.0.16 — sign in on another PC

The public cloud connection is already included in this source and future installers. The server secret is not bundled.

## Normal PC
1. Install the new Windows release, or update your installed APEX through Settings → APEX Update Centre after the release is published.
2. On the startup screen choose Shared account (selected automatically for this configured build).
3. Enter your shared account email and password. Tick Remember my login on this PC.
4. On later launches, press Sign in. APEX does not sign in automatically. If your saved session expires, enter the password again.

Do not configure the trusted hub bridge on every PC. Cloud account login opens the existing shared cloud inventory and shared refurbishment workflow. Local/LAN inventory is not automatically migrated or merged by signing in.

## Already inside APEX using this PC's local admin
Open Settings with your local administrator password. Select Sign in to shared workspace in the Shared APEX account panel. This signs out and takes you to the shared-account login. Local data is retained.

## Need a shared account?
A local admin username/password is separate from a shared cloud account.
On the trusted hub PC, unlock Settings → Users and create a shared account with an email, initial password and Staff or Administrator access. The hub must already have its private bridge connection configured.
If there is no shared administrator yet, follow cloud/README-SETUP.md: create the first Auth user in Supabase and assign its actual UUID an active admin profile in apex_staff. Do not create a fresh database/project on each PC.

## Trusted hub only
Advanced · trusted hub setup in Settings retains the existing private bridge and public connection override. These controls are collapsed by default. Keep the private bridge secret only on your trusted hub PC.
Settings still requires your signed-in administrator's password. If the unlock expires while working, cloud bridge controls prompt again before proceeding.

## Publish the installed Windows update
This ZIP is editable source, not an installer update payload.
Replace the repository root files with this source, retaining .github/workflows and package-lock.json. Commit package.json version 4.0.16 to trigger the existing Build APEX Windows Update workflow.
The existing APEX_CLOUD_LOGIN_CONFIG GitHub secret must contain this project's PUBLIC connection, not the server secret.
The workflow builds the NSIS installer and updater metadata as a draft release. Test the installer, then publish v4.0.16 as a normal release with its generated Setup EXE, blockmap and latest.yml intact.
Installed PCs can then use Settings → APEX Update Centre. Publishing source alone does not update installed EXEs.
