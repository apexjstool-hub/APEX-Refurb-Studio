// APEX Cloud Connect 3.2: public-key approval, never exposed to HTML injection.
(()=>{'use strict';
 const get=id=>document.getElementById(id);
 const message=s=>{const x=get('apexPortableManagementResult');if(x)x.textContent=s;};
 const hiddenKey='apex-hidden-revoked-ssd-ids';
 function hiddenDevices(){
  try{return new Set(JSON.parse(localStorage.getItem(hiddenKey)||'[]'));}catch{return new Set();}
 }
 const list=async()=>{
  const root=get('apexPortableDeviceList');if(!root)return;
  const r=await window.apexInventory?.portableDevices?.();
  root.replaceChildren();if(!r?.ok){message(r?.error||'Unable to list authorised SSDs.');return;}
  const hidden=hiddenDevices();
  const devices=(r.devices||[]).filter(d=>!d.revoked_at||!hidden.has(d.device_id));
  for(const d of devices){
   const line=document.createElement('div');line.className='apex-cloud-panel';
   const name=document.createElement('strong');name.textContent=String(d.label||'Portable SSD');line.append(name);
   const state=document.createElement('p');state.textContent=(d.revoked_at?'Revoked':'Authorised')+' · '+String(d.device_id||'')+' · Last sync: '+(d.last_used_at||'Not yet');line.append(state);
   if(!d.revoked_at){const revoke=document.createElement('button');revoke.type='button';revoke.textContent='Revoke access';revoke.className='secondary';revoke.addEventListener('click',async()=>{
    if(!window.await apexConfirm('Revoke this SSD? Future signed cloud uploads will be blocked.'))return;
    const result=await window.apexInventory?.portableRevoke?.(d.device_id);message(result?.ok?'SSD revoked.':result?.error||'Revoke failed');if(result?.ok)await list();
   });line.append(revoke);}else{
    const remove=document.createElement('button');
    remove.type='button';remove.className='secondary';remove.textContent='Remove from list';
    remove.addEventListener('click',()=>{
     hidden.add(d.device_id);
     try{localStorage.setItem(hiddenKey,JSON.stringify([...hidden]));}
     catch{message('Could not save the SSD list on this PC.');return;}
     line.remove();
     if(!root.children.length)root.textContent='No portable SSDs to display.';
     message('Revoked SSD removed from the list on this PC.');
    });
    line.append(remove);
   }
   root.append(line);
  }
  if(!devices.length)root.textContent='No portable SSDs to display.';
 };
 document.addEventListener('DOMContentLoaded',()=>{
  get('apexPortableRefreshBtn')?.addEventListener('click',list);
  get('apexPortableApproveBtn')?.addEventListener('click',async()=>{
   const code=get('apexPortableApproveCode')?.value?.trim();if(!code){message('Paste your SSD public approval code.');return;}
   message('Checking administrator approval…');const r=await window.apexInventory?.portableApprove?.(code);
   message(r?.ok?'SSD approved. You can now use Diagnostics on another laptop.':r?.error||'Approval failed');
   if(r?.ok){get('apexPortableApproveCode').value='';await list();}
  });
 });
})();
