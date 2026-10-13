'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {collect}=require('../src/renderer/device-audit');
test('audit uses all retained records, sorts dates and isolates assets',()=>{
 const history=Array.from({length:20},(_,i)=>({at:new Date(Date.UTC(2026,0,i+1)).toISOString(),type:'Location changed',detail:'Shelf '+i}));
 const asset={id:'A1',history,refurbishment:{reports:[{receivedAt:'2026-02-01T12:00:00Z',status:'Received',notes:'<script>unsafe</script>'}]}};
 const events=collect(asset,{audit:[{assetId:'A1',at:'2026-03-01T00:00:00Z',type:'Part fitted',detail:'Keyboard',by:'Sam'},{assetId:'A2',at:'2026-04-01',type:'Job updated'},...history.slice(0,1).map(e=>({...e,assetId:'A1'}))]});
 assert.equal(events.length,22);assert.equal(events[0].category,'repairs');assert.equal(events[1].category,'refurbflow');assert.equal(events[1].detail,'Received · <script>unsafe</script>');assert.equal(events[0].by,'Sam');assert.equal(asset.history.length,20);
});
test('does not fabricate activity from current values or invalid timestamps',()=>{
 assert.deepEqual(collect({id:'A1',status:'Completed',updatedAt:'2026-01-01',history:[null,{type:'Diagnostic results',at:'invalid'},{type:'Intake'}]},{}),[]);
 assert.equal(collect({id:'A1',history:[{at:'2026-01-01',type:'Diagnostic results',detail:'Keyboard PASS'}]})[0].category,'diagnostics');
 assert.deepEqual(collect(null),[]);
});
