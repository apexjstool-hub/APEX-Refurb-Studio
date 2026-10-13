'use strict';
/** Small bounded receipt log. Never store complete intake payloads or credentials. */
const fs=require('node:fs');
const crypto=require('node:crypto');
const path=require('node:path');
const LIMIT=250;
const trim=(v,n=160)=>String(v??'').replace(/[\x00-\x1F\x7F]/g,' ').trim().slice(0,n);
function read(file){
 if(!fs.existsSync(file))return [];
 const entries=JSON.parse(fs.readFileSync(file,'utf8'));
 if(!Array.isArray(entries))throw Error('Intake verification file is invalid.');
 return entries.slice(-LIMIT);
}
function build({scope,action,assetId,label,item,reason}){
 const warnings=[];
 if(action!=='rejected' && item){
  if(!trim(item.manufacturer))warnings.push('Manufacturer missing');
  if(!trim(item.model))warnings.push('Model missing');
  if(!trim(item.serial))warnings.push('Serial missing');
 }
 return {
  eventId:crypto.randomUUID(),at:new Date().toISOString(),
  source:scope==='refurb'?'RefurbFlow':'Diagnostics',
  device:trim(label||'Legacy save-only connection',64),
  assetId:trim(assetId,80).toUpperCase(),
  outcome:action==='rejected'?'rejected':(['unchanged','ignored'].includes(action)?'unchanged':'saved'),
  action:trim(action||'updated',32),
  warnings,reason:action==='rejected'?trim(reason||'Import rejected',160):''
 };
}
function append(file,input){
 const entries=read(file);
 const event=build(input);
 entries.push(event);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(entries.slice(-LIMIT),null,2),{mode:0o600});
 fs.renameSync(temp,file);
 return event;
}
module.exports={LIMIT,read,build,append};
