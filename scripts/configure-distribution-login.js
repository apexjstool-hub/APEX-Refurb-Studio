#!/usr/bin/env node
'use strict';
// Run ONCE on administrator's trusted build PC BEFORE distributing a build.
// Only public Supabase settings belong in the resulting files.
const fs=require('node:fs');
const path=require('node:path');
const readline=require('node:readline');
const root=path.resolve(__dirname,'..');
const dest=path.join(root,'src','cloud-login-distribution.json');
function validate(url,key){
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))throw Error('Project URL must be https://<project>.supabase.co');
 if(!/^sb_publishable_[A-Za-z0-9_-]{12,}$/.test(key)&&!/^eyJ[A-Za-z0-9._-]{40,}$/.test(key))throw Error('Use a publishable/anon key only. NEVER enter a secret/service-role key.');
}
if(process.argv.includes('--check')){
 try{
  const saved=JSON.parse(fs.readFileSync(dest,'utf8'));
  validate(String(saved.url||''),String(saved.anonKey||''));
  console.log('Cloud staff sign-in: public distribution settings verified.');
  process.exit(0);
 }catch(e){console.error('BUILD BLOCKED: Cloud staff login is not configured. From the Studio folder run: node scripts/configure-distribution-login.js ('+e.message+')');process.exit(1);}
}
const rl=readline.createInterface({input:process.stdin,output:process.stdout});
const ask=q=>new Promise(resolve=>rl.question(q,resolve));
(async()=>{
 try{
  const url=(await ask('Supabase Project URL: ')).trim().replace(/\/$/,'');
  const key=(await ask('Supabase publishable key (NOT secret/service-role): ')).trim();
  validate(url,key);
  fs.writeFileSync(dest,JSON.stringify({url,anonKey:key},null,2)+'\n');
  console.log('\nConfigured public cloud sign-in for this source and future EXE builds.');
  console.log('Staff will only enter Supabase email and password.');
  console.log('Never distribute server-only cloud bridge secrets.');
 }catch(err){console.error('\nNot configured: '+err.message);process.exitCode=1;}
 finally{rl.close();}
})();
