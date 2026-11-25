'use strict';const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),exporter=require('../src/refurb-export'),xlsx=require('../src/refurb-template-xlsx');
const asset={id:'0000123',manufacturer:'HP',model:'ZBook Studio 16 inch G10 Mobile Workstation PC',processor:'Intel Core i7',ram:'32 GB',storage:'1 TB NVMe',serial:'0000456'};const workflow={jobs:{'0000123':{parts:Array.from({length:6},(_,i)=>({name:'Part '+(i+1),qty:i===0?2:1}))}}};
test('Reference columns map only recorded device fields and preserve all parts across four-slot continuation rows',()=>{const rows=exporter.templatePartsRows([asset],workflow);assert.equal(rows.length,2);assert.deepEqual(rows[1].slice(0,6),['0000123','HP ZBook Studio 16 inch G10 Mobile Workstation PC','Intel Core i7','32 GB','1 TB NVMe','0000456']);assert.equal(rows[1][6],'Part 1 × 2');assert.equal(rows[1][14],'Part 5');assert.equal(rows[1][16],'Part 6');assert.equal(rows[0].length,20);for(const c of [7,9,11,13,15,17])assert.equal(rows[1][c],null);assert.equal(exporter.templatePartsRows([asset],workflow,[]).length,1);});
test('Export retains reference table/styles and valid totals; asset text stays literal',()=>{const rows=exporter.templatePartsRows([{...asset,processor:'=HYPERLINK("bad")'}],workflow),buffer=xlsx.workbook(rows),entries=xlsx.readArchive(buffer),sheet=entries.get('xl/worksheets/sheet1.xml').toString();assert.ok(entries.has('xl/styles.xml'));assert.ok(entries.get('xl/tables/table1.xml').toString().includes('displayName="Expenses"'));assert.ok(sheet.includes('<t xml:space="preserve">=HYPERLINK(&quot;bad&quot;)</t>'));assert.ok(sheet.includes('r="A4"')&&sheet.includes('0000123'));assert.ok(sheet.includes('r="S4"')&&sheet.includes('SUM(H4,J4,L4,N4,P4,R4)'));assert.ok(!entries.has('xl/calcChain.xml'));assert.ok(sheet.includes('<c r="H4"'));});
test('Template expands beyond its original row count without truncation or broken totals',()=>{const rows=exporter.templatePartsRows(Array.from({length:50},(_,i)=>({...asset,id:'ASSET-'+i})),{jobs:Object.fromEntries(Array.from({length:50},(_,i)=>['ASSET-'+i,{parts:[{name:'Battery',qty:1}]}]))});const entries=xlsx.readArchive(xlsx.workbook(rows)),sheet=entries.get('xl/worksheets/sheet1.xml').toString();assert.ok(sheet.includes('ASSET-49'));assert.ok(sheet.includes('SUM(H4:H53)'));assert.ok(entries.get('xl/tables/table1.xml').toString().includes('ref="A3:P54"'));});
if(process.env.APEX_EXPORT_QA_PATH)fs.writeFileSync(process.env.APEX_EXPORT_QA_PATH,xlsx.workbook(exporter.templatePartsRows([asset],workflow)));

test('Long descriptions receive wrapped styles, wider columns and content-sized row heights',()=>{
 const rows=exporter.templatePartsRows([{...asset,model:'Professional workstation model with a very long manufacturer description '+asset.model}],{jobs:{'0000123':{parts:[{name:'Replacement full keyboard and palmrest assembly with backlight and UK layout '.repeat(3),qty:1}]}}});
 const entries=xlsx.readArchive(xlsx.workbook(rows)),sheet=entries.get('xl/worksheets/sheet1.xml').toString(),styles=entries.get('xl/styles.xml').toString();
 assert.ok(Number(sheet.match(/<row r="4"[^>]*\bht="([\d.]+)"/)[1])>60);
 assert.ok(sheet.includes('width="44"')&&sheet.includes('wrapText')===false);
 assert.ok(styles.includes('wrapText="1"'));assert.ok(entries.has('xl/media/apex-brand.png'));assert.ok(entries.has('xl/drawings/apex-brand.xml'));
 assert.ok(sheet.includes('APEX - Refurb Parts Required'));assert.ok(sheet.includes('ySplit="3"'));
});

