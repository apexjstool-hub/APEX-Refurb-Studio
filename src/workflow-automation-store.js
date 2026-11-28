'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),engine=require('./workflow-automation');
function fileFor(root,scope){return path.join(root,'workflow-automation',crypto.createHash('sha256').update(String(scope)).digest('hex')+'.json');}
function read(root,scope){try{return engine.validate(JSON.parse(fs.readFileSync(fileFor(root,scope),'utf8')));}catch(e){if(e.code==='ENOENT')return engine.empty();throw Error('Automation settings could not be read. Rules are disabled until repaired.');}}
function write(root,scope,input){const config=engine.validate(input),file=fileFor(root,scope),tmp=file+'.tmp';fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(tmp,JSON.stringify(config,null,2),{mode:0o600});fs.renameSync(tmp,file);return config;}
module.exports={read,write,fileFor};
