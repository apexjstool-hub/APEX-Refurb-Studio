'use strict';
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.ApexSmartDataCleaner=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const tidy=s=>String(s??'').replace(/\s+/g,' ').trim();
 function maker(s){
  const x=tidy(s); if(!x)return x;
  const known={'hp':'HP','hewlett packard':'HP','hewlett-packard':'HP','dell':'Dell','lenovo':'Lenovo','apple':'Apple','asus':'ASUS','acer':'Acer','microsoft':'Microsoft','fujitsu':'Fujitsu','toshiba':'Toshiba','dynabook':'Dynabook','msi':'MSI'};
  return known[x.toLowerCase()]||x;
 }
 function model(s){
  let x=tidy(s);if(!x)return x;
  x=x.replace(/\bthinkpad\b/gi,'ThinkPad').replace(/\bthinkbook\b/gi,'ThinkBook').replace(/\bideapad\b/gi,'IdeaPad').replace(/\belitebook\b/gi,'EliteBook').replace(/\bprobook\b/gi,'ProBook').replace(/\bzbook\b/gi,'ZBook').replace(/\blatitude\b/gi,'Latitude').replace(/\bprecision\b/gi,'Precision').replace(/\binspiron\b/gi,'Inspiron').replace(/\boptiplex\b/gi,'OptiPlex').replace(/\bvivobook\b/gi,'VivoBook').replace(/\bzenbook\b/gi,'Zenbook');
  x=x.replace(/\bgen\s*(\d+)\b/gi,(_,n)=>'Gen '+n).replace(/\b(\d{2}\.\d)\s*(?:inch|inches|")\b/gi,'$1 inch');
  return x;
 }
 function processor(s){
  let x=tidy(s);if(!x)return x;
  x=x.replace(/\bintel\b/gi,'Intel').replace(/\bcore\b/gi,'Core').replace(/\bamd\b/gi,'AMD').replace(/\bryzen\b/gi,'Ryzen').replace(/\bapple\b/gi,'Apple');
  x=x.replace(/\b([iI][3579])\s+(\d{4,5}[a-zA-Z]{0,3})\b/g,(_,i,n)=>i.toLowerCase()+'-'+n.toUpperCase());
  x=x.replace(/\b(i[3579])-([0-9]{4,5})([a-z]{1,3})\b/gi,(_,i,n,suffix)=>i.toLowerCase()+'-'+n+suffix.toUpperCase());
  return x;
 }
 function spec(s){
  let x=tidy(s);if(!x)return x;
  x=x.replace(/\b(\d+(?:\.\d+)?)\s*(gb|tb|mb)\b/gi,(_,n,u)=>n+' '+u.toUpperCase());
  x=x.replace(/\b(ddr[345])\b/gi,(_,v)=>v.toUpperCase()).replace(/\b(nvme|ssd|hdd|sata|pcie)\b/gi,(_,v)=>v.toUpperCase());
  return x;
 }
 function note(s){
  let x=String(s??'').replace(/[ \t]+/g,' ').replace(/ +([,.;:!?])/g,'$1').trim();if(!x)return x;
  // Preserve case-sensitive engineering terms and fault statements; do not rewrite meaning.
  x=x.replace(/(^|[.!?]\s+)([a-z])/g,(_,a,b)=>a+b.toUpperCase());
  return x;
 }
 const fields={manufacturer:maker,model,processor,ram:spec,storage:spec,serial:s=>tidy(s).toUpperCase(),notes:note,refurbNotes:note};
 const groups={hardware:['manufacturer','model','processor','ram','storage'],serial:['serial'],notes:['notes','refurbNotes']};
 function plan(asset,options={hardware:true,serial:true,notes:false}){
  const patch={},changes=[];if(!asset||!asset.id)return {patch,changes};
  for(const [group,enabled] of Object.entries(options)){
   if(!enabled||!groups[group])continue;
   for(const key of groups[group]){
    if(typeof asset[key]!=='string'||!asset[key].trim())continue;
    const current=asset[key],next=fields[key](current);
    if(next!==current){patch[key]=next;changes.push({field:key,before:current,after:next});}
   }
  }
  return {patch,changes};
 }
 return {plan,groups,maker,model,processor,spec,note};
});