test('Mark one part ordered retains unfitted requirements in refurbishment exports',()=>{
 const W=require('../src/refurb-workflow'),I=require('../src/inventory-workflow');
 const assets=[{...asset,id:'A'},{...asset,id:'B'}];
 const original={jobs:{A:{assetId:'A',status:'Awaiting Parts',parts:[{id:'screen',name:'Screen',qty:3,received:1,fitted:0},{id:'keyboard',name:'Keyboard',qty:2,received:0,fitted:0}]},B:{assetId:'B',status:'Awaiting Parts',parts:[{id:'screen',name:'Other screen',qty:1,received:0,fitted:0}]}},orders:[],audit:[]};
 const cmd={type:'markPartOrdered',assetId:'A',partId:'screen',expectedQty:3,expectedReceived:1,expectedOnOrder:0};
 const r=W.apply(structuredClone(original),assets,cmd,'Jacob');assert.equal(r.ok,true);
 assert.equal(r.order.lines.length,1);assert.equal(r.order.lines[0].qty,2);assert.equal(r.order.lines[0].received,0);
 assert.deepEqual(r.workflow.jobs.A.parts,original.jobs.A.parts);assert.deepEqual(r.workflow.jobs.B,original.jobs.B);
 assert.ok(r.workflow.audit.some(e=>e.type==='Part ordered'&&e.assetId==='A'&&e.by==='Jacob'&&e.detail.includes('Screen')));
 const rows=exporter.templatePartsRows(assets,r.workflow);assert.equal(rows.length,3);assert.equal(rows[1][6],'Screen × 3');assert.equal(rows[1][8],'Keyboard × 2');assert.equal(rows[2][6],'Other screen');
 assert.deepEqual(exporter.templatePartsRows(assets,r.workflow,['A']).map(r=>r[6]).slice(1),['Screen × 3']);
 assert.deepEqual(exporter.requiredPartsRows(assets,r.workflow,['A']).slice(1).map(r=>r[3]),['Screen','Keyboard']);
 assert.equal(I.summarize(r.workflow.jobs.A,r.workflow.orders).awaiting,2);
 const before=JSON.stringify(r.workflow);assert.equal(W.apply(r.workflow,assets,cmd).ok,false);assert.equal(JSON.stringify(r.workflow),before);
 const received=W.apply(structuredClone(r.workflow),assets,{type:'receivePart',assetId:'A',partId:'screen',expectedReceived:1,qty:2});assert.equal(received.ok,true);assert.equal(received.workflow.orders[0].lines[0].received,2);assert.equal(received.workflow.jobs.A.parts[0].fitted,0);
 assert.equal(exporter.templatePartsRows(assets,received.workflow,['A'])[1][6],'Screen × 3');
 const roundtrip=W.init(JSON.parse(JSON.stringify(r.workflow)));assert.equal(exporter.templatePartsRows(assets,roundtrip,['A'])[1][6],'Screen × 3');
 for(const status of ['Completed','On Hold']){const locked=structuredClone(original);locked.jobs.A.status=status;const before=JSON.stringify(locked);assert.equal(W.apply(locked,assets,cmd).ok,false);assert.equal(JSON.stringify(locked),before);}
 const stale=structuredClone(original);stale.jobs.A.parts[0].qty=4;assert.equal(W.apply(stale,assets,cmd).ok,false);
 assert.equal(W.apply(structuredClone(original),assets.map(a=>({...a,deletedAt:'today'})),cmd).ok,false);
});

