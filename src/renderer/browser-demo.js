/* Browser-only standalone test preview. No shared hub and no production security. */
(function(){
 const core=window.ApexInventoryCore;
 const samples=[
  {id:'APX-10482',manufacturer:'Dell',model:'Latitude 5420',serial:'DL5420-K73M',productType:'Laptop',processor:'Intel Core i5-1145G7',gpu:'Intel Iris Xe Graphics',ram:'16 GB',ramType:'DDR4',pallet:'PALLET-07',sku:'DELL-5420-I5',status:'Processed',condition:'A',location:'Warehouse A',inspection:{cosmetic:'Excellent',functional:'Pass',battery:'Good'},createdAt:'2026-10-03T10:00:00Z'},
  {id:'APX-10483',manufacturer:'HP',model:'EliteBook 840 G9',serial:'HP840-V21F',productType:'Laptop',processor:'Intel Core i5-1235U',gpu:'Intel Iris Xe Graphics',ram:'16 GB',ramType:'DDR4',pallet:'PALLET-09',sku:'HP-840G9',status:'Awaiting Processing',condition:'Good',location:'Inspection',inspection:{cosmetic:'Good',functional:'Not tested',battery:'Good'},createdAt:'2026-10-04T11:00:00Z'},
  {id:'APX-10484',manufacturer:'Lenovo',model:'ThinkPad T14',serial:'LN-T14-X01',productType:'Laptop',processor:'AMD Ryzen 5 PRO',gpu:'AMD Radeon Graphics',ram:'8 GB',ramType:'DDR4',pallet:'PALLET-11',sku:'LEN-T14',status:'Awaiting Processing',condition:'D',location:'Repair bench',inspection:{cosmetic:'Fair',functional:'Issues',battery:'Worn'},createdAt:'2026-10-05T12:00:00Z'},
  {id:'APX-10485',manufacturer:'Dell',model:'Precision 3581',serial:'DP3581-U28Q',productType:'Laptop',processor:'Intel Core i7-13700H',gpu:'NVIDIA RTX A500',ram:'32 GB',ramType:'DDR5',pallet:'PALLET-14',sku:'DELL-3581',status:'Processed',condition:'B',location:'Warehouse B',inspection:{cosmetic:'Good',functional:'Pass',battery:'Not applicable'},createdAt:'2026-10-06T13:00:00Z'}
 ];
 samples[0].refurbishment={source:'RefurbFlow',reports:[{key:'demo-batch:rf-01',batchId:'demo-batch',jobId:'rf-01',receivedAt:new Date().toISOString(),sourceUpdatedAt:Date.now(),status:'Parts Required',notes:'Minor scratches on lid; keyboard requires inspection.',cosmeticIssues:'Surface wear on top cover',functionalityResults:'Keyboard needs replacement',parts:['Keyboard assembly','Top lid respray'],repairs:[{name:'Keyboard assembly',quantity:1},{name:'Top lid respray',quantity:1}]}]};
 let items=samples.map(core.normalize),loggedIn=false;
 let locations=[...new Set(items.map(a=>a.location))];
 let pallets=[];const pal=window.ApexPalletManagement;
 const db=()=>({items,locations,pallets});
 const persistPallets=result=>{if(result.ok){pallets=result.pallets?pallets: db().pallets;savePallets();save();}return result;};
 const savePallets=()=>{try{localStorage.setItem('apex-v345-demo-pallets',JSON.stringify(pallets));}catch{}};
 try{const saved=JSON.parse(localStorage.getItem('apex-v345-demo-pallets')||'[]');if(Array.isArray(saved))pallets=saved;}catch{}
 try{const stored=localStorage.getItem('apex-smart-inventory-demo-v1');if(stored&&Array.isArray(JSON.parse(stored)))items=JSON.parse(stored).map(core.normalize);}catch{}
 const save=()=>{try{localStorage.setItem('apex-smart-inventory-demo-v1',JSON.stringify(items));}catch{}};
 window.apexInventory={
  login:async credentials=>{if(credentials?.username==='admin'&&credentials?.password==='Admin123!'){loggedIn=true;return {ok:true,mustChangePassword:false,username:'admin'};}return {ok:false,error:'Preview credentials are admin / Admin123!'};},
  logout:async()=>{loggedIn=false;return {ok:true};},
  changePassword:async()=>({ok:false,error:'Password changes are available in the desktop app.'}),
  list:async()=>loggedIn?{ok:true,items:items.map(core.normalize),locations,pallets:pal.listPallets(db())}:{ok:false,error:'Please sign in.'},
  addLocation:async name=>{name=String(name||'').trim();if(!loggedIn)return {ok:false,error:'Sign in first.'};if(!name||locations.some(l=>l.toLowerCase()===name.toLowerCase()))return {ok:false,error:'Please enter a new location.'};locations.push(name);return {ok:true,locations};},
  deleteLocation:async(name,moveTo)=>{if(!loggedIn)return {ok:false,error:'Sign in first.'};if(!locations.includes(name)||name==='Unassigned')return {ok:false,error:'Location cannot be deleted.'};const matches=items.filter(a=>a.location===name);if(matches.length&&!moveTo)return {ok:false,error:'Choose a destination first.'};if(matches.length&&!([...locations,'Unassigned'].includes(moveTo))||moveTo===name)return {ok:false,error:'Invalid destination.'};for(const a of matches)core.update([a],a.id,{location:moveTo});locations=locations.filter(l=>l!==name);save();return {ok:true,removed:name,moved:matches.length,moveTo:moveTo||null,locations};},
  createPallet:async input=>{if(!loggedIn)return {ok:false,error:'Sign in first.'};const d=db(),r=pal.createPallet(d,input);if(r.ok){pallets=d.pallets;items=d.items;savePallets();save();}return r;},
  deletePallet:async input=>{if(!loggedIn)return {ok:false,error:'Sign in first.'};const d=db(),r=pal.deletePallet(d,input);if(r.ok){pallets=d.pallets;items=d.items;savePallets();save();}return r;},
  bulkMove:async input=>{if(!loggedIn)return {ok:false,error:'Sign in first.'};const d=db(),r=pal.moveBatch(d,input);if(r.ok){items=d.items;save();}return r;},
  undoBulkMove:async input=>{if(!loggedIn)return {ok:false,error:'Sign in first.'};const d=db(),r=pal.restoreBatch(d,input);if(r.ok){items=d.items;save();}return r;},
  add:async input=>{if(!loggedIn)return{ok:false,error:'Please sign in.'};const r=core.add(items,input);if(r.ok)save();return r;},
  update:async(id,patch)=>{if(!loggedIn)return{ok:false,error:'Please sign in.'};const r=core.update(items,id,patch);if(r.ok)save();return r;},
  remove:async id=>{if(!loggedIn)return{ok:false,error:'Please sign in.'};const i=items.findIndex(x=>x.id===id);if(i<0)return{ok:false,error:'Asset not found.'};items.splice(i,1);save();return {ok:true};},
  syncConflicts:async()=>({ok:true,mode:'demo',conflicts:window.__apexDemoConflicts||(window.__apexDemoConflicts=[{id:'sample-1',assetId:'APX-10484',scope:'diagnostics',source:'APEX Diagnostics',device:'Workshop laptop',status:'pending',createdAt:new Date().toISOString(),existing:{manufacturer:'Lenovo',model:'ThinkPad T14',serial:'LN-T14-X01'},incoming:{manufacturer:'Lenovo',model:'ThinkPad T14',serial:'LN-T14-NEW'}}])}),
  resolveSyncConflict:async input=>{const entry=(window.__apexDemoConflicts||[]).find(x=>x.id===input.id);if(!entry||entry.status!=='pending')return {ok:false,error:'Conflict unavailable.'}; if(!['keepExisting','useIncoming'].includes(input.decision))return {ok:false,error:'Invalid decision.'};entry.status=input.decision==='keepExisting'?'dismissed':'accepted';entry.handledAt=new Date().toISOString();entry.decision=input.decision;return {ok:true,resolved:entry};},
  intakeReceipts:async()=>({ok:true,mode:'local',events:[],message:'Browser preview cannot connect to a shared hub.'}),
  hubStatus:async()=>({ok:true,mode:'local'}),
  hubConnect:async()=>({ok:false,error:'Shared hub connections work in Electron only. This browser preview is independent.'}),
  hubDisconnect:async()=>({ok:true,mode:'local'}),
  hubStart:async()=>({ok:false,error:'Start sharing is available in the Electron app on your computer.'}),
  hubPair:async()=>({ok:false,error:'Pairing is available when the desktop app is connected to a shared hub.'}),
  hubDevices:async()=>({ok:true,autoApprove:false,devices:[]}),
  hubAutoApprove:async()=>({ok:false,error:'Trusted network settings are available in the Windows app.'}),
  hubApprove:async()=>({ok:false,error:'Desktop app required.'}),
  hubRevoke:async()=>({ok:false,error:'Desktop app required.'})
 };
})();
