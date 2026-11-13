'use strict';
// Run inside the packaged Preview EXE with ELECTRON_RUN_AS_NODE=1.
// Electron's ASAR-aware fs loader checks files inside app.asar.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const archive=path.resolve('dist/win-unpacked/resources/app.asar');
const read=p=>fs.readFileSync(path.join(archive,p),'utf8');
assert(fs.existsSync(archive),'Missing packaged preview app.asar');
const pkg=JSON.parse(read('package.json'));
assert.equal(pkg.name,'apex-management-studio-5-preview');
assert.equal(pkg.version,'5.0.0-preview.3');
const main=read('src/main.js');
assert(main.includes("app.setPath('userData',previewUserData)"),'Isolated userData missing');
assert(main.includes("app.setAppUserModelId('com.apex.management.preview5')"),'Separate Windows app ID missing');
assert(main.includes("app.setName('APEX Management Studio 5 Preview')"),'Separate app name missing');
assert(main.includes('globalThis.fetch=async()'),'Preview must block Node fetch');
assert(main.includes('callback({cancel:true})'),'Preview must block Chromium remote requests');
assert(main.includes('if(!PREVIEW_DEMO)updateCentre.init(win)'),'Preview updater guard missing');
assert(!fs.existsSync(path.join(archive,'cloud/sync-bridge.js')),'Production cloud worker bundled in preview');
assert(!fs.existsSync(path.join(archive,'cloud/refurb-parts-bridge.js')),'Production cloud parts worker bundled in preview');
assert(!fs.existsSync(path.join(archive,'hub/server.js')),'Shared hub server bundled in preview');
const html=read('src/renderer/index.html');
const style=read('src/renderer/apex5-professional-preview.css');
assert(html.includes('APEX 5.0 Green Professional Preview 3 — Offline Demo'));
for(const page of ['#dashboardPage','#inventoryPage','#assetPage'])assert(style.includes(page),'Missing style: '+page);
console.log('PASS: separate packaged preview identity, demo data directory, no production cloud workers, no network and three Concept A screens.');
