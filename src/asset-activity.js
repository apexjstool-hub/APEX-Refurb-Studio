'use strict';
// Durable per-asset archive, independent of the rolling inventory/workflow windows.
const crypto=require('node:crypto');
const eventKey=e=>e.id?String(e.id):crypto.createHash('md5').update(JSON.stringify([e.at||'',e.type||'',e.detail||''])).digest('hex');
function capture(db){
 const active=new Set((db.items||[]).map(a=>a.id));
 if(!db.assetActivity||typeof db.assetActivity!=='object'||Array.isArray(db.assetActivity))db.assetActivity={};
 for(const id of active)if(!db.assetActivity[id])db.assetActivity[id]={};
 const known=new Set([...active,...Object.keys(db.assetActivity)]);
 const add=(id,e)=>{if(!known.has(id)||!e||!e.type||!Number.isFinite(Date.parse(e.at)))return;const entries=db.assetActivity[id]||(db.assetActivity[id]={});const key=eventKey(e);if(!entries[key])entries[key]=structuredClone(e);};
 for(const a of db.items||[])for(const e of a.history||[])add(a.id,e);
 for(const e of db.operations?.audit||[]){
  if(e.assetId)add(e.assetId,e);
  else for(const o of db.operations?.orders||[])if(e.detail?.includes(o.id))for(const id of new Set((o.lines||[]).map(l=>l.assetId)))add(id,{...e,assetId:id});
 }
 return db;
}
function page(db,input={}){
 const id=String(input.id||'').trim().toUpperCase();if(!(db.items||[]).some(a=>a.id===id))return {ok:false,error:'Asset not found.'};
 capture(db);const limit=Math.max(1,Math.min(200,Number(input.limit)||100));
 const rows=Object.entries(db.assetActivity[id]||{}).map(([key,event])=>({key,at:new Date(event.at).toISOString(),event})).sort((a,b)=>b.at.localeCompare(a.at)||b.key.localeCompare(a.key));
 const before=input.cursor;const filtered=before?rows.filter(r=>r.at<before.at||(r.at===before.at&&r.key<before.key)):rows;
 const picked=filtered.slice(0,limit),last=picked.at(-1);
 return {ok:true,events:picked.map(r=>r.event),nextCursor:filtered.length>limit?{at:last.at,key:last.key}:null};
}
module.exports={capture,page,eventKey};
