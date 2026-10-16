'use strict';
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./microdream-template'):root.ApexMicrodreamTemplate);if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexMicrodreamDocuments=api;})(typeof globalThis!=='undefined'?globalThis:this,function(template){
 const clean=v=>String(v??'').trim().replace(/\s+/g,' '),key=v=>clean(v).toLowerCase();
 const isLocation=v=>key(v).replace(/\s/g,'')==='microdream';
 const escape=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function fullModel(a){const model=clean(a.model),maker=clean(a.manufacturer);if(!model)throw Error('Device '+a.id+' has no model. Add its model before creating the document.');return maker&&!key(model).startsWith(key(maker)+' ')?maker+' '+model:model;}
 function select(data,input={}){
  if(!Array.isArray(input.palletNames)||!input.palletNames.length||input.palletNames.length>300)throw Error('Select between 1 and 300 Microdream pallets.');
  const names=[...new Set(input.palletNames.map(key))];if(names.some(n=>!n))throw Error('Invalid pallet selection.');
  const selected=names.map(n=>{const pallet=(data.pallets||[]).find(p=>key(p.name)===n);if(!pallet||!isLocation(pallet.storageLocation))throw Error('A selected pallet is no longer in Microdream. Refresh the location and select again.');return pallet;}).sort((a,b)=>a.name.localeCompare(b.name,'en-GB',{numeric:true}));
  const seen=new Set(),assets=(data.items||[]).filter(a=>{if(a.deletedAt||!names.includes(key(a.pallet))||seen.has(key(a.id)))return false;seen.add(key(a.id));return true;}).sort((a,b)=>String(a.id).localeCompare(String(b.id),'en-GB',{numeric:true}));
  if(!assets.length)throw Error('The selected pallets contain no active devices.');
  const groups=new Map(),fingerprint=[];
  for(const a of assets){const model=fullModel(a),type=clean(a.productType)||clean(a.category)||'Laptop',k=JSON.stringify([key(type),key(model)]);if(!groups.has(k))groups.set(k,{type,model,language:'Reprint UK',comment:'Full respray',quantity:0,received:''});groups.get(k).quantity++;fingerprint.push([String(a.id),key(a.pallet),type,model]);}
  const jobRef=String(input.jobRef??'').trim();if(jobRef.length>100||/[\x00-\x1f\x7f]/.test(jobRef))throw Error('Job Ref must be a single line of 100 characters or fewer.');
  const rows=[...groups.values()].sort((a,b)=>a.model.localeCompare(b.model,'en-GB',{numeric:true})||a.type.localeCompare(b.type,'en-GB'));
  return {jobRef,palletNames:selected.map(p=>p.name),total:assets.length,rows,fingerprint:JSON.stringify([selected.map(p=>[p.name,p.storageLocation]),fingerprint])};
 }
 function pages(rows){const result=[];let page=[],height=0;for(const row of rows){const h=Math.max(11,Math.max(Math.ceil(row.model.length/34),Math.ceil(row.type.length/15))*4.6+5);if(page.length&&(page.length>=5||height+h>66)){result.push(page);page=[];height=0;}page.push(row);height+=h;}if(page.length)result.push(page);return result;}
 function markup(doc){
  const chunks=pages(doc.rows),address=lines=>lines.map(escape).join('<br>');
  return chunks.map((rows,i)=>{const blanks=rows.every(r=>r.model.length<100&&r.type.length<40)?Math.max(0,5-rows.length):0;
   return '<section class="microdream-sheet"><header class="md-header"><div class="md-delivery"><img alt="MicroDream Certified Refurbished" src="'+template.logo+'"><div><b>Delivery address:</b><br>'+address(template.delivery)+'</div></div><div><b>Job Ref #</b><p class="md-job-ref">'+escape(doc.jobRef)+'</p></div><div><b>Customer billing address:</b><br>'+address(template.billing)+'</div><div><b>Delivery address (if different from billing):</b></div></header><h1>Job Details / Delivery Note</h1><table class="md-items"><colgroup><col class="md-type"><col class="md-model"><col class="md-language"><col class="md-comment"><col class="md-qty"><col class="md-qty"></colgroup><thead><tr><th>Type</th><th>Model</th><th>Language to Reprint<span class="md-star">*</span></th><th>Comment</th><th>QTY Sent</th><th>QTY Received</th></tr></thead><tbody>'+rows.map(r=>'<tr class="md-model-row"><td><strong>'+escape(r.type)+'</strong></td><td>'+escape(r.model)+'</td><td>Reprint UK</td><td>Full respray</td><td class="md-number">'+r.quantity+'</td><td></td></tr>').join('')+Array.from({length:blanks},()=>'<tr class="md-blank"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>').join('')+'</tbody></table><div class="md-signature"><p><b>Signed:</b></p><p><b>Date:</b></p></div><footer><p><span class="md-star">*</span> Apply for keyboards only</p>'+(chunks.length>1?'<small>Page '+(i+1)+' of '+chunks.length+'</small>':'')+'</footer></section>';
  }).join('');
 }
 return {isLocation,select,markup,pages};
});
