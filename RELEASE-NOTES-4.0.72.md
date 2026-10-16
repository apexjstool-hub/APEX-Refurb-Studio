APEX 4.0.72 — restore the app without Prices

Restores 4.0.70 functionality and removes the Prices tab, pricing IPC methods, Apify integration, pricing stylesheet and pricing tests. Keeps Grade Projection, the combined Respray + UK Keyboard correction, and all earlier inventory/pallet/purchasing features. Uses a new version number so the installer can update normally. No database schema or record changes. Existing local pricing cache/connection files are unused by this version; no Apify requests or paid pricing runs are made.
