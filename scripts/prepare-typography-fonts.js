'use strict';
// Build-time only. Downloads the two OFL-licensed font files for offline packaging.
// Never downloads anything while the installed Windows application is running.
const https=require('node:https');
const fs=require('node:fs');
const path=require('node:path');
const {pipeline}=require('node:stream/promises');
const root=path.resolve(__dirname,'../src/renderer/fonts');
const fonts=[
 ['Inter-Variable.ttf','https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz%2Cwght%5D.ttf',100000],
 ['PlusJakartaSans-Variable.ttf','https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf',100000],
 ['INTER-OFL.txt','https://raw.githubusercontent.com/google/fonts/main/ofl/inter/OFL.txt',1000],
 ['JAKARTA-OFL.txt','https://raw.githubusercontent.com/google/fonts/main/ofl/plusjakartasans/OFL.txt',1000]
];
async function download(url,dest,minimum,redirects=4){
 if(redirects<0)throw Error('Too many redirects');
 await new Promise((resolve,reject)=>{
  const request=https.get(url,{timeout:25000,headers:{'user-agent':'APEX-typography-build/1.0'}},response=>{
   if(response.statusCode>=300&&response.statusCode<400&&response.headers.location){
    response.resume();download(new URL(response.headers.location,url).href,dest,minimum,redirects-1).then(resolve,reject);return;
   }
   if(response.statusCode!==200){response.resume();reject(Error('Font download HTTP '+response.statusCode+' for '+url));return;}
   const out=fs.createWriteStream(dest);
   pipeline(response,out).then(()=>{
    if(fs.statSync(dest).size<minimum)reject(Error('Unexpectedly small font asset '+path.basename(dest)));
    else resolve();
   }).catch(reject);
  });request.on('timeout',()=>request.destroy(Error('Font download timed out')));request.on('error',reject);
 });
}
(async()=>{
 fs.mkdirSync(root,{recursive:true});
 for(const [file,url,size] of fonts){
  const dest=path.join(root,file);
  if(fs.existsSync(dest)&&fs.statSync(dest).size>=size){process.stdout.write('Using local '+file+'\n');continue;}
  await download(url,dest,size);
  process.stdout.write('Prepared '+file+'\n');
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
