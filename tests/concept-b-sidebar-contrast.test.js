'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-concept-b-minimal.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
test('Concept B sidebar has stronger labels, logo and active selection contrast',()=>{
 assert.match(css,/Concept B v4\.1\.03/);
 for(const color of ['#0F2742','#1F5FAF','#2B405C','#114D99','#52647E'])assert(css.includes(color),color);
 assert.match(css,/\.sidebar \.apex-brand-logo\{/);
 assert.match(css,/\.sidebar \.menu-item\.active\{/);
 assert.match(css,/box-shadow:inset 3px 0 0 #2F70C7/);
});
test('the visual override remains scoped to minimal sidebar',()=>{
 const section=css.slice(css.indexOf('/* Concept B v4.1.03'));
 assert(section);
 const selectors=section.split('\n').filter(l=>l.startsWith('html['));
 assert(selectors.length>8);
 assert(selectors.every(l=>l.includes('data-apex-design="minimal"')&&l.includes('.sidebar')),JSON.stringify(selectors));
 assert.match(html,/id="apexDesignSwitch"/);
});
