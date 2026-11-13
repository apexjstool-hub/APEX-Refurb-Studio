'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-concept-b-minimal.css'),'utf8');
const toggle=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-concept-b-toggle.js'),'utf8');
test('Concept B is additive and reversible, not a replacement for core app',()=>{
 assert.match(html,/apex-concept-b-minimal\.css/);
 assert.match(html,/apex-concept-b-toggle\.js/);
 assert.match(html,/id="apexDesignSwitch"/);
 assert.match(css,/html\[data-apex-design="minimal"\]/);
 assert.doesNotMatch(css,/@import/);
 assert.doesNotMatch(toggle,/workflowAction|api\.save|api\.delete|hubConnect|cloudSync/);
});
test('light design covers workspace and login without changing routes',()=>{
 for(const v of ['.login-page','.sidebar','.topbar','.asset-table','#refurbWorkspacePage','.ops-toolbar','.apex-cloud-panel','.hero-banner','.label-studio-shell'])assert(css.includes(v),v);
 for(const route of ['data-page="inventory"','data-page="dashboard"','id="refurbNav"','data-page="reports"'])assert(html.includes(route),route);
});
test('classic rollback is available, persistent and restores prior theme',()=>{
 assert.match(toggle,/apex-ui-concept-v1/);
 assert.match(toggle,/previousThemeKey/);
 assert.match(toggle,/data\-apexDesign|dataset\.apexDesign/);
 assert.match(toggle,/get\(key,'minimal'\)/);
 assert.match(toggle,/get\(previousThemeKey/);
 assert.match(toggle,/design==='minimal'\?'classic':'minimal'/);
});
test('Concept B respects reduced motion and print layout',()=>{
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print/);
});
