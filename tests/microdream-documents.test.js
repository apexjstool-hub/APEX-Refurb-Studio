'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),docs=require('../src/microdream-documents');
function fixture(){return {pallets:[{name:'MD-1',storageLocation:'MICRODREAM'},{name:'MD-2',storageLocation:'MICRODREAM'},{name:'OTHER',storageLocation:'Rack A'},{name:'EMPTY',storageLocation:'MICRODREAM'}],items:[{id:'A',manufacturer:'Dell',model:'Latitude 5420',pallet:'MD-1'},{id:'B',manufacturer:'Dell',model:'Dell Latitude 5420',pallet:'MD-1'},{id:'C',manufacturer:'dell',model:' latitude 5420 ',pallet:'MD-2'},{id:'D',manufacturer:'HP',model:'EliteBook 840 G8',pallet:'MD-2'},{id:'E',manufacturer:'Dell',model:'Latitude 5420',pallet:'OTHER'},{id:'F',manufacturer:'Dell',model:'Latitude 5420',pallet:'MD-1',deletedAt:'2026-01-01'}]};}
test('Selected Microdream pallets group identical models once and count devices, not requirements',()=>{
 const data=fixture(),before=JSON.stringify(data),r=docs.select(data,{palletNames:['MD-1','md-2','MD-1'],jobRef:'JOB-21'});
 assert.equal(r.total,4);assert.equal(r.rows.length,2);assert.equal(r.rows[0].type,'Dell Latitude 5420');assert.equal(r.rows[0].quantity,3);assert.equal(r.rows[1].quantity,1);
 assert(r.rows.every(r=>r.language==='UK'&&r.comment==='Full respray'&&r.model===''&&r.received===''));assert.equal(JSON.stringify(data),before);
 const one=docs.select(data,{palletNames:['MD-1']});assert.equal(one.total,2);assert.equal(one.rows.length,1);
 assert.equal(docs.select({...data,items:[...data.items,data.items[0]]},{palletNames:['MD-1']}).total,2);
});
test('Reject outside, moved, missing and empty pallets; missing models cannot produce misleading totals',()=>{
 for(const palletNames of [[],['OTHER'],['MD-1','OTHER'],['MISSING'],['EMPTY']])assert.throws(()=>docs.select(fixture(),{palletNames}));
 const data=fixture();data.items[0].model='';assert.throws(()=>docs.select(data,{palletNames:['MD-1']}),/Device A has no model/);
 assert.throws(()=>docs.select(fixture(),{palletNames:['MD-1'],jobRef:'a'.repeat(101)}));
});
test('Template uses Type for grouped models and retains blank receiving fields and safe literal text',()=>{
 const data=fixture();data.items[0].model='<script>alert("x")</script>';
 const doc=docs.select(data,{palletNames:['MD-1'],jobRef:'<b>Reference</b>'}),html=docs.markup(doc);
 assert(html.includes('Delivery address:')&&html.includes('MicroDream Ltd')&&html.includes('Asset Technology')&&html.includes('Job Details / Delivery Note'));
 assert(html.includes('&lt;script&gt;')&&!html.includes('<script>'));assert(html.includes('&lt;b&gt;Reference&lt;/b&gt;'));assert(html.includes('QTY Received'));assert(html.includes('<td>UK</td><td>Full respray</td>'));assert(html.includes('Signed:')&&html.includes('Date:')&&html.includes('Apply for keyboards only'));
});
test('Preview fingerprint detects model, membership and pallet-location changes',()=>{
 const data=fixture(),input={palletNames:['MD-1']},before=docs.select(data,input).fingerprint;
 data.items[0].notes='Unrelated note';assert.equal(docs.select(data,input).fingerprint,before);
 data.items[0].model='Latitude 5430';assert.notEqual(docs.select(data,input).fingerprint,before);
 data.items[0].model='Latitude 5420';data.items[1].pallet='MD-2';assert.notEqual(docs.select(data,input).fingerprint,before);
 data.pallets[0].storageLocation='Elsewhere';assert.throws(()=>docs.select(data,input));
});
test('Long and many model lists paginate without dropping rows or quantities',()=>{
 const rows=Array.from({length:19},(_,i)=>({type:'Model '+i+' '+('Long description '.repeat(i%3?1:10)),quantity:1}));
 const pages=docs.pages(rows);assert(pages.every(p=>p.length<=5));assert.equal(pages.flat().length,19);assert.deepEqual(pages.flat(),rows);
});
