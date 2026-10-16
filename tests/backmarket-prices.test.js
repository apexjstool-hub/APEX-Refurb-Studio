'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {PriceService,TokenVault,searchFor,normaliseItems,money,ukLink}=require('../src/backmarket-prices');
const sample={'Product name':'Dell Latitude 5420 - 16 GB - SSD 512 GB','Selling Price':350,'Select the condition':{Fair:350,Good:'£399.00',Excellent:'Sold out'},'Technical specifications':{Processor:'Core i5',Memory:'16 GB',Storage:'512 GB'},url:'https://www.backmarket.co.uk/en-gb/p/example'};
const response=(value,status=200)=>({ok:status<300,status,text:async()=>JSON.stringify(value)});
function harness(t,queue){const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-prices-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));const calls=[];let clock=100000;const service=new PriceService({vault:{read:()=> 'test-token-never-public'},dir:()=>folder,now:()=>clock,fetchImpl:async(url,options)=>{calls.push({url,options});if(!queue.length)throw Error('Unexpected request');const next=queue.shift();if(next instanceof Error)throw next;return next;}});return {service,calls,tick:()=>clock+=3000,folder};}
test('Search uses public specifications, not asset ID, serial or notes',()=>{
 const q=searchFor({id:'SECRET-ID',serial:'SERIAL-PRIVATE',manufacturer:'Dell',model:'Dell Latitude 5420',processor:'Core i5',ram:'16 GB',storage:'512 GB',notes:'PRIVATE'});
 assert.equal(q,'Dell Latitude 5420 Core i5 16 GB 512 GB');assert(!/SECRET|PRIVATE/.test(q));
});
test('Dataset preserves condition prices, unavailable entries and specifications without inventing values',()=>{
 const [row]=normaliseItems([sample,{'Selling Price':100}]);assert.equal(row.conditions.Fair,350);assert.equal(row.conditions.Good,399);assert.equal(row.conditions.Excellent,null);assert.equal(row.specs.ram,'16 GB');
 for(const v of ['Sold out','€399','$399',null,0,-1,'call for price'])assert.equal(money(v),null);
 assert.equal(money('£1,250.50'),1250.5);assert.equal(ukLink('javascript:alert(1)'),null);assert.equal(ukLink('https://backmarket.co.uk.evil.test/p'),null);assert.equal(ukLink('https://evil.test'),null);assert.equal(ukLink('https://user:pass@backmarket.co.uk/p'),null);
});
test('Manual run uses documented schema, authorization header and real run cap, then fetches completed dataset',async t=>{
 const h=harness(t,[response({data:{id:'run123456',status:'RUNNING',defaultDatasetId:'dataset123'}}),response({data:{id:'run123456',status:'SUCCEEDED',defaultDatasetId:'dataset123',usageTotalUsd:0.012}}),response([sample])]);
 assert.equal(h.calls.length,0);let state=await h.service.start('Dell Latitude 5420');assert(state.busy);assert(!state.result);assert.equal(h.calls.length,1);
 const req=h.calls[0];assert.match(req.url,/maxTotalChargeUsd=0.25/);assert.match(req.url,/timeout=180/);assert.match(req.url,/restartOnError=false/);assert(!req.url.includes('test-token'));assert.equal(req.options.headers.Authorization,'Bearer test-token-never-public');
 assert.deepEqual(JSON.parse(req.options.body),{function:'country_and_keywords',searchs:['Dell Latitude 5420'],country_input:'United Kingdom',limit_per_search:10,proxy_configuration:{useApifyProxy:true}});
 await assert.rejects(()=>h.service.start('Another device'),/already running/);h.tick();state=await h.service.state('Dell Latitude 5420');assert(!state.busy);assert.equal(state.result.items.length,1);assert.equal(state.result.costUsd,0.012);assert(!JSON.stringify(state).includes('test-token'));assert.match(h.calls[2].url,/datasets\/dataset123\/items/);
 await h.service.state('Dell Latitude 5420');assert.equal(h.calls.length,3);await assert.rejects(()=>h.service.start('Dell Latitude 5420'),/less than a minute/);
 const restored=new PriceService({vault:{read:()=>''},dir:()=>h.folder,fetchImpl:()=>{throw Error('Cache must not run actor');}});assert.equal((await restored.state('Dell Latitude 5420')).result.items.length,1);
});
test('Failure, cancellation and auth errors do not fabricate prices or retry paid starts',async t=>{
 const h=harness(t,[response({data:{id:'run123456',status:'RUNNING'}}),response({data:{status:'FAILED'}})]);await h.service.start('Latitude 5420');h.tick();const r=await h.service.state('Latitude 5420');assert.equal(r.result,null);assert.equal(r.run.status,'FAILED');assert.match(r.run.error,/No replacement prices/);await h.service.state('Latitude 5420');assert.equal(h.calls.length,2);
 const c=harness(t,[response({data:{id:'run123456',status:'RUNNING'}}),response({data:{status:'ABORTED'}})]);await c.service.start('Latitude 5420');assert.equal((await c.service.cancel()).run.status,'ABORTED');assert.match(c.calls[1].url,/\/run123456\/abort$/);
 const e=harness(t,[response({error:{message:'test-token-never-public'}},401)]);await assert.rejects(()=>e.service.start('Latitude 5420'),/rejected the token/);assert.equal(e.calls.length,1);
 const n=harness(t,[Error('network')]);await assert.rejects(()=>n.service.start('Latitude 5420'),/could not be confirmed/);assert.equal(n.calls.length,1);
});
test('A different device can read cached state while the existing run is completed, without another paid run',async t=>{
 const h=harness(t,[response({data:{id:'run123456',status:'RUNNING'}}),response({data:{status:'SUCCEEDED',defaultDatasetId:'dataset123'}}),response([])]);await h.service.start('Dell Latitude');h.tick();const state=await h.service.state('HP EliteBook');assert.equal(state.result,null);assert(!state.busy);assert.equal(h.calls.filter(c=>c.options.method==='POST').length,1);assert.deepEqual(h.service.publicState('Dell Latitude').result.items,[]);
});
test('Token is encrypted on disk, unavailable secure storage never writes plaintext, forget removes it',t=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'apex-price-vault-'));t.after(()=>fs.rmSync(folder,{recursive:true,force:true}));const secure={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v.split('').reverse().join('')),decryptString:b=>b.toString().split('').reverse().join('')};const vault=new TokenVault(()=>folder,secure);vault.save('not-a-real-test-token');assert.equal(vault.read(),'not-a-real-test-token');assert(!fs.readFileSync(vault.file(),'utf8').includes('not-a-real-test-token'));vault.forget();assert.equal(vault.read(),'');const blocked=new TokenVault(()=>folder,{isEncryptionAvailable:()=>false});assert.throws(()=>blocked.save('not-a-real-test-token'),/unavailable/);assert(!fs.existsSync(blocked.file()));
});
