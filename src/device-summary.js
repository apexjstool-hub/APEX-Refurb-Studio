'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexDeviceSummary=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const num=v=>Math.max(0,Number.isFinite(Number(v))?Number(v):0);
 const respray=name=>/respray|re[ -]?spray|paint/i.test(String(name||''));
 function process(asset,workflow){
  const job=workflow?.jobs?.[asset.id];
  if(job?.status==='Completed')return {labels:['Completed'],parts:0,respray:0,known:true};
  const ref=asset.refurbishment||{},report=Array.isArray(ref.reports)?(ref.reports.find(r=>r.key===ref.latestKey)||ref.reports.at(-1)):ref;
  let requirements=job?job.parts:Array.isArray(report?.repairs)?report.repairs:Array.isArray(report?.parts)?report.parts.map(p=>typeof p==='string'?{name:p,quantity:1}:p):[];
  requirements=Array.isArray(requirements)?requirements:[];
  let parts=0,sprays=0;
  for(const p of requirements){const qty=num(p.qty??p.quantity??1),fitted=p.fitted===undefined&&p.status==='Fitted'?qty:num(p.fitted),remaining=Math.max(0,qty-fitted);if(!remaining)continue;if(respray(p.name))sprays+=remaining;else if(String(p.name||'').trim())parts+=remaining;}
  const labels=[];if(parts)labels.push('Parts fitting');if(sprays)labels.push('Respray');
  if(!labels.length)labels.push(job?(requirements.length||job.status==='Quality Control'?'Final checks / QC':'No repair tasks recorded'):workflow?'Not recorded':'Workflow loading');
  return {labels,parts,respray:sprays,known:!!job||requirements.length>0,onHold:job?.status==='On Hold'};
 }
 function grade(asset,suggestion){
  const selected=String(asset.condition??'').trim();
  if(['A','B','C','D','Excellent','Good','Fair','Not assessed'].includes(selected))return {value:selected,source:selected==='Not assessed'?'No grade recorded':'Assigned grade'};
  const value=suggestion?.grade||asset.grade;
  return value&&value!=='Pending'?{value,source:'Inspection grade'}:{value:'Not assessed',source:'No grade recorded'};
 }

 function icon(name){
  const paths={
   asset:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M9 7V4h6v3M9 16h6M12 11v5"/>',
   serial:'<path d="M3 4v16M7 6v12M10 4v16M14 6v12M17 4v16M21 6v12"/>',
   manufacturer:'<rect x="3" y="3" width="18" height="13" rx="1"/><path d="M12 16v5M7 21h10"/>',
   type:'<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/>',
   grade:'<path d="m12 2 9 5v10l-9 5-9-5V7Zm0 10 9-5M12 12 3 7M12 12v10"/>',
   status:'<path d="m12 2 10 5-10 5L2 7Zm-10 11 10 5 10-5M2 18l10 5 10-5"/>',
   location:'<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
   pallet:'<rect x="8" y="2" width="8" height="5"/><rect x="2" y="16" width="8" height="5"/><rect x="14" y="16" width="8" height="5"/><path d="M12 7v4M6 16v-5h12v5M4 4h1M19 4h1"/>',
   process:'<path d="M21 3a6 6 0 0 1-7.6 7.6L5 19a2.8 2.8 0 0 1-4-4l8.4-8.4A6 6 0 0 1 17 0l-4 4 3 3 4-4Z"/>',
   eye:'<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/><circle cx="12" cy="12" r="3"/>',
   arrow:'<path d="m9 5 7 7-7 7"/>'
  };
  return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||'')+'</svg>';
 }
 function laptop(){
  const keys=Array.from({length:4},(_,r)=>'<g class="device-key-row">'+Array.from({length:15},(_,c)=>r===3&&c>=4&&c<=9?'':'<rect x="'+(37+c*10)+'" y="'+(134+r*3.2)+'" width="8" height="2.2" rx=".5" fill="#24292e" stroke="#6c737a" stroke-width=".3"/>').join('')+(r===3?'<rect x="77" y="143.6" width="58" height="2.2" rx=".5" fill="#24292e" stroke="#6c737a" stroke-width=".3"/>':'')+'</g>').join('');
  return '<svg viewBox="0 0 220 174" role="img" aria-label="Laptop illustration"><defs><linearGradient id="apex-chassis" x2="0" y2="1"><stop stop-color="#aaaeb2"/><stop offset=".4" stop-color="#4b5259"/><stop offset="1" stop-color="#afb4b9"/></linearGradient><radialGradient id="apex-screen"><stop stop-color="#163980"/><stop offset="1" stop-color="#070e1a"/></radialGradient><linearGradient id="apex-fold" x2="1" y2="1"><stop stop-color="#67ceff"/><stop offset=".35" stop-color="#1467ef"/><stop offset=".65" stop-color="#2449cf"/><stop offset="1" stop-color="#061a69"/></linearGradient></defs><ellipse cx="110" cy="164" rx="102" ry="5" fill="#000" opacity=".4"/><rect x="29" y="18" width="164" height="112" rx="4" fill="#1c2025" stroke="#969ca2" stroke-width="1.8"/><rect x="33" y="23" width="156" height="101" fill="url(#apex-screen)"/><circle cx="111" cy="20.5" r=".9" fill="#555"/><g fill="url(#apex-fold)"><path d="M68 103C28 77 103 25 137 47C164 65 114 84 100 118Z"/><path d="M74 103C56 73 111 34 144 51C175 67 120 94 107 119Z"/><path d="M84 106C69 80 122 44 149 62C173 79 127 107 120 121Z"/><path d="M103 116C83 92 129 64 153 77C172 89 141 111 139 123Z"/><path d="M59 115C81 81 91 94 98 109C106 125 118 110 124 124H54Z"/></g><g fill="none" stroke="#71baff" opacity=".6" stroke-width="1"><path d="M70 100C49 75 106 37 140 51"/><path d="M83 105C69 82 123 48 150 65"/><path d="M106 117C91 96 130 69 153 79"/></g><path d="M29 131h164l20 26q1 5-9 6H16q-9-1-8-6Z" fill="url(#apex-chassis)" stroke="#b6bbc0" stroke-width="1"/><path d="M33 132h156l11 22H21Z" fill="#747c84"/>'+keys+'<path d="M88 150h46l5 8H83Z" fill="#8a939b" stroke="#b6bec5" stroke-width=".7"/><path d="M9 158q101 5 203 0" fill="none" stroke="#e1e4e6" stroke-width="1"/><path d="M94 162h32" stroke="#3b4249" stroke-width="2"/></svg>';
 }
 function card(asset,work,assignedGrade,escape,title){
  const fact=(label,value,type,extra='')=>'<div class="device-card-fact">'+icon(type)+'<div><small>'+label+'</small><strong '+extra+'>'+escape(value||'Not recorded')+'</strong></div></div>';
  const processed=asset.status==='Processed',status=processed?'Processed':'Awaiting process';
  return '<div class="device-card-top"><div class="device-card-art">'+laptop()+'</div><div class="device-card-main"><div class="device-card-heading"><div><h2>'+escape(title)+'</h2><span class="device-card-type">'+escape(asset.productType||'Laptop')+'</span></div><button id="assetViewFullDetails" type="button">'+icon('eye')+'<span>View Full Details</span>'+icon('arrow')+'</button></div><div class="device-card-primary">'+fact('Asset ID',asset.id,'asset')+fact('Serial Number',asset.serial,'serial')+fact('Manufacturer',asset.manufacturer,'manufacturer')+fact('Device Type',asset.productType,'type')+fact('Grade',assignedGrade.value,'grade','title="'+escape(assignedGrade.source)+'"')+'</div></div></div><div class="device-card-workflow"><div class="device-card-fact">'+icon('status')+'<div><small>Status</small><strong class="device-card-status '+(processed?'is-processed':'is-awaiting')+'"><i></i>'+status+'</strong></div></div><div class="device-card-fact">'+icon('location')+'<div><small>Location</small><strong class="device-card-location">'+escape(asset.location||'Unassigned')+'</strong></div></div>'+fact('Pallet',asset.pallet||'Not assigned','pallet')+fact('Process Required',work.labels.join(' · '),'process')+'</div>';
 }

 return {process,grade,card};
});
