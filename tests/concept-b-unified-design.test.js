'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-concept-b-system.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
test('unified design system loads after original Concept B style',()=>{
 assert.match(html,/apex-concept-b-minimal\.css"><link rel="stylesheet" href="apex-concept-b-system\.css"/);
 assert.match(html,/id="topTheme"/);
});
test('design tokens and shared controls cover primary, secondary, inputs, tables and dialogs',()=>{
 for(const name of ['--apex-b-radius','--apex-b-blue','button.primary','button.secondary','input','select','textarea','.asset-table','.rw-work-table','.ops-part-progress-table','.inventory-action-menu','#modalLayer .modal-card','.modal-header','.modal-actions'])assert(css.includes(name),name);
});
test('selectors are scoped to opt-in minimal theme, preserving Classic UI',()=>{
 const lines=css.split(/\r?\n/).filter(l=>/^html\[data-apex-design=/.test(l));
 assert(lines.length>24);
 assert(lines.every(l=>l.includes('data-apex-design="minimal"')));
 assert.doesNotMatch(css,/workflowAction|await api\.|setPage\(/);
});
test('no page routes or actions are replaced in source',()=>{
 assert.match(html,/data-page="inventory"/);
 assert.match(html,/id="refurbNav"/);
 assert.match(html,/id="topTheme"/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media print/);
});
