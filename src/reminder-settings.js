'use strict';
const fs=require('node:fs');
const path=require('node:path');
const defaults=Object.freeze({enabled:true,popup:true,attention:7,overdue:14,critical:30,respray:7,repair:7,ordering:3,delivery:10,pallet:14});
function validate(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid reminder configuration.');
 const out={};
 for(const [key,value] of Object.entries(defaults)){
  if(typeof value==='boolean'){if(typeof input[key]!=='boolean')throw Error('Invalid '+key+' setting.');out[key]=input[key];}
  else {const n=Number(input[key]);if(!Number.isSafeInteger(n)||n<1||n>365)throw Error(key+' must be 1–365 days.');out[key]=n;}
 }
 if(!(out.attention<out.overdue&&out.overdue<out.critical))throw Error('Attention must be earlier than overdue, and overdue earlier than critical.');
 return out;
}
function read(file){
 try{return validate({...defaults,...JSON.parse(fs.readFileSync(file,'utf8'))});}
 catch{return {...defaults};}
}
function write(file,input){
 const settings=validate(input);
 fs.mkdirSync(path.dirname(file),{recursive:true});
 const temp=file+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(settings,null,2),{mode:0o600});
 fs.renameSync(temp,file);
 return settings;
}
module.exports={defaults,read,write,validate};
