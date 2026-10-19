'use strict';
const fs=require('node:fs'),path=require('node:path'),labels=require('./custom-labels');
function read(file){if(!fs.existsSync(file))return {technicians:[],templates:[],revision:0,lastQa:null};const raw=JSON.parse(fs.readFileSync(file,'utf8'));return {...labels.settings(raw),revision:Number(raw.revision)||0,lastQa:raw.lastQa?labels.qa(raw.lastQa):null};}
function save(file,input){const current=read(file);if(input.expectedRevision!==current.revision)throw Error('Label settings changed. Reopen Labels & Printing before saving.');const next={...labels.settings(input),lastQa:Object.prototype.hasOwnProperty.call(input,'lastQa')?(input.lastQa===null?null:labels.qa(input.lastQa)):current.lastQa,revision:current.revision+1};fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',JSON.stringify(next,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);return next;}
module.exports={read,save};
