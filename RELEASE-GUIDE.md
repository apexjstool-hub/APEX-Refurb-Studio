# APEX Refurb Management Studio — Windows updates

This repository is the release channel for **APEX Refurb Management Studio**, separate from APEX Laptop Diagnostics.

## Building a release

1. Use the Upgrade 18 source on a trusted Windows computer. Configure only the **public** Supabase URL/publishable key with the provided one-time script.
2. Run `BUILD-STUDIO-EXE.bat` and verify the Windows NSIS installer works on a clean test PC.
3. Publish a GitHub Release with a version tag matching `package.json`, for example `v4.0.1`.
4. Upload the installer **and** its generated `latest.yml` and `.blockmap` artifacts to the Release assets.
5. For the next release, increase the version in `package.json`, rebuild, test upgrading from the prior version and publish all newly generated assets.
6. Inside APEX Settings > Software Updates, users can check, download and explicitly restart to install.

## Security

Never publish your inventory, local database, hub tokens, Supabase secret/service-role key, passwords or private cloud-bridge configuration. Publish signed releases for production use, enable MFA on publishing accounts, and back up inventory before deployment. The cloud hub and sync bridge must be deployed separately; publishing an application update does not update database records.

The release feed is for **installer builds**, not portable EXEs. Do not publish an untested build as a production release.
