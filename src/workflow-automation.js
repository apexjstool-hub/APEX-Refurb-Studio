'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexAutomation=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const triggers=Object.freeze({order:'Parts awaiting order',overdue:'Supplier order overdue',delivery:'Awaiting delivery',respray:'Respray outstanding','respray-return':'Respray returned',fit:'Parts ready to fit',qa:'Ready for QA review',signoff:'Ready for final sign-off',hold:'Job on hold',inactive:'Refurbishment delayed',diagnostic:'Recorded diagnostic failure',missing:'Missing device information',location:'Unassigned location'});
 const conditions=Object.freeze({any:'Any matching asset',urgent:'Already urgent',age:'Waiting at least N days'});
 const actions=Object.freeze({flag:'Label in Action Centre',urgent:'Raise to urgent in Action Centre',notice:'Show local reminder and label'});
 const clean=v=>String(v??'').trim().slice(0,100);
 const own=(obj,k)=>Object.prototype.hasOwnProperty.call(obj,k);
 function validate(input){
  if(!input||typeof input!=='object'||!Array.isArray(input.rules)||input.rules.length>40)throw Error('Invalid automation settings (maximum 40 rules).');
  const ids=new Set();const rules=input.rules.map(r=>{
   if(!r||!/^[-a-zA-Z0-9_]{1,80}$/.test(r.id)||ids.has(r.id)||!clean(r.name)||!own(triggers,r.trigger)||!own(conditions,r.condition)||!own(actions,r.action))throw Error('Invalid or duplicate automation rule.');
   ids.add(r.id);const days=Number(r.days);if(!Number.isInteger(days)||days<1||days>365)throw Error('Days must be between 1 and 365.');
   return {id:r.id,name:clean(r.name),trigger:r.trigger,condition:r.condition,days,action:r.action,enabled:r.enabled===true};
  });return {enabled:input.enabled===true,rules};
 }
 const empty=()=>({enabled:false,rules:[]});
 const templates=Object.freeze([
  {name:'QA preparation',trigger:'qa',condition:'any',days:7,action:'flag'},
  {name:'Chase overdue suppliers',trigger:'overdue',condition:'any',days:7,action:'notice'},
  {name:'Review returned respray',trigger:'respray-return',condition:'any',days:7,action:'flag'},
  {name:'Escalate waiting parts',trigger:'order',condition:'age',days:7,action:'urgent'},
  {name:'Review recorded failures',trigger:'diagnostic',condition:'any',days:7,action:'flag'},
  {name:'Investigate workshop delays',trigger:'inactive',condition:'any',days:14,action:'urgent'}
 ]);
 function matches(rule,rows){return rows.filter(r=>r.category===rule.trigger&&(rule.condition==='any'||rule.condition==='urgent'&&r.level==='urgent'||rule.condition==='age'&&r.age!==null&&r.age!==undefined&&r.age>=rule.days));}
 function evaluate(config,report){if(!report?.available||!config?.enabled)return {report,matches:[]};const map=new Map(),hits=[];
  for(const rule of config.rules.filter(r=>r.enabled))for(const row of matches(rule,report.rows)){
   const k=JSON.stringify([row.category,row.id]);if(!map.has(k))map.set(k,[]);map.get(k).push(rule);hits.push({key:JSON.stringify([rule.id,rule.trigger,row.id]),ruleId:rule.id,rule:rule.name,asset:row.id,category:row.category,action:rule.action});
  }
  const rows=report.rows.map(r=>{const rules=map.get(JSON.stringify([r.category,r.id]));return rules?{...r,level:rules.some(x=>x.action==='urgent')?'urgent':r.level,automation:rules.map(x=>x.name)}:r;});
  const rank={urgent:0,attention:1,ready:2};rows.sort((a,b)=>rank[a.level]-rank[b.level]||(b.age??-1)-(a.age??-1)||a.id.localeCompare(b.id));
  const counts={urgent:0,attention:0,ready:0};for(const r of rows)counts[r.level]++;
  return {report:{...report,rows,counts},matches:hits};
 }
 function transitions(previous,hits){const next=new Set(hits.map(h=>h.key));return {next,newHits:hits.filter(h=>!previous.has(h.key))};}
 return Object.freeze({triggers,conditions,actions,templates,validate,empty,matches,evaluate,transitions});
});
