'use strict';
(function(){
 const el=id=>document.getElementById(id);
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const palette=['#2476e5','#8c68d8','#ed9b39','#22a579','#6c879e'];
 function go({location='',pallet='',repair='',status='All statuses'}={}){
  if(!setPage('inventory'))return;
  for(const id of ['inventorySearch','gradeFilter','locationFilter','palletFilter','repairFilter'])if(el(id))el(id).value='';
  if(el('statusFilter'))el('statusFilter').value=status;
  if(location)el('locationFilter').value=location;
  if(pallet)el('palletFilter').value=pallet;
  if(repair)el('repairFilter').value=repair;
  inventoryPageIndex=0;render();
 }
 function paint(){
  const dash=el('v34Dashboard');if(!dash||!window.ApexInventoryWorkflow||dash.querySelector('.dashboard-repair-strip'))return;
  dash.classList.add('dashboard-visual-upgrade');
  const wf=window.ApexWorkflowSnapshot,lookup=window.ApexInventoryWorkflow.index(wf||{}),assets=new Map(items.map(a=>[a.id,a]));
  const live=[...lookup].filter(([id])=>assets.has(id));
  const active=items.filter(a=>lookup.has(a.id)?lookup.get(a.id).key!=='completed':a.status!=='Processed').length;
  const completed=items.length-active;
  const pending=live.filter(([,s])=>s.key!=='completed').reduce((n,[,s])=>n+s.parts.reduce((q,p)=>q+Math.max(0,p.required-p.fitted),0),0);
  const required=live.reduce((n,[,s])=>n+s.required,0);
  const stats=[['Total Devices',items.length,'Registered devices'],['In Refurbishment',active,'Devices still in progress'],['Completed',completed,'Completed devices'],['Parts Needed',wf?pending:'—',wf?'Units still to fit':'Workflow loading']];
  const cards=dash.querySelectorAll('.v34-stat');cards.forEach((card,i)=>{
   card.querySelector('small').textContent=stats[i][0];card.querySelector('b').textContent=stats[i][1];
   card.insertAdjacentHTML('beforeend','<small class="dashboard-card-hint">'+esc(stats[i][2])+'</small>');
  });
  // Native buttons provide accessible shortcuts; the existing four cards stay in place.
  cards.forEach((card,i)=>{const b=document.createElement('button');b.type='button';b.className=card.className;b.innerHTML=card.innerHTML;b.setAttribute('aria-label',stats[i][0]+': '+stats[i][1]+'. View devices');card.replaceWith(b);b.onclick=()=>{
    if(i===0)go();else setPage(i===1?'refurbJobs':i===2?'completed':'parts');
   };});
  const locations=new Map(managedLocations.map(name=>[name,{name,count:0,location:name}]));
  for(const a of items){const name=a.pallet?'Pallet: '+a.pallet:a.location||'Unassigned';if(!locations.has(name))locations.set(name,{name,count:0,...(a.pallet?{pallet:a.pallet}:{location:name})});locations.get(name).count++;}
  const groups=[...locations.values()].sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name)),total=items.length;
  const nonempty=groups.filter(g=>g.count),slices=[];let value=0;for(const g of nonempty){const start=value;value+=g.count/Math.max(1,total)*100;slices.push(palette[groups.indexOf(g)%palette.length]+' '+start+'% '+value+'%');}
  const ring=dash.querySelector('.v34-donut');if(ring){ring.style.setProperty('background','conic-gradient('+ (slices.join(',')||'var(--panel2) 0% 100%') +')','important');ring.setAttribute('role','img');ring.setAttribute('aria-label',total+' devices by location and pallet');}
  const legend=dash.querySelector('.v34-location-legend');if(legend){legend.innerHTML=groups.slice(0,6).map((g,i)=>'<button class="v34-legend-row" type="button" data-dash-assignment="'+i+'"><i style="background:'+palette[i%palette.length]+'"></i><span>'+esc(g.name)+'</span><b>'+g.count+'</b><span class="dashboard-location-meter"><i style="width:'+Math.round(g.count/Math.max(1,total)*100)+'%;background:'+palette[i%palette.length]+'"></i></span></button>').join('')||'<span>No locations yet</span>';legend.querySelectorAll('[data-dash-assignment]').forEach(b=>b.onclick=()=>go(groups[Number(b.dataset.dashAssignment)]));}
  const counts=[items.filter(a=>a.status!=='Processed').length,active,completed,pending];
  dash.querySelectorAll('.v34-progress-row').forEach((row,i)=>{row.querySelector('b').textContent=i===3&&!wf?'—':counts[i];const bar=row.querySelector('div i');bar.style.setProperty('width',Math.min(100,Math.round(counts[i]/Math.max(1,i===3?required:total)*100))+'%','important');bar.parentElement.setAttribute('role','progressbar');bar.parentElement.setAttribute('aria-label',i===3?'Required units still to fit':row.querySelector('span').textContent);bar.parentElement.setAttribute('aria-valuenow',Math.min(counts[i],i===3?required:total));bar.parentElement.setAttribute('aria-valuemax',Math.max(1,i===3?required:total));bar.parentElement.setAttribute('aria-valuemin','0');});
  const stages=[['Needs ordering','order'],['Parts ordered','delivery'],['Ready to fit','fit'],['Awaiting QC','qc']];
  const stageCount=key=>live.filter(([,s])=>!['hold','completed'].includes(s.key)&&(key==='fit'?s.toFit>0:key==='order'?s.needsOrdering>0:key==='delivery'?s.awaitingDelivery>0:s.key===key)).length;
  const panel=document.createElement('section');panel.className='dashboard-repair-strip';panel.setAttribute('aria-label','Repair stage shortcuts');panel.innerHTML=stages.map(([label,key])=>'<button type="button" data-dash-stage="'+key+'"><span class="dashboard-stage-dot stage-'+key+'"></span><span>'+label+'</span><b>'+ (wf?stageCount(key):'—') +'</b></button>').join('');
  dash.querySelector('.v34-stat-grid').after(panel);panel.querySelectorAll('[data-dash-stage]').forEach(b=>b.onclick=()=>go({repair:b.dataset.dashStage}));
  const table=dash.querySelector('.v34-recent table');if(table){const th=document.createElement('th');th.textContent='Repair progress';table.tHead.rows[0].insertBefore(th,table.tHead.rows[0].lastElementChild);for(const row of table.tBodies[0].rows){const b=row.querySelector('[data-v34-open]');if(!b){row.cells[0].colSpan=5;continue;}const summary=lookup.get(b.dataset.v34Open),cell=document.createElement('td');cell.className='dashboard-recent-progress';cell.innerHTML=summary?'<span>'+esc(summary.stage)+'</span>'+ (summary.required?'<div class="dashboard-mini-track" role="progressbar" aria-label="Fitted parts" aria-valuenow="'+Math.min(summary.fitted,summary.required)+'" aria-valuemin="0" aria-valuemax="'+summary.required+'"><i style="width:'+Math.min(100,summary.fitted/summary.required*100)+'%"></i></div><small>'+summary.fitted+' / '+summary.required+' fitted</small>':'') :'<span class="section-note">'+(wf?'No refurb job':'Workflow loading')+'</span>';row.insertBefore(cell,row.lastElementChild);const a=assets.get(b.dataset.v34Open);if(a?.pallet)row.lastElementChild.textContent=a.pallet;}}
 }
 const previousRender=render;render=function(...args){const out=previousRender(...args);paint();return out;};
 window.addEventListener('apex:workflow-updated',paint);
 window.ApexDashboardVisuals={paint};
 paint();
})();

