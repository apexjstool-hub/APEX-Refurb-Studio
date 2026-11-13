'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const html=read('src/renderer/index.html'),css=read('src/renderer/apex-concept-b-operations.css');
const dash=read('src/renderer/dashboard-visuals.js'),queue=read('src/renderer/refurb-workspace.js');
test('Concept B uses dedicated readable logo while Classic retains original',()=>{
 assert.match(html,/src="assets\/apex-logo\.svg"/);
 assert.match(html,/src="assets\/apex-concept-b-logo\.svg"/);
 assert.match(css,/html:not\(\[data-apex-design="minimal"\]\) #apexSidebar \.apex-b-sidebar-logo/);
 assert.match(css,/\.apex-brand-logo:not\(\.apex-b-sidebar-logo\)/);
 assert.match(css,/#122943/);
 assert.match(css,/font-size:14px!important/);
 const svg=read('src/renderer/assets/apex-concept-b-logo.svg');
 assert.match(svg,/#0F2B4D/);
 assert.match(svg,/#F7FBFF/);
});
test('new Dashboard shortcuts map to real existing pages without data mutation',()=>{
 assert.match(dash,/apex-b-dashboard-actions/);
 assert.match(dash,/data-apex-b-open="refurbJobs"/);
 assert.match(dash,/data-apex-b-open="parts"/);
 assert.match(dash,/data-apex-b-open="inventory"/);
 assert.match(dash,/setPage\(b\.dataset\.apexBOpen\)/);
 assert.match(css,/html:not\(\[data-apex-design="minimal"\]\) #dashboardPage \.apex-b-dashboard-actions\{display:none!important\}/);
});
test('Work Queue metrics are real status-based clickable filters',()=>{
 assert.match(queue,/data-rw-metric/);
 assert.match(queue,/rows\.filter\(r=>matches\(r,'order'\)\)\.length/);
 assert.match(queue,/rows\.filter\(r=>matches\(r,'respray'\)\)\.length/);
 assert.match(queue,/filter=b\.dataset\.rwMetric;page=0;drawQueue\(\)/);
 assert.match(queue,/document\.documentElement\.dataset\.apexDesign==='minimal'/);
});
test('Design stays scoped and existing workflows persist',()=>{
 assert.match(html,/apex-concept-b-system\.css"><link rel="stylesheet" href="apex-concept-b-operations\.css"/);
 for(const key of ['#apexSidebar','#dashboardPage','#refurbWorkspacePage'])assert(css.includes(key));
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print/);
 assert.match(html,/id="topTheme"/);
 assert.match(queue,/window\.ApexInventoryWorkflow\.index\(s\)/);
});
