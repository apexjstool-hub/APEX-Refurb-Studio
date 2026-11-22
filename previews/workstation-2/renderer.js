'use strict';
// Local in-memory demonstration only: no IPC, network, persistence or production mutations.
const $=id=>document.getElementById(id);
const clone=x=>JSON.parse(JSON.stringify(x));
const make=(id,name,job,tests,parts,qc={})=>({id,manufacturer:name.split(' ')[0],model:name,serial:'DEMO-'+id,processor:'Intel Core i5',ram:'8GB DDR4',storage:'256GB SSD',grade:'Good',location:'Rack A / Pallet 04',job:{status:job,parts,qc,notes:''},tests,events:[{text:'Demo asset loaded (no production data)',at:'Session'}]});
const pass=(label)=>({label,status:'pass'});
const fail=(label,comment)=>({label,status:'fail',comment});
const DEMOS=[
 make('85543','HP ProBook 450 G8','Awaiting Parts',{display:pass('Display'),keyboard:pass('Keyboard'),battery:fail('Battery','Capacity below service threshold'),wifi:pass('Wi-Fi'),storage:pass('Storage')},[{id:'bat',name:'Battery replacement',qty:1,received:0,fitted:0,ordered:false}]),
 make('85544','Dell Latitude 5420','Repair In Progress',{display:pass('Display'),keyboard:fail('Keyboard','Two keys unresponsive'),battery:pass('Battery'),wifi:pass('Wi-Fi'),storage:pass('Storage')},[{id:'kb',name:'UK keyboard',qty:1,received:1,fitted:0,ordered:true}]),
 make('85545','Lenovo ThinkPad T14 Gen 2','Quality Control',{display:pass('Display'),keyboard:pass('Keyboard'),battery:pass('Battery'),wifi:pass('Wi-Fi'),storage:pass('Storage')},[],{'Visual inspection':true,'Required parts fitted':true,'Hardware retest':true})
];
let records=clone(DEMOS),selected=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const current=()=>records.find(r=>r.id===selected);
const now=()=>new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
function log(r,text){r.events.unshift({text,at:now()});}
function status(message,bad=false){$('status').textContent=message;$('status').classList.toggle('bad',bad);}
function open(raw){const term=String(raw||'').trim().toUpperCase();const r=records.find(r=>r.id===term||r.serial.toUpperCase()===term);if(!r){status('Demo asset not found. Try 85543, 85544 or 85545.',true);return; }selected=r.id;$('scan').value=r.id;status('Demo '+r.id+' loaded · no cloud access.');render();}
function action(kind,id){const r=current();if(!r)return;const p=r.job.parts.find(x=>x.id===id);if(!p||r.job.status==='Completed'||r.job.status==='On Hold')return;
 if(kind==='order'){if(p.ordered||p.received)return;if(!confirm('Demo only: mark '+p.name+' as ordered? No purchase is made.'))return;p.ordered=true;log(r,p.name+' marked ordered (demo)');}
 if(kind==='receive'){if(!p.ordered||p.received>=p.qty)return;if(!confirm('Demo only: confirm receipt of '+p.name+'?'))return;p.received=p.qty;log(r,p.name+' received (demo)');}
 if(kind==='fit'){if(p.received<=p.fitted)return;if(!confirm('Demo only: confirm '+p.name+' fitted? This does not change diagnostics results.'))return;p.fitted=p.qty;log(r,p.name+' fitted; diagnostics retest still required');}
 render();
}
function render(){const r=current();$('empty').hidden=!!r;$('workspace').hidden=!r;if(!r)return;
 const a=window.workstationPreview.assess(r),j=r.job;
 $('assetId').textContent=r.id;$('deviceName').textContent=r.model;$('deviceMeta').textContent='Serial '+r.serial+' · Grade '+r.grade;
 $('jobStatus').textContent=j.status;$('grade').textContent=r.grade;
 $('specs').innerHTML=[['PROCESSOR',r.processor],['MEMORY',r.ram],['STORAGE',r.storage],['LOCATION',r.location]].map(([k,v])=>'<div class="spec"><small>'+esc(k)+'</small><b>'+esc(v)+'</b></div>').join('');
 const kpis=[['DIAGNOSTICS',a.counts.failed+' failed'],['PARTS',a.counts.parts+' outstanding'],['QC CHECKS',a.counts.qc+'/'+a.counts.totalQC],['READINESS',a.canComplete?'Ready for review':'In progress']];
 $('kpis').innerHTML=kpis.map(([k,v])=>'<div class="kpi"><small>'+esc(k)+'</small><strong>'+esc(v)+'</strong></div>').join('');
 $('nextAction').textContent=a.action;$('nextReason').textContent=a.reason;
 $('tests').innerHTML=Object.entries(r.tests).map(([id,t])=>'<div class="test"><div><b>'+esc(t.label||id)+'</b><small>'+esc(t.comment||'Verified result from demo record')+'</small></div><span class="result '+esc(t.status)+'">'+esc(t.status.toUpperCase())+'</span></div>').join('');
 $('partsCount').textContent=j.parts.length+' requirements';
 $('parts').innerHTML=j.parts.length?j.parts.map(p=>{const complete=p.fitted>=p.qty;const state=complete?'Fitted':p.received>p.fitted?'Ready to fit':p.ordered?'Ordered':'Needs ordering';const actions=complete?'':(!p.ordered?'<button data-action="order" data-part="'+esc(p.id)+'">Mark ordered</button>':p.received<p.qty?'<button data-action="receive" data-part="'+esc(p.id)+'">Record received</button>':'<button data-action="fit" data-part="'+esc(p.id)+'">Confirm fitted</button>');return '<div class="part"><div><b>'+esc(p.name)+'</b><small>'+esc(state)+' · '+p.fitted+'/'+p.qty+' fitted</small></div><div class="partbuttons">'+actions+'</div></div>';}).join(''):'<p class="muted">No outstanding parts requirements recorded.</p>';
 $('qc').innerHTML=window.workstationPreview.requiredQC.map(k=>'<label class="qcrow"><input type="checkbox" data-qc="'+esc(k)+'" '+(j.qc[k]?'checked':'')+' '+(!a.qcReady||j.status==='Completed'?'disabled':'')+'><span>'+esc(k)+'</span></label>').join('');
 $('complete').disabled=!a.canComplete;
 $('qcHelp').textContent=a.qcReady?'QC can be reviewed. Completion still needs explicit confirmation.':'Resolve parts, diagnostic failures and missing tests before QC sign-off.';
 $('notes').value=j.notes;$('notes').disabled=j.status==='Completed';
 $('timeline').innerHTML=r.events.map(e=>'<div class="event"><small>'+esc(e.at)+'</small><span>'+esc(e.text)+'</span></div>').join('');
 $('pallet').textContent=r.location;
}
$('load').onclick=()=>open($('scan').value);
$('scan').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();open($('scan').value);}};
document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>open(b.dataset.demo));
$('next').onclick=()=>{selected=null;$('scan').value='';status('Ready for next demo asset.');render();$('scan').focus();};
$('resetDemo').onclick=()=>{if(confirm('Reset all temporary demo changes?')){records=clone(DEMOS);selected=null;$('scan').value='';render();status('Demo reset. No real records were changed.');}};
$('parts').onclick=e=>{const b=e.target.closest('button[data-action]');if(b)action(b.dataset.action,b.dataset.part);};
$('qc').onchange=e=>{const input=e.target.closest('input[data-qc]'),r=current();if(!input||!r)return;const assessment=window.workstationPreview.assess(r);if(!assessment.qcReady){input.checked=false;return;}r.job.qc[input.dataset.qc]=input.checked;log(r,(input.checked?'Approved ':'Unchecked ')+input.dataset.qc+' (demo)');render();};
$('complete').onclick=()=>{const r=current();if(!r||!window.workstationPreview.assess(r).canComplete)return;if(!confirm('Demo only: approve completion for '+r.id+'? No cloud updates will occur.'))return;r.job.status='Completed';log(r,'Final completion approved (demo only)');render();};
$('saveNotes').onclick=()=>{const r=current();if(!r||r.job.status==='Completed')return;r.job.notes=$('notes').value.slice(0,2000);log(r,'Engineer note saved to demo session');render();status('Note saved in memory only.');};
render();