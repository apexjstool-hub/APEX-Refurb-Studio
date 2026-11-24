// APEX Cloud Connect 3.2 — signed, single-use, upload-only credentials.
// Deploy with verify_jwt=false: requests are authenticated by this handler, not anonymously trusted.
// SUPABASE_SERVICE_ROLE_KEY must ONLY exist in Edge Function environment.
import {createClient} from 'npm:@supabase/supabase-js@2';
const hdr={'content-type':'application/json','cache-control':'no-store'};
const response=(status:number, data:unknown)=>new Response(JSON.stringify(data),{status,headers:hdr});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const asset=/^[A-Z0-9][A-Z0-9 _./:-]{1,79}$/;
function bytesB64(s:string){return Uint8Array.from(atob(s),c=>c.charCodeAt(0));}
function pemToBytes(pem:string){const b64=pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g,'');return bytesB64(b64);}
async function digest(x:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
async function verify(publicPem:string,message:string,sig:string){try{
 if(sig.length>180)return false;
 const key=await crypto.subtle.importKey('spki',pemToBytes(publicPem),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 return await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,bytesB64(sig),new TextEncoder().encode(message));
}catch{return false;}}
Deno.serve(async(req)=>{
 try{
  if(req.method!=='POST')return response(405,{ok:false,error:'POST required'});
  const raw=await req.text();if(raw.length>300000)return response(413,{ok:false,error:'Request too large'});
  const body=JSON.parse(raw);if(!body||Array.isArray(body)||typeof body!=='object')return response(400,{ok:false,error:'Invalid body'});
  const action=String(body.action||'');
  const url=Deno.env.get('SUPABASE_URL'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!secret)return response(503,{ok:false,error:'Portable cloud service not configured'});
  const db=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
  if(action.startsWith('admin-')){
   const auth=req.headers.get('authorization')||'';if(!auth.startsWith('Bearer '))return response(401,{ok:false,error:'Administrator login required'});
   const {data:{user},error:e}=await db.auth.getUser(auth.slice(7));if(e||!user)return response(401,{ok:false,error:'Invalid staff login'});
   const {data:staff,error:se}=await db.from('apex_staff').select('role,active').eq('user_id',user.id).maybeSingle();
   if(se||!staff?.active||staff.role!=='admin')return response(403,{ok:false,error:'Cloud administrator required'});
   if(action==='admin-list'){
    const {data,error}=await db.from('apex_portable_devices').select('device_id,label,created_at,revoked_at,last_used_at').order('created_at',{ascending:false}).limit(100);
    return error?response(500,{ok:false,error:'Unable to list SSDs'}):response(200,{ok:true,devices:data});
   }
   if(action==='admin-approve'){
    const data=body.device;
    if(!data||!uuid.test(String(data.deviceId||''))||!/^-----BEGIN PUBLIC KEY-----\n[A-Za-z0-9+/=\n]+\n-----END PUBLIC KEY-----\n?$/.test(String(data.publicKey||''))||String(data.publicKey).length>1000)return response(400,{ok:false,error:'Invalid SSD approval code'});
    const label=String(data.label||'APEX Portable SSD').trim().slice(0,80);if(!label)return response(400,{ok:false,error:'SSD label required'});
    const {data:old}=await db.from('apex_portable_devices').select('device_id').eq('device_id',data.deviceId).maybeSingle();
    if(old)return response(409,{ok:false,error:'SSD already enrolled; revoke it rather than replacing its key'});
    const {error}=await db.from('apex_portable_devices').insert({device_id:data.deviceId,label,public_key:data.publicKey,created_by:user.id});
    return error?response(400,{ok:false,error:'Approval failed'}):response(200,{ok:true});
   }
   if(action==='admin-revoke'){
    if(!uuid.test(String(body.deviceId||'')))return response(400,{ok:false,error:'Invalid SSD identity'});
    const {error}=await db.from('apex_portable_devices').update({revoked_at:new Date().toISOString()}).eq('device_id',body.deviceId).is('revoked_at',null);
    return error?response(500,{ok:false,error:'Revoke failed'}):response(200,{ok:true});
   }
   return response(400,{ok:false,error:'Unknown action'});
  }
  if(!uuid.test(String(body.deviceId||'')))return response(400,{ok:false,error:'Invalid SSD identity'});
  const {data:device,error:de}=await db.from('apex_portable_devices').select('device_id,public_key,revoked_at').eq('device_id',body.deviceId).maybeSingle();
  if(de)return response(503,{ok:false,error:'Device lookup unavailable'});
  if(!device||device.revoked_at)return response(403,{ok:false,error:'SSD not authorised or access revoked'});
  if(action==='challenge'){
   // Limit outstanding challenges to mitigate database resource abuse.
   const cutoff=new Date(Date.now()-60000).toISOString();
   const {count,error:rateError}=await db.from('apex_portable_challenges').select('nonce',{count:'exact',head:true}).eq('device_id',body.deviceId).gte('created_at',cutoff);
   if(rateError)return response(503,{ok:false,error:'Challenge limit unavailable'});
   if((count||0)>=12)return response(429,{ok:false,error:'Too many connection checks; retry shortly'});
   const nonce=crypto.randomUUID();const {error}=await db.from('apex_portable_challenges').insert({nonce,device_id:body.deviceId,expires_at:new Date(Date.now()+45000).toISOString()});
   return error?response(503,{ok:false,error:'Challenge failed'}):response(200,{ok:true,nonce});
  }
  if(!['ping','upload'].includes(action)||!uuid.test(String(body.nonce||'')))return response(400,{ok:false,error:'Invalid signed request'});
  const eventId=String(body.eventId||''),assetId=String(body.assetId||'').trim().toUpperCase();
  if(action==='upload'&&(!/^[A-Za-z0-9_.:-]{12,120}$/.test(eventId)||!asset.test(assetId)||!body.report||Array.isArray(body.report)||typeof body.report!=='object'||String(body.report.assetId||body.report.id||'').toUpperCase()!==assetId))return response(400,{ok:false,error:'Invalid diagnostic report'});
  const payload=action==='upload'?JSON.stringify(body.report):'';
  if(payload.length>260000)return response(413,{ok:false,error:'Report too large'});
  const message=`APEX-PORTABLE-V1\n${action}\n${body.deviceId}\n${body.nonce}\n${eventId}\n${assetId}\n${await digest(payload)}`;
  if(!await verify(device.public_key,message,String(body.signature||'')))return response(401,{ok:false,error:'Invalid SSD signature'});
  // Atomic consume, prevents replay. A failed write requires a new challenge.
  const {data:used,error:ce}=await db.from('apex_portable_challenges').update({used_at:new Date().toISOString()}).eq('nonce',body.nonce).eq('device_id',body.deviceId).is('used_at',null).gt('expires_at',new Date().toISOString()).select('nonce');
  if(ce||!used||used.length!==1)return response(409,{ok:false,error:'Challenge expired or already used'});
  if(action==='ping')return response(200,{ok:true,connected:true,mode:'portable-cloud'});
  const {data,error}=await db.rpc('apex_receive_device_intake',{p_source:'diagnostics',p_event_id:eventId,p_asset_id:assetId,p_report:body.report});
  if(error)return response(error.code==='22023'?400:error.code==='42501'?403:409,{ok:false,error:'Intake rejected',code:error.code});
  await db.from('apex_portable_devices').update({last_used_at:new Date().toISOString()}).eq('device_id',body.deviceId);
  return response(200,data);
 }catch{return response(400,{ok:false,error:'Invalid request or service error'});}
});
