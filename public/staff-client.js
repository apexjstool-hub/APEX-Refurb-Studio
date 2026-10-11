const cfg=window.APEX_CLOUD_CONFIG||{};
const el=id=>document.getElementById(id);
let token='',items=[],editing=null,refreshTimer;
const msg=s=>el('msg').textContent=s;
const valid=()=>/^https:\/\/[-\w]+\.supabase\.co$/.test(cfg.url||'')&&typeof cfg.anonKey==='string'&&cfg.anonKey.length>20;
async function request(path,{method='GET',body,auth=true,query=''}={}){
 const r=await fetch(cfg.url+'/rest/v1/'+path+query,{method,headers:{apikey:cfg.anonKey,...(auth?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json',Prefer:'return=representation'}:{})},body:body?JSON.stringify(body):undefined});
 if(!r.ok)throw Error((await r.json().catch(()=>({}))).message||'Cloud error '+r.status);
 return r.status===204?null:r.json();
}
function logout(){token='';items=[];editing=null;clearInterval(refreshTimer);el('app').style.display='none';el('login').hidden=false;el('signout').hidden=true;el('password').value='';}
async function login(){
 if(!valid())return msg('Administrator must configure cloud-config.js first.');
 try{
 const r=await fetch(cfg.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:cfg.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:el('email').value,password:el('password').value})});
 const a=await r.json();if(!r.ok||!a.access_token)throw Error(a.error_description||a.msg||'Login failed');
 token=a.access_token;
 const staff=await request('apex_staff?select=user_id,active&user_id=eq.'+encodeURIComponent(a.user.id));
 if(!staff.length||!staff[0].active)throw Error('Account is not authorised for APEX.');
 el('login').hidden=true;el('app').style.display='block';el('signout').hidden=false;msg('Connected to APEX cloud');await refresh();
 refreshTimer=setInterval(()=>{if(!document.hidden&&!editing)refresh(true).catch(e=>msg(e.message));},12000);
 }catch(e){logout();msg(e.message);}
}
async function refresh(silent=false){
 if(!token)return;
 const results=await request('apex_assets?select=id,payload,revision&order=updated_at.desc&limit=1000');items=results;
 render();window.apexDashboardUpdate?.(items);if(!silent)msg('Inventory updated.');
}
function render(){const term=el('search').value.trim().toLowerCase();const rows=items.filter(x=>[x.id,x.payload.model,x.payload.serial].some(v=>String(v||'').toLowerCase().includes(term)));
 el('count').textContent=rows.length+' of '+items.length+' assets';el('rows').replaceChildren();
 for(const a of rows){const tr=document.createElement('tr');for(const k of ['id','model','serial','location','status']){const td=document.createElement('td');td.textContent=k==='id'?a.id:a.payload[k]||'—';tr.append(td)}
 const td=document.createElement('td'),btn=document.createElement('button');btn.textContent='Edit';btn.className='secondary';btn.addEventListener('click',()=>openEdit(a.id));td.append(btn);tr.append(td);el('rows').append(tr);}}
function openEdit(id){editing=items.find(a=>a.id===id);if(!editing)return;el('assetTitle').textContent=id;el('editor').hidden=false;for(const name of ['model','manufacturer','serial','location','status','condition','notes'])el('edit').elements[name].value=editing.payload[name]||'';document.querySelector('[data-page=inventory]').click();el('editor').scrollIntoView({behavior:'smooth'});}
async function save(e){e.preventDefault();if(!editing)return;const data=Object.fromEntries(new FormData(el('edit')));if(!data.model.trim()||!data.location.trim())return msg('Model and location required.');
 try{
 // Atomic check/commit on server: rejects a stale revision instead of overwriting a colleague.
 const r=await fetch(cfg.url+'/rest/v1/rpc/apex_update_asset',{method:'POST',headers:{apikey:cfg.anonKey,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({p_id:editing.id,p_expected_revision:editing.revision,p_patch:data})});
 if(!r.ok)throw Error((await r.json().catch(()=>({}))).message||'Update rejected');
 editing=null;el('editor').hidden=true;await refresh(true);msg('Saved to cloud. Local hub sync depends on the bridge running.');
 }catch(err){msg(err.message+' Refresh to review newer changes.');}
}
el('signin').addEventListener('click',login);el('signout').addEventListener('click',()=>{logout();msg('Signed out');});el('refresh').addEventListener('click',()=>refresh().catch(e=>msg(e.message)));el('search').addEventListener('input',render);el('edit').addEventListener('submit',save);el('cancel').addEventListener('click',()=>{editing=null;el('editor').hidden=true;});
if(!valid())msg('Cloud is not configured yet. See README.');
