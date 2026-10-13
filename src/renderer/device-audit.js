'use strict';
/* Read-only projection of existing records. Never creates or modifies activity. */
(function(root){
 const category=type=>/refurbflow/i.test(type)?'refurbflow':/diagnos|test|check|inspection|quality control/i.test(type)?'diagnostics':/repair|job|part|order|delivery/i.test(type)?'repairs':'inventory';
 function collect(asset,workflow={}){
  if(!asset)return [];
  const events=[],seen=new Set();
  const add=(event,source)=>{
   if(!event||typeof event!=='object')return;
   const at=event.at;if(!at)return;
   const time=new Date(at).getTime();if(!Number.isFinite(time))return;
   const type=String(event.type||'Recorded activity'),detail=String(event.detail||'');
   const key=JSON.stringify([time,type,detail,event.by||'']);if(seen.has(key))return;seen.add(key);
   events.push({at,time,type,detail,by:String(event.by||''),source,category:category(type)});
  };
  for(const e of Array.isArray(asset.history)?asset.history:[])add(e,'Inventory record');
  for(const e of Array.isArray(workflow.audit)?workflow.audit:[])if(e&&String(e.assetId).toUpperCase()===String(asset.id).toUpperCase())add(e,'Repair workflow');
  for(const r of Array.isArray(asset.refurbishment?.reports)?asset.refurbishment.reports:[]){
   if(!r)continue;
   add({at:r.receivedAt,type:'RefurbFlow submission',detail:[r.status,r.notes,r.cosmeticIssues,r.functionalityResults,...(Array.isArray(r.repairs)?r.repairs.map(x=>`${x.name} × ${x.quantity}`):[]),r.batchId?'Batch '+r.batchId:''].filter(Boolean).join(' · ')},r.source||'RefurbFlow');
  }
  return events.sort((a,b)=>b.time-a.time);
 }
 if(typeof module==='object'&&module.exports){module.exports={collect,category};return;}
 root.ApexDeviceAudit={collect};
 const host=document.getElementById('apexAssetDetailsSection');if(!host)return;
 host.innerHTML='<div class="device-audit-heading"><div><div class="eyebrow violet">ASSET WORKSPACE</div><h2>Device Audit Trail</h2><p>Recorded inventory changes, Diagnostics submissions, RefurbFlow activity and repair progress.</p></div><span id="deviceAuditCount" role="status"></span></div><div class="device-audit-tools"><label>Search activity<input id="deviceAuditSearch" type="search" placeholder="Search changes, notes or staff" autocomplete="off"></label><label>Activity type<select id="deviceAuditFilter"><option value="all">All activity</option><option value="inventory">Inventory history</option><option value="diagnostics">Diagnostics & checks</option><option value="refurbflow">RefurbFlow</option><option value="repairs">Repairs & progress</option></select></label></div><ol id="deviceAuditTimeline" class="device-audit-timeline"></ol><p class="device-audit-foot">Newest first · Dates use this workstation’s local time. Only retained, timestamped records are shown; current values are not treated as past changes.</p>';
 const query=document.getElementById('deviceAuditSearch'),filter=document.getElementById('deviceAuditFilter');
 let previousId;
 function paint(){
  const asset=items.find(a=>a.id===activeAssetId);
  if(previousId!==activeAssetId){query.value='';filter.value='all';previousId=activeAssetId;}
  // Existing form elements are still used by Overview/save and new asset intake.
  const form=document.getElementById('assetEditor');form.classList.toggle('device-audit-existing',Boolean(asset));
  const events=collect(asset,root.ApexWorkflowSnapshot),search=query.value.trim().toLowerCase();
  const shown=events.filter(e=>(filter.value==='all'||e.category===filter.value)&&(!search||[e.type,e.detail,e.by,e.source,new Date(e.at).toLocaleString()].join(' ').toLowerCase().includes(search)));
  document.getElementById('deviceAuditCount').textContent=`${shown.length} of ${events.length} events`;
  const timeline=document.getElementById('deviceAuditTimeline');timeline.replaceChildren();
  for(const e of shown){
   const li=document.createElement('li');li.className='device-audit-event';li.dataset.category=e.category;
   const meta=document.createElement('div');meta.className='device-audit-meta';
   const time=document.createElement('time');time.dateTime=new Date(e.at).toISOString();time.textContent=new Date(e.at).toLocaleString();
   const source=document.createElement('span');source.textContent=e.source+(e.by?' · '+e.by:'');meta.append(time,source);
   const title=document.createElement('h3');title.textContent=e.type;
   const detail=document.createElement('p');detail.textContent=e.detail;li.append(meta,title,detail);timeline.append(li);
  }
  if(!shown.length){const li=document.createElement('li');li.className='device-audit-empty';li.textContent=events.length?'No activity matches your search and filter.':asset?'No timestamped activity has been recorded for this device.':'Save this new asset to start its audit trail.';timeline.append(li);}
 }
 query.addEventListener('input',paint);filter.addEventListener('change',paint);
 const baseOpen=openAsset;openAsset=function(...args){const result=baseOpen(...args);paint();return result;};
 const baseRender=render;render=function(...args){const result=baseRender(...args);if(currentPage==='asset')paint();return result;};
 root.addEventListener('apex:workflow-updated',()=>{if(currentPage==='asset')paint();});
 if(currentPage==='asset')paint();
})(typeof window==='object'?window:globalThis);
