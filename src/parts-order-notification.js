'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexPartsOrderNotice=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const INTERVALS=Object.freeze({off:-1,session:0,'30m':30*60000,'1h':60*60000,'4h':240*60000,'24h':1440*60000});
 const cosmetic=name=>/respray|re[ -]?spray|repaint|paint/i.test(String(name||''));
 function summary(workflow,assets,now=Date.now()){
  if(!workflow?.jobs||!Array.isArray(assets))return {count:0,older7:0,ids:[]};
  const active=new Set(assets.filter(a=>a&&!a.deletedAt).map(a=>String(a.id).toUpperCase()));
  const orders=(workflow.orders||[]).filter(o=>o.status!=='Draft');
  const onOrder=new Map();
  for(const order of orders)for(const line of order.lines||[]){
   const k=String(line.assetId||'').toUpperCase()+'|'+String(line.partId||'');
   onOrder.set(k,(onOrder.get(k)||0)+Math.max(0,Number(line.qty||0)-Number(line.received||0)));
  }
  const ids=[],longWait=[];
  for(const job of Object.values(workflow.jobs)){
   const id=String(job?.assetId||'').toUpperCase();
   if(!active.has(id)||['Completed','On Hold'].includes(job.status)||job.partsBoard==='ordered')continue;
   let waiting=false,oldest=Infinity;
   for(const part of job.parts||[]){
    if(cosmetic(part.name))continue;
    const qty=Number(part.qty)||0,received=Number(part.received)||0;
    const stillToOrder=Math.max(0,qty-received-(onOrder.get(id+'|'+String(part.id||''))||0));
    if(!stillToOrder)continue;
    waiting=true;
    const since=Date.parse(part.createdAt||job.createdAt||'');
    if(Number.isFinite(since))oldest=Math.min(oldest,since);
   }
   if(!waiting)continue;
   ids.push(id);
   if(Number.isFinite(oldest)&&Math.floor(Math.max(0,now-oldest)/86400000)>7)longWait.push(id);
  }
  return {count:ids.length,older7:longWait.length,ids};
 }
 function shouldShow({frequency='session',lastShown=0,lastCount=0,count=0,now=Date.now()}){
  if(!Object.prototype.hasOwnProperty.call(INTERVALS,frequency)||frequency==='off'||count<=0)return false;
  if(!lastShown)return true;
  if(count>lastCount)return true;
  if(frequency==='session')return false;
  return now-lastShown>=INTERVALS[frequency];
 }
 return {summary,shouldShow,INTERVALS};
});
