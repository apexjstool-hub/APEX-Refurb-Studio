'use strict';
/* APEX Connect 1.0. All Supabase requests originate in the authenticated
   Electron main process. No service-role key, session token, or arbitrary URLs
   are exposed to the renderer. Postgres RLS remains the final authority. */
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const ASSET=/^[A-Z0-9][A-Z0-9 _./:-]{0,79}$/;
const columns='id,sender_id,recipient_id,body,asset_id,created_at';
const requestError=status=>status===404?'APEX Connect database tables are not installed. Contact the administrator.':
 status===401||status===403?'Your cloud session or messaging permissions need checking.':
 status===429?'Too many requests. Try again shortly.':'Unable to contact APEX Connect (HTTP '+status+').';
function createConnectService({cloudFetch,identity}){
 if(typeof cloudFetch!=='function'||typeof identity!=='function')throw Error('APEX Connect needs authenticated cloud transport.');
 let registeredFor='';
 const current=()=>{
  const id=identity();
  if(!id||!UUID.test(String(id.userId||''))||!id.email)return null;
  return id;
 };
 const route=(table,query)=>'/rest/v1/'+table+(query?'?'+query:'');
 async function rest(table,query='',method='GET',body){
  const headers={Accept:'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(method==='POST')headers.Prefer='return=representation';
  const res=await cloudFetch(route(table,query),{method,headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)});
  if(!res.ok)throw Error(requestError(res.status));
  return res.status===204?[]:await res.json();
 }
 async function ensureMember(me){
  if(registeredFor===me.userId)return;
  const short=String(me.email).split('@')[0].replace(/[^\p{L}\p{N} ._-]/gu,' ').trim().slice(0,80)||'APEX colleague';
  const existing=await rest('apex_connect_members','select=user_id&user_id=eq.'+me.userId+'&limit=1');
  if(!existing.length)await rest('apex_connect_members','on_conflict=user_id','POST',{user_id:me.userId,display_name:short});
  registeredFor=me.userId;
 }
 const error=e=>({ok:false,error:String(e?.message||'APEX Connect is unavailable.').slice(0,200)});
 async function list(){
  const me=current();if(!me)return {ok:false,requiresCloud:true,error:'Sign into your APEX cloud account to use team messaging.'};
  try{
   await ensureMember(me);
   const [members,latest,reads]=await Promise.all([
    rest('apex_connect_members','select=user_id,display_name&order=display_name.asc&limit=100'),
    rest('apex_connect_messages','select='+columns+'&order=id.desc&limit=200'),
    rest('apex_connect_reads','select=conversation_key,last_read_id&user_id=eq.'+me.userId+'&limit=100')
   ]);
   return {ok:true,userId:me.userId,members,latest:latest.reverse(),reads};
  }catch(e){return error(e);}
 }
 async function history(recipient){
  const me=current();if(!me)return {ok:false,error:'Sign into your cloud account to view messages.'};
  try{
   let filter='';
   if(recipient===null||recipient==='team')filter='&recipient_id=is.null';
   else{
    if(!UUID.test(String(recipient||''))||recipient===me.userId)return {ok:false,error:'Select a valid colleague.'};
    filter='&or='+encodeURIComponent('(and(sender_id.eq.'+me.userId+',recipient_id.eq.'+recipient+'),and(sender_id.eq.'+recipient+',recipient_id.eq.'+me.userId+'))');
   }
   const messages=await rest('apex_connect_messages','select='+columns+'&order=id.desc&limit=150'+filter);
   return {ok:true,messages:messages.reverse()};
  }catch(e){return error(e);}
 }
 async function send(input){
  const me=current();if(!me)return {ok:false,error:'Sign into your cloud account to send messages.'};
  const body=String(input?.body||'').trim();
  const recipient=input?.recipient===null||input?.recipient==='team'?null:String(input?.recipient||'');
  const assetId=input?.assetId?String(input.assetId).trim().toUpperCase():null;
  if(body.length<1||body.length>2000)return {ok:false,error:'Messages must contain 1–2,000 characters.'};
  if(recipient!==null&&(!UUID.test(recipient)||recipient===me.userId))return {ok:false,error:'Choose a valid colleague.'};
  if(assetId&&!ASSET.test(assetId))return {ok:false,error:'Invalid linked Asset ID.'};
  try{
   const data=await rest('apex_connect_messages','','POST',{sender_id:me.userId,recipient_id:recipient,body,asset_id:assetId});
   return {ok:true,message:data[0]||null};
  }catch(e){return error(e);}
 }
 async function read(input){
  const me=current();if(!me)return {ok:false,error:'Sign into your cloud account.'};
  const target=String(input?.recipient||'team');
  const conversation_key=target==='team'?'team':'dm:'+target.toLowerCase();
  if(conversation_key!=='team'&&(!UUID.test(target)||target===me.userId))return {ok:false,error:'Invalid conversation.'};
  const last_read_id=Number(input?.lastId);
  if(!Number.isSafeInteger(last_read_id)||last_read_id<0)return {ok:false,error:'Invalid message marker.'};
  try{
   // Read cursor is monotonic and scoped to the caller; it cannot mark
   // messages in any other staff member's account.
   const currentRows=await rest('apex_connect_reads','select=last_read_id&user_id=eq.'+me.userId+'&conversation_key=eq.'+encodeURIComponent(conversation_key));
   const last=Math.max(last_read_id,Number(currentRows[0]?.last_read_id||0));
   const data={user_id:me.userId,conversation_key,last_read_id:last,updated_at:new Date().toISOString()};
   if(currentRows.length)await rest('apex_connect_reads','user_id=eq.'+me.userId+'&conversation_key=eq.'+encodeURIComponent(conversation_key),'PATCH',data);
   else await rest('apex_connect_reads','','POST',data);
   return {ok:true,lastRead:last};
  }catch(e){return error(e);}
 }
 async function deleteMessage(input){
  const me=current();if(!me)return {ok:false,error:'Sign into your cloud account to delete a message.'};
  const messageId=Number(input?.messageId);
  if(!Number.isSafeInteger(messageId)||messageId<=0)return {ok:false,error:'Select a valid message to delete.'};
  try{
   // Scoped client-side request is additional protection. PostgreSQL RLS
   // independently requires sender_id = auth.uid() and active APEX staff.
   const res=await cloudFetch('/rest/v1/apex_connect_messages?id=eq.'+messageId+'&sender_id=eq.'+me.userId,{
    method:'DELETE',headers:{Accept:'application/json',Prefer:'return=representation'},signal:AbortSignal.timeout(12000)
   });
   if(!res.ok)throw Error(requestError(res.status));
   const removed=await res.json();
   if(!Array.isArray(removed)||removed.length!==1)return {ok:false,error:'Message was not deleted. You can delete only your own messages.'};
   return {ok:true,deletedId:messageId};
  }catch(e){return error(e);}
 }
 return Object.freeze({list,history,send,read,deleteMessage});
}
module.exports={createConnectService,UUID,ASSET};