test('Refurb Excel includes every unfitted quantity regardless of purchase order and never resurrects removed requirements',()=>{
 const assets=[{...asset,id:'A',refurbishment:{repairs:[{name:'Old removed requirement',quantity:1}]}}];
 const workflow={jobs:{A:{assetId:'A',parts:[{id:'a',name:'Battery',qty:5,received:1,fitted:1},{id:'b',name:'Fitted keyboard',qty:1,received:1,fitted:1}]}},orders:[{status:'Draft',lines:[{assetId:'A',partId:'a',qty:20,received:0}]},{status:'Ordered',lines:[{assetId:'A',partId:'a',qty:3,received:1}]}]};
 assert.equal(exporter.templatePartsRows(assets,workflow)[1][6],'Battery × 4');
 workflow.jobs.A.partsBoard='ordered';assert.equal(exporter.templatePartsRows(assets,workflow)[1][6],'Battery × 4');
 workflow.jobs.A.parts=[];delete workflow.jobs.A.partsBoard;assert.equal(exporter.requiredPartsRows(assets,workflow).length,1);assert.equal(exporter.templatePartsRows(assets,workflow).length,1);
});


test('Manual refurb notes persist separately and occupy only the Refurb notes Excel column',()=>{
 const core=require('../src/inventory-core'),W=require('../src/refurb-workflow');
 const imported={reports:[{key:'phone',notes:'Imported phone note',repairs:[{name:'LCD',quantity:1}]}]};
 const items=[core.normalize({...asset,notes:'General inventory note',refurbishment:imported})];
 const note='=This is literal text\nCheck lid & replace screw <before QC>';
 const r=core.update(items,asset.id,{refurbNotes:note});assert.equal(r.ok,true);assert.equal(r.item.refurbNotes,note);assert.equal(r.item.notes,'General inventory note');assert.deepEqual(r.item.refurbishment,imported);assert.ok(r.item.history.some(e=>e.type==='Refurb notes'&&e.detail.includes('replace screw')));
 const reloaded=core.normalize(JSON.parse(JSON.stringify(r.item)));assert.equal(reloaded.refurbNotes,note);
 const workflow={jobs:{[asset.id]:{parts:[{id:'lcd',name:'LCD',qty:1,received:0,fitted:0}]}}};
 const rows=exporter.templatePartsRows([reloaded],workflow);assert.equal(rows[0][15],'Refurb notes');assert.equal(rows[1][15],note);assert.equal(rows[1][6],'LCD');assert.ok(!rows[1].slice(0,15).includes(note));
 const entries=xlsx.readArchive(xlsx.workbook(rows)),sheet=entries.get('xl/worksheets/sheet1.xml').toString(),table=entries.get('xl/tables/table1.xml').toString();
 assert.ok(sheet.includes('r="P4"')&&sheet.includes('=This is literal text'));assert.ok(sheet.includes('&amp; replace screw &lt;before QC&gt;'));assert.ok(sheet.includes('SUM(H4,J4,L4,N4)'));assert.ok(table.includes('count="16"')&&table.includes('name="Refurb notes"')&&table.includes('A3:P'));
 workflow.jobs[asset.id].parts=[];assert.equal(exporter.templatePartsRows([reloaded],workflow).length,1);
 const cleared=core.update(items,asset.id,{refurbNotes:''});assert.equal(cleared.item.refurbNotes,'');assert.deepEqual(cleared.item.refurbishment,imported);
});

