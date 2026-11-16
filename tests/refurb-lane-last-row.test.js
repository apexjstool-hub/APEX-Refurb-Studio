'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../src/renderer');
test('Parts and Respray lane last row has bottom clearance and preserves table layout',()=>{
 const css=fs.readFileSync(path.join(root,'refurb-lane-last-row-fix.css'),'utf8');
 const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 assert.match(html,/id="rwLaneView"/);
 assert.match(html,/id="rwLaneTable"/);
 assert.match(html,/refurb-lane-last-row-fix\.css/);
 assert.match(css,/#refurbWorkspacePage #rwLaneView:not\(\[hidden\]\)/);
 assert.match(css,/padding-bottom:64px/);
 assert.match(css,/#refurbWorkspacePage #rwLaneTable/);
 assert.match(css,/padding-bottom:18px!important/);
 assert.match(css,/tr:last-child>td/);
 assert.doesNotMatch(css,/(?:^|[;{}\\s])(?:display:none|position:absolute|height:0)(?:;|$)/m);
});

test('Parts and Respray tables override inherited global 64vh section-panel height limit',()=>{
 const base=fs.readFileSync(path.join(root,'apex-studio-bundle-v10.css'),'utf8');
 const fix=fs.readFileSync(path.join(root,'refurb-lane-last-row-fix.css'),'utf8');
 assert.match(base,/\.ops-table-wrap,\.section-panel,\.table-overflow\{max-height:min\(64vh,710px\)/);
 assert.match(fix,/#refurbWorkspacePage #rwLaneTable\.section-panel\s*\{[^}]*max-height:none!important/);
 assert.match(fix,/#refurbWorkspacePage #rwLaneTable\.section-panel\s*\{[^}]*overflow:visible!important/);
 assert.match(fix,/#refurbWorkspacePage #rwLaneView:not\(\[hidden\]\)\s*\{[^}]*max-height:none!important/);
});
