'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ACTOR='scrapegoats~backmarket-scraper',CAP_USD=0.25,LIMIT=10;
const clean=(v,n=240)=>String(v??'').replace(/[\x00-\x1f\x7f]/g,' ').trim().replace(/\s+/g,' ').slice(0,n);
function searchFor(a={}){const maker=clean(a.manufacturer,90),model=clean(a.model,140),name=model.toLowerCase().startsWith(maker.toLowerCase()+' ')?model:[maker,model].filter(Boolean).join(' ');return clean([name,a.processor,a.ram,a.storage].filter(Boolean).join(' '),160);}
function query(value){const q=clean(value,160);if(q.length<3)throw Error('Enter at least 3 characters for the model search.');return q;}
function money(v){if(typeof v==='number')return Number.isFinite(v)&&v>0?v:null;if(typeof v!=='string'||!/^(?:£\s*)?\d[\d,]*(?:\.\d{1,2})?(?:\s*GBP)?$/i.test(v.trim()))return null;const n=Number(v.replace(/£|GBP|,|\s/gi,''));return Number.isFinite(n)&&n>0?n:null;}
function ukLink(value){try{const u=new URL(value);return u.protocol==='https:'&&['www.backmarket.co.uk','backmarket.co.uk'].includes(u.hostname)&&!u.username&&!u.password?u.href:null;}catch{return null;}}
function normaliseItems(items){
 if(!Array.isArray(items))throw Error('Apify returned an unexpected dataset format.');
 return items.slice(0,LIMIT).map(row=>{
  if(!row||typeof row!=='object')return null;
  const title=clean(row['Product name']||row.title||row.name,400);if(!title)return null;
  const raw=row['Select the condition']||{},conditions={};for(const grade of ['Fair','Good','Excellent'])conditions[grade]=money(raw[grade]);
  const specs=row['Technical specifications']||{},spec=key=>clean(specs[key],160);
  return {title,sellingPrice:money(row['Selling Price']),conditions,url:ukLink(row.URL||row.url||row['Product URL']||row['Product url']),specs:{brand:spec('Brand'),model:spec('Model'),processor:spec('Processor'),ram:spec('Memory'),storage:spec('Storage'),keyboard:spec('Keyboard Language & Type')}};
 }).filter(Boolean);
}
class TokenVault{
 constructor(dir,safeStorage){this.dir=dir;this.crypto=safeStorage;}
 file(){return path.join(this.dir(),'apify-prices-token.json');}
 available(){return this.crypto.isEncryptionAvailable()&&this.crypto.getSelectedStorageBackend?.()!=='basic_text';}
 read(){try{if(!this.available())return '';const d=JSON.parse(fs.readFileSync(this.file(),'utf8'));return this.crypto.decryptString(Buffer.from(d.encrypted,'base64'));}catch{return '';}}
 save(value){if(!this.available())throw Error('Secure Windows credential storage is unavailable. No token was saved.');const token=String(value??'').trim();if(token.length<10||token.length>500||/\s/.test(token))throw Error('Enter a valid Apify API token.');const file=this.file(),tmp=file+'.tmp';fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(tmp,JSON.stringify({encrypted:this.crypto.encryptString(token).toString('base64')}),{mode:0o600});fs.renameSync(tmp,file);}
 forget(){try{fs.unlinkSync(this.file());}catch(e){if(e.code!=='ENOENT')throw e;}}
}
class PriceService{
 constructor({vault,dir,fetchImpl=globalThis.fetch,now=Date.now}){this.vault=vault;this.dir=dir;this.fetch=fetchImpl;this.now=now;this.cache=new Map();this.active=null;try{const saved=JSON.parse(fs.readFileSync(this.cacheFile(),'utf8'));for(const r of saved.slice(-40))if(typeof r.query==='string'&&Array.isArray(r.items)&&typeof r.fetchedAt==='string')this.cache.set(r.query,r);}catch{}}
 cacheFile(){return path.join(this.dir(),'backmarket-price-cache.json');}
 writeCache(){try{fs.mkdirSync(this.dir(),{recursive:true});const file=this.cacheFile(),tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify([...this.cache.values()].slice(-40)));fs.renameSync(tmp,file);}catch{/* A failed cache write never repeats a paid run. */}}
 async request(route,{method='GET',body,token}={}){
  let response;try{response=await this.fetch('https://api.apify.com/v2'+route,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(25000),redirect:'error'});}catch{throw Error(method==='POST'?'The Apify request could not be confirmed. Check your Apify Console before starting another lookup.':'Apify cannot be reached. The existing run will not be restarted.');}
  if(!response.ok){const messages={401:'Apify rejected the token. Update it in Connection.',402:'Apify credits or billing are required.',403:'The token cannot access this actor or its proxy. Check Apify permissions.',404:'The Apify actor or run was not found.',429:'Apify rate limit reached. Try again later.'};throw Error(messages[response.status]||'Apify returned HTTP '+response.status+'. No prices were estimated.');}
  const raw=await response.text();if(raw.length>2000000)throw Error('The Apify response was too large.');try{return JSON.parse(raw);}catch{throw Error('Apify returned an unreadable response.');}
 }
 publicState(q){const run=this.active&&this.active.query===q?this.active:null;return {ok:true,configured:!!this.vault.read(),capUsd:CAP_USD,limit:LIMIT,query:q,result:this.cache.get(q)||null,run:run?{id:run.id,status:run.status,error:run.error||'',costUsd:run.costUsd??null}:null,busy:!!this.active&&['STARTING','READY','RUNNING','TIMING-OUT','ABORTING'].includes(this.active.status)};}
 async start(value){
  const q=query(value);if(this.active&&['STARTING','READY','RUNNING','TIMING-OUT','ABORTING'].includes(this.active.status))throw Error('A price lookup is already running. Wait for it or cancel it first.');
  const token=this.vault.read();if(!token)throw Error('Add your Apify API token in Connection first.');
  const cached=this.cache.get(q);if(cached&&this.now()-Date.parse(cached.fetchedAt)<60000)throw Error('Prices were fetched less than a minute ago. Use the cached results before another paid lookup.');
  const job={id:crypto.randomUUID(),query:q,status:'STARTING',token,remoteId:null,datasetId:null,lastPoll:0,polling:false};this.active=job;
  try{
   const r=await this.request('/actors/'+ACTOR+'/runs?timeout=180&restartOnError=false&maxTotalChargeUsd='+CAP_USD,{method:'POST',token,body:{function:'country_and_keywords',searchs:[q],country_input:'United Kingdom',limit_per_search:LIMIT,proxy_configuration:{useApifyProxy:true}}});
   const d=r.data;if(!d||! /^[a-zA-Z0-9]{5,80}$/.test(d.id))throw Error('Apify did not return a valid run ID. Check Apify Console before retrying.');job.remoteId=d.id;job.datasetId=d.defaultDatasetId;job.status=d.status||'RUNNING';await this.finish(job,d);return this.publicState(q);
  }catch(e){job.error=e.message;if(job.remoteId&&job.status==='SUCCEEDED')return this.publicState(q);job.status='FAILED';throw e;}
 }
 async finish(job,d){
  if(Number.isFinite(d.usageTotalUsd))job.costUsd=d.usageTotalUsd;
  if(d.status==='SUCCEEDED'){
   const id=d.defaultDatasetId||job.datasetId;if(! /^[a-zA-Z0-9]{5,80}$/.test(id))throw Error('Apify returned no valid result dataset.');
   const items=normaliseItems(await this.request('/datasets/'+id+'/items?clean=true&format=json&limit='+LIMIT,{token:job.token}));
   const result={query:job.query,items,fetchedAt:new Date(this.now()).toISOString(),runId:job.remoteId,costUsd:job.costUsd??null,country:'United Kingdom',currency:'GBP'};this.cache.delete(job.query);this.cache.set(job.query,result);if(this.cache.size>40)this.cache.delete(this.cache.keys().next().value);this.writeCache();job.status='SUCCEEDED';
  }else if(['FAILED','TIMED-OUT','ABORTED'].includes(d.status)){job.error='Apify run '+d.status.toLowerCase().replaceAll('-',' ')+'. Check the run in Apify Console. No replacement prices were invented.';}
 }
 async state(value){const q=query(value),job=this.active;
  if(job&&job.remoteId&&!job.polling&&this.now()-job.lastPoll>=2000&&['READY','RUNNING','TIMING-OUT','ABORTING','SUCCEEDED'].includes(job.status)&&!(job.status==='SUCCEEDED'&&this.cache.get(job.query)?.runId===job.remoteId)){
   job.polling=true;job.lastPoll=this.now();try{const r=await this.request('/actor-runs/'+job.remoteId,{token:job.token});job.status=r.data?.status||job.status;job.error='';await this.finish(job,r.data||{});}catch(e){job.error=e.message;}finally{job.polling=false;}
  }
  return this.publicState(q);
 }
 async cancel(){const job=this.active;if(!job?.remoteId||!['READY','RUNNING','TIMING-OUT','ABORTING'].includes(job.status))throw Error('No cancellable price lookup is running.');const r=await this.request('/actor-runs/'+job.remoteId+'/abort',{method:'POST',token:job.token});job.status=r.data?.status||'ABORTING';await this.finish(job,r.data||{});return this.publicState(job.query);}
 replaceToken(token){if(this.active)this.active.token=token;}
}
module.exports={TokenVault,PriceService,searchFor,normaliseItems,money,ukLink,CAP_USD,LIMIT};