// Regression: asset 83253 must include ordered parts alongside required respray.
test('Refurbishment Excel retains asset 83253 ordered LCD, rubber foot and bezel, plus respray',()=>{
 const a={id:'83253',manufacturer:'HP',model:'250 G9',serial:'SERIAL'};
 const w={jobs:{'83253':{parts:[
  {id:'lcd',name:'LCD Panel',qty:1,received:0,fitted:0,status:'Ordered'},
  {id:'foot',name:'Rubber Foot Strip',qty:1,received:0,fitted:0,status:'Ordered'},
  {id:'bezel',name:'Screen Bezel',qty:1,received:0,fitted:0,status:'Ordered'},
  {id:'respray',name:'Respray',qty:1,received:0,fitted:0,status:'Required'}
 ]}},orders:[]};
 assert.deepEqual(exporter.requiredPartsRows([a],w).slice(1).map(row=>row[3]),['LCD Panel','Rubber Foot Strip','Screen Bezel','Respray']);
 const row=exporter.templatePartsRows([a],w)[1];
 assert.deepEqual([row[6],row[8],row[10],row[12]],['LCD Panel','Rubber Foot Strip','Screen Bezel','Respray']);
 w.jobs['83253'].parts[0].fitted=1;
 assert.deepEqual(exporter.requiredPartsRows([a],w).slice(1).map(row=>row[3]),['Rubber Foot Strip','Screen Bezel','Respray']);
});

test('Export presentation normalises common part typos without changing device IDs or original records',()=>{
 const a={...asset,id:'FORMATTING',serial:'00aBc-009',model:'ProBook 450 G9',refurbNotes:'  Engineer says keyboard not working.  '};
 const w={jobs:{FORMATTING:{parts:[{name:'lcd panle',qty:1},{name:'SCRen bezel',qty:1},{name:'RESpary',qty:1},{name:'battery',qty:1}]}}};
 const rows=exporter.templatePartsRows([a],w);
 assert.deepEqual([rows[1][6],rows[1][8],rows[1][10],rows[1][12]],['LCD Panel','Screen Bezel','Respray','Battery']);
 assert.equal(rows[1][5],'00aBc-009');
 assert.equal(rows[1][1],'HP ProBook 450 G9');
 assert.equal(rows[1][15],'Engineer says keyboard not working.');
 assert.equal(a.refurbNotes,'  Engineer says keyboard not working.  ');
 const workbook=xlsx.readArchive(xlsx.workbook(rows));
 const styles=workbook.get('xl/styles.xml').toString();
 const sheet=workbook.get('xl/worksheets/sheet1.xml').toString();
 assert.ok(styles.includes('FFF2F6FB'));
 assert.ok(styles.includes('name val="Aptos"'));
 assert.ok(sheet.includes('LCD Panel')&&sheet.includes('Screen Bezel'));
});

test('Each asset occupies exactly one Excel row with dynamic individual cost columns',()=>{
 const a={...asset,id:'83253',serial:'ABC-004'};
 const parts=[{name:'LCD Panel',qty:1,cost:42.5,status:'Ordered'},{name:'Rubber Foot Strip',qty:1,cost:2.99,status:'Ordered'},{name:'Screen Bezel',qty:1,cost:15,status:'Ordered'},{name:'Respray',qty:1,cost:22},{name:'Keyboard',qty:1,cost:19.5},{name:'Battery',qty:1,cost:27.8}];
 const rows=exporter.templatePartsRows([a],{jobs:{'83253':{parts}}});
 assert.equal(rows.length,2);
 assert.equal(rows[1][0],'83253');
 assert.equal(rows[0].length,20);
 assert.deepEqual([rows[1][6],rows[1][8],rows[1][10],rows[1][12],rows[1][14],rows[1][16]],parts.map(p=>p.name));
 assert.deepEqual([rows[1][7],rows[1][9],rows[1][11],rows[1][13],rows[1][15],rows[1][17]],parts.map(p=>p.cost));
 const entries=xlsx.readArchive(xlsx.workbook(rows));
 const sheet=entries.get('xl/worksheets/sheet1.xml').toString(),table=entries.get('xl/tables/table1.xml').toString();
 assert.ok(sheet.includes('r="A4"')&&sheet.includes('83253'));
 assert.ok(sheet.includes('r="R4"'));
 assert.ok(sheet.includes('<f>SUM(H4,J4,L4,N4,P4,R4)</f>'));
 assert.ok(table.includes('tableColumns count="20"')&&table.includes('name="Part #6 Cost"'));
 assert.ok(table.includes('name="Refurb notes"'));
});
