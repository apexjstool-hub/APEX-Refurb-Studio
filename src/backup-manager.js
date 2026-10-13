'use strict';
/** Protected filesystem snapshots. Does not restore or send data to any external service. */
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const INTERVAL=24*60*60*1000;
const KEEP=14;
function timestamp(d=new Date()){return d.toISOString().replace(/[:.]/g,'-');}
function list(directory){
 if(!fs.existsSync(directory))return [];
 return fs.readdirSync(directory,{withFileTypes:true}).filter(d=>d.isDirectory()&&/^backup-\d{4}-/.test(d.name))
  .sort((a,b)=>b.name.localeCompare(a.name)).map(d=>({name:d.name,path:path.join(directory,d.name)}));
}
function details(root){
 const directory=path.join(root,'backups');const backups=list(directory);
 const valid=backups.map(b=>{
  try{const m=JSON.parse(fs.readFileSync(path.join(b.path,'manifest.json'),'utf8'));
    return {name:b.name,at:m.createdAt,files:m.files.length};
  }catch{return null;}
 }).filter(Boolean);
 return {directory,last:valid[0]||null,count:valid.length,intervalHours:24};
}
function snapshot({root,files,reason='manual',now=new Date(),keep=KEEP}){
 if(!root||!Array.isArray(files)||!files.length)throw Error('Backup configuration is incomplete.');
 const directory=path.join(root,'backups');fs.mkdirSync(directory,{recursive:true,mode:0o700});
 try{fs.chmodSync(directory,0o700);}catch{}
 let final=path.join(directory,'backup-'+timestamp(now));let suffix=0;
 while(fs.existsSync(final)||fs.existsSync(final+'-incomplete'))final=path.join(directory,'backup-'+timestamp(now)+'-'+String(++suffix).padStart(2,'0'));
 const tmp=final+'-incomplete';
 fs.mkdirSync(tmp,{mode:0o700});
 try{
  const manifest={format:'apex-snapshot-1',createdAt:now.toISOString(),reason,files:[]};
  for(const file of files){
   if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(file.name))throw Error('Invalid backup file name.');
   if(!fs.existsSync(file.path)){
    if(file.required!==false)throw Error(`Required backup file is missing: ${file.name}`);
    continue;
   }
   const bytes=fs.readFileSync(file.path);
   if(file.name.endsWith('.json'))JSON.parse(bytes.toString('utf8'));
   const out=path.join(tmp,file.name);fs.writeFileSync(out,bytes,{mode:0o600,flag:'wx'});
   const digest=crypto.createHash('sha256').update(bytes).digest('hex');
   if(crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex')!==digest)throw Error(`Backup verification failed for ${file.name}`);
   manifest.files.push({name:file.name,bytes:bytes.length,sha256:digest});
  }
  if(!manifest.files.length)throw Error('No files to back up.');
  fs.writeFileSync(path.join(tmp,'manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600,flag:'wx'});
  fs.renameSync(tmp,final);
  list(directory).slice(keep).forEach(entry=>fs.rmSync(entry.path,{recursive:true,force:true}));
  return {name:path.basename(final),at:manifest.createdAt,fileCount:manifest.files.length,directory};
 }catch(error){fs.rmSync(tmp,{recursive:true,force:true});throw error;}
}
function due(root,now=new Date()){
 const last=details(root).last;
 return !last||!Number.isFinite(Date.parse(last.at))||now.getTime()-Date.parse(last.at)>=INTERVAL;
}
function verify(folder){
 const manifest=JSON.parse(fs.readFileSync(path.join(folder,'manifest.json'),'utf8'));
 if(manifest.format!=='apex-snapshot-1'||!Array.isArray(manifest.files)||!manifest.files.length)throw Error('Unrecognized snapshot.');
 for(const f of manifest.files){
  if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(f.name))throw Error('Unsafe filename.');
  const bytes=fs.readFileSync(path.join(folder,f.name));
  if(bytes.length!==f.bytes||crypto.createHash('sha256').update(bytes).digest('hex')!==f.sha256)throw Error('Backup verification failed: '+f.name);
 }
 return manifest;
}
module.exports={snapshot,details,due,verify};
