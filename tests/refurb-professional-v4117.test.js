'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('src/renderer/apex-refurb-professional-v4117.css');
const html=read('src/renderer/index.html');
test('v4.1.17 professional styling is loaded after existing refurbishment and dispatch styles',()=>{
 const link='href="apex-refurb-professional-v4117.css"';
 assert.equal(html.split(link).length,2);
 assert(html.indexOf(link)>html.indexOf('href="refurb-work-lanes-v4115.css"'));
 assert(html.indexOf(link)>html.indexOf('href="independent-completion-v4116.css"'));
});
test('All Jobs workspace retains actual search, bulk controls, work queue and expanding details',()=>{
 for(const id of ['rwQueueSummary','rwFilters','rwQueueTable','rwSearch','rwSelectionBar','rwOrderSelected','rwReceiveSelected','rwPrintSelected','rwClearSelection'])
  assert(html.includes('id="'+id+'"'),id);
 const js=read('src/renderer/refurb-workspace.js');
 assert.match(js,/drawQueue\(\)/);
 assert.match(js,/data-rw-expand/);
 assert.match(js,/ApexOps\.orderParts/);
 assert.match(css,/#refurbWorkspacePage #rwQueueTable \.rw-work-table/);
 assert.match(css,/#refurbWorkspacePage #rwFilters/);
});
test('Parts and Respray lanes remain separate, shared-asset projections',()=>{
 const js=read('src/renderer/refurb-workspace.js');
 assert.match(html,/data-rw-view="partsLane"/);
 assert.match(html,/data-rw-view="resprayLane"/);
 assert.match(js,/window\.ApexRefurbLanes\.lanes\(entries\(\)\)/);
 assert.match(css,/#refurbWorkspacePage #rwLaneTable \.rw-lane-table/);
 assert.match(css,/#refurbWorkspacePage \.rw-lane-status/);
});
test('Purchasing and QC use the existing panels and authenticated action handlers',()=>{
 const js=read('src/renderer/refurb-workspace.js');
 const ops=read('src/renderer/refurb-ui.js');
 assert.match(html,/data-rw-purchase="partsOrdered"/);
 assert.match(html,/data-rw-purchase="orders"/);
 assert.match(html,/data-rw-purchase="deliveries"/);
 assert.match(html,/data-rw-view="qc"/);
 assert.match(js,/mount\(\(view==='purchasing'\?purchase:view\)\+'Content'\)/);
 assert.match(ops,/api\.workflowAction/);
 assert.match(css,/#refurbWorkspacePage #rwExistingPanel \.ops-toolbar/);
 assert.match(css,/#refurbWorkspacePage #rwExistingPanel \.ops-qc-list/);
});
test('Presentation pass does not modify cloud data, features, printing or external pages',()=>{
 assert.doesNotMatch(css,/#inventoryPage|#dispatchPage|#labelStudioPage|#assetPage|#modalLayer/);
 assert.doesNotMatch(css,/url\(/);
 assert.match(css,/var\(--rw17-ink\)/);
 assert.match(css,/@media\(max-width:650px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/data-page="dispatch"/);
 assert.match(html,/src="microdream-respray-ui\.js"/);
 assert.match(html,/src="dispatch-centre-v4116\.js"/);
});
