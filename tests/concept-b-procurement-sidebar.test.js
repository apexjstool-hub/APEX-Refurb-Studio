'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=x=>fs.readFileSync(path.join(__dirname,'..',x),'utf8');
const css=read('src/renderer/apex-concept-b-procurement.css');
const html=read('src/renderer/index.html');
const work=read('src/renderer/refurb-workspace.js');
test('sidebar on dark background receives bright nonselected text and icons',()=>{
 assert.match(css,/background:#152A3E!important/);
 assert.match(css,/\.menu-item \.apex-nav-text/);
 assert.match(css,/\.menu-item \.nav-symbol/);
 assert.match(css,/color:#F3F8FF!important/);
 assert.match(css,/-webkit-text-fill-color:#F3F8FF!important/);
 assert(css.includes('.menu-item.active .apex-nav-text'));
 assert.match(css,/color:#103E78!important/);
 assert.match(css,/html\[data-apex-design="minimal"\] body #appPage #apexSidebar/);
});
test('procurement metrics are calculated from live jobs and activate existing routes',()=>{
 assert.match(html,/id="rwPurchasingOverview"/);
 assert.match(work,/const procurement=\$\('rwPurchasingOverview'\)/);
 assert.match(work,/const needed=rows\.filter/);
 assert.match(work,/const resprays=rows\.filter/);
 assert.match(work,/data-rw-procurement/);
 assert.match(work,/filter='respray';page=0/);
 assert.match(work,/purchase=b\.dataset\.rwProcurement/);
 assert.match(css,/#rwPurchasingOverview\[hidden\]/);
});
test('Microdream and purchasing changes are visual-only',()=>{
 assert.match(css,/#palletLocationDetailPage \.md-pallet-selection/);
 assert.match(css,/\.microdream-request-dialog/);
 assert.match(css,/\.microdream-preview-frame/);
 assert.doesNotMatch(css,/workflowAction|localStorage|fetch\(/);
 assert.match(html,/id="apexDesignSwitch"/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
