'use strict';
const crypto=require('node:crypto');
function createAccountSecurity(deps){
 let unlockedUntil=0,failures=0,retryAt=0;
 const lock=()=>{unlockedUntil=0;return {ok:true};};
 const isUnlocked=()=>deps.authenticated()&&deps.admin()&&Date.now()<unlockedUntil;
 async function unlock(password){
  lock();if(!deps.authenticated()||!deps.admin())return {ok:false,error:'Administrator access required.'};
  if(Date.now()<retryAt)return {ok:false,error:'Too many attempts. Try again in 30 seconds.'};
  if(typeof password!=='string'||password.length>128||!password)return {ok:false,error:'Enter your administrator password.'};
  let valid=false;
  if(deps.mode()==='local'){const user=deps.localUser();const candidate=Buffer.from(deps.hash(password,user.salt),'hex'),actual=Buffer.from(user.passwordHash,'hex');valid=candidate.length===actual.length&&crypto.timingSafeEqual(candidate,actual)&&!user.mustChangePassword;}
  else{
   const current=deps.cloud();if(!current?.email||!current?.userId)return {ok:false,error:'Sign out and sign in again before opening Settings.'};
   try{
    const response=await deps.fetch(current.url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:current.anonKey,'Content-Type':'application/json'},body:JSON.stringify({email:current.email,password}),signal:AbortSignal.timeout(12000)});
    if(response.ok){const auth=await response.json();if(auth.user?.id===current.userId&&auth.access_token){
     const profile=await deps.fetch(current.url+'/rest/v1/apex_staff?select=role,active&user_id=eq.'+encodeURIComponent(current.userId),{headers:{apikey:current.anonKey,Authorization:'Bearer '+auth.access_token},signal:AbortSignal.timeout(12000)});
     if(profile.ok){const rows=await profile.json();valid=rows.length===1&&rows[0].active===true&&rows[0].role==='admin';}
    }}
   }catch{return {ok:false,error:'Cannot verify your password. Check the cloud connection.'};}
  }
  if(!valid){if(++failures>=5){failures=0;retryAt=Date.now()+30000;}return {ok:false,error:'Password incorrect or administrator access unavailable.'};}
  failures=0;unlockedUntil=Date.now()+10*60*1000;return {ok:true};
 }
 function config(){if(!isUnlocked())throw Error('Unlock Settings with your administrator password first.');const c=deps.config();if(!c?.supabaseUrl||!c.serviceRoleKey)throw Error('Manage shared accounts on the trusted hub PC after configuring APEX Cloud Sync.');const session=deps.cloud();if(deps.mode()==='cloud'&&session?.url!==c.supabaseUrl)throw Error('Cloud account and hub configuration must use the same project.');return c;}
 return {unlock,lock,isUnlocked,...createAccountManager(config,deps.fetch)};
}
function createAccountManager(config,fetch){
 async function request(c,route,method='GET',body){
  const headers={apikey:c.serviceRoleKey,'Content-Type':'application/json'};
  if(!c.serviceRoleKey.startsWith('sb_secret_'))headers.Authorization='Bearer '+c.serviceRoleKey;
  if(route.startsWith('/rest/'))headers.Prefer='return=representation';
  const r=await fetch(c.supabaseUrl+route,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
  if(!r.ok)throw Error('Cloud account operation failed (HTTP '+r.status+'). Check the hub configuration and account details.');
  return r.status===204?null:r.json();
 }
 async function list(){
  try{const c=config();const staff=await request(c,'/rest/v1/apex_staff?select=user_id,role,active&order=user_id');const users=[];
   for(let page=1;page<=100;page++){const result=await request(c,'/auth/v1/admin/users?page='+page+'&per_page=100');const rows=result.users||[];users.push(...rows);if(rows.length<100)break;}
   return {ok:true,users:staff.map(p=>{const u=users.find(u=>u.id===p.user_id);return {id:p.user_id,email:u?.email||p.user_id,name:String(u?.user_metadata?.full_name||''),role:p.role,active:p.active};})};
  }catch(e){return {ok:false,error:e.message};}
 }
 async function create(input){
  try{const c=config(),email=String(input?.email||'').trim().toLowerCase(),name=String(input?.name||'').trim();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||name.length>100)throw Error('Enter a valid name and email address.');
   if(!['staff','admin'].includes(input?.role))throw Error('Choose Staff or Administrator.');
   if(typeof input.password!=='string'||input.password.length<12||input.password.length>128)throw Error('Use a password of 12–128 characters.');
   const result=await request(c,'/auth/v1/admin/users','POST',{email,password:input.password,email_confirm:true,user_metadata:{full_name:name}}),user=result.user||result;
   if(!user.id)throw Error('Cloud did not return the new account.');
   try{await request(c,'/rest/v1/apex_staff','POST',{user_id:user.id,role:input.role,active:true});}
   catch(e){throw Error('Account created but inventory access could not be assigned. Its ID is '+user.id+'. Ask the cloud administrator to complete the staff profile.');}
   return {ok:true};
  }catch(e){return {ok:false,error:e.message};}
 }
 async function update(input){
  try{const c=config();if(!/^[0-9a-f-]{36}$/i.test(String(input?.id||''))||!['staff','admin'].includes(input.role)||typeof input.active!=='boolean')throw Error('Invalid account update.');
   const rows=await request(c,'/rest/v1/apex_staff?select=role,active&user_id=eq.'+input.id);if(rows.length!==1)throw Error('Staff profile not found.');
   if(rows[0].role==='admin'&&(input.role!=='admin'||!input.active))throw Error('Administrator accounts cannot be downgraded or disabled here. This protects administrator access.');
   await request(c,'/rest/v1/apex_staff?user_id=eq.'+input.id,'PATCH',{role:input.role,active:input.active});return {ok:true};
  }catch(e){return {ok:false,error:e.message};}
 }
 return {list,create,update};
}
module.exports={createAccountSecurity,createAccountManager};
