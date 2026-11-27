'use strict';
const fs=require('node:fs'),path=require('node:path');
const filename=root=>path.join(root,'apex-ui-layout.json');
const valid=value=>value==='classic'||value==='evolution';
function read(root){try{const v=JSON.parse(fs.readFileSync(filename(root),'utf8')).layout;return valid(v)?v:'evolution';}catch{return 'evolution';}}
function write(root,layout){if(!valid(layout))return {ok:false,error:'Unknown interface design.'};fs.mkdirSync(root,{recursive:true});const file=filename(root),tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify({layout}),{mode:0o600});fs.renameSync(tmp,file);return {ok:true,layout};}
module.exports={read,write,valid};
