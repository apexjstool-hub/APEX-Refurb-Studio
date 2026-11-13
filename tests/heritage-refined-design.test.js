'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const css=read('src/renderer/apex-heritage-refined.css'),js=read('src/renderer/apex-concept-b-toggle.js'),html=read('src/renderer/index.html');
test('Heritage theme defaults to familiar original dark navy APEX layout',()=>{
 assert.match(js,/get\(key,'heritage'\)/);
 assert.match(js,/const options=\['heritage','minimal','classic'\]/);
 assert.match(js,/dataset\.theme='dark'/);
 assert.match(css,/background:#172634!important/);
 assert.match(css,/width:272px!important/);
 assert.match(css,/\.apex-b-sidebar-logo\{display:none!important\}/);
 assert.match(css,/\.apex-brand-logo\{/);
});
test('Dark sidebar has explicitly readable menu, wordmark, icons and active item',()=>{
 assert.match(css,/color:#F4F8FF!important/);
 assert.match(css,/-webkit-text-fill-color:#F4F8FF!important/);
 assert.match(css,/\.menu-item\.active/);
 assert.match(css,/color:#0E447F!important/);
 assert.match(css,/\.wordmark b/);
 assert.match(css,/color:#9AC9FF!important/);
});
test('Refined visual styling applies only to the Heritage opt-in theme',()=>{
 assert.match(html,/apex-heritage-refined\.css/);
 const selectors=css.split(/\r?\n/).filter(line=>line.startsWith('html['));
 assert(selectors.length>35);
 assert(selectors.every(line=>line.includes('data-apex-design="heritage"')));
 for(const klass of ['.asset-table','.rw-work-table','.modal-card','.section-panel','.flat-editor','.sidebar-user'])assert(css.includes(klass),klass);
});
test('Existing app controls and Classic and Concept B remain available',()=>{
 assert.match(html,/id="assetEditor"/);
 assert.match(html,/id="apexDesignSwitch"/);
 assert.match(html,/id="refurbNav"/);
 assert.match(html,/src="assets\/apex-logo\.svg"/);
 assert.match(js,/options\.indexOf\(design\)\+1/);
 assert.match(js,/const previousThemeKey/);
 assert.doesNotMatch(js,/api\.update|api\.add|workflowAction|fetch\(/);
 assert.match(css,/@media print/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
