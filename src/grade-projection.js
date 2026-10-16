'use strict';
/* Read-only workshop projection. Never assigns grades or changes repair progress. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexGradeProjection=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const clean=v=>String(v??'').trim().replace(/\s+/g,' ');
 const normal=v=>clean(v).toLowerCase().replace(/[–—_-]/g,' ').replace(/\s+/g,' ');
 const grade=v=>({a:'Excellent',b:'Good',c:'Fair',excellent:'Excellent',good:'Good',fair:'Fair'})[normal(v)]||null;
 function classify(name){
  const n=normal(name),spray=/\b(?:respray|re spray|repaint|re paint|paint)\b/.test(n);
  if(spray){
   // Separate bundled tasks from a respray applied to the keyboard itself.
   const tasks=n.split(/\s*(?:\+|&|\band\b)\s*/).filter(Boolean);
   const wholeTask=s=>/^(?:(?:full|complete|whole|all)(?: body| device| laptop)? )?(?:respray|re spray|repaint|re paint)(?: required)?$/.test(s);
   const keyboardTask=s=>/^(?:(?:new|replacement) )?(?:(?:uk|united kingdom|british) )?keyboard(?: replacement)?$/.test(s);
   if(tasks.length>1&&tasks.some(wholeTask)&&tasks.some(keyboardTask))return 'full-respray';
   const partial=/\b(?:lid|cover|base|bottom|palmrest|palm rest|keyboard|keycap|touchpad|bezel|partial|spot|top case)\b/.test(n);
   const full=!partial&&(/^(?:(?:full|complete|whole)(?: body| device| laptop)? )?(?:respray|re spray|repaint|re paint)(?: required)?$/.test(n)||/\b(?:full|complete|whole) (?:body|device|laptop)\b/.test(n));
   return full?'full-respray':'partial-respray';
  }
  if(/\b(?:battery|batteries)\b/.test(n)&&! /\b(?:cable|connector|cover|charger|cmos|bios|rtc)\b/.test(n))return 'battery';
  if(/\b(?:lcd|screen|display|touchscreen)\b/.test(n)&&! /\b(?:cable|connector|bezel|hinge|lid|cover|protector|clean|cleaning)\b/.test(n))return 'screen';
  if(/\b(?:keyboard|keycaps?)\b/.test(n)&&! /\b(?:cable|connector|backlight)\b/.test(n))return 'keyboard';
  if(/\b(?:touchpad|trackpad|palmrest|palm rest|lid|casing|housing|bottom case|base cover|top case)\b/.test(n))return 'body-part';
  return 'other';
 }
 function reportFor(asset){const ref=asset.refurbishment||{},reports=Array.isArray(ref.reports)?ref.reports:[];return reports.find(r=>r.key===ref.latestKey)||[...reports].sort((a,b)=>Number(b.sourceUpdatedAt||0)-Number(a.sourceUpdatedAt||0))[0]||ref;}
 function requirementsFor(asset,workflow){
  const job=workflow?.jobs?.[asset.id],report=reportFor(asset);
  // A job is authoritative, including an intentionally empty parts list.
  const raw=job?(Array.isArray(job.parts)?job.parts:[]):Array.isArray(report.repairs)?report.repairs:Array.isArray(report.parts)?report.parts:[];
  const groups=new Map();
  for(const value of raw){const p=typeof value==='string'?{name:value}:value||{},name=clean(p.name),qty=Number(p.qty??p.quantity??1);if(!name||!Number.isFinite(qty)||qty<=0)continue;const key=normal(name),fitted=p.status==='Fitted'?qty:Math.max(0,Math.min(qty,Number(p.fitted)||0));if(!groups.has(key))groups.set(key,{name,qty:0,fitted:0,effect:classify(name)});const row=groups.get(key);row.qty+=qty;row.fitted+=fitted;}
  return {rows:[...groups.values()],source:job?'Asset refurbishment job':'Latest RefurbFlow requirements'};
 }
 function project(asset={},workflow){
  const current=grade(asset.condition),list=requirementsFor(asset,workflow),has=effect=>list.rows.some(r=>r.effect===effect),full=has('full-respray'),screen=has('screen'),battery=has('battery');
  const potential=current?(full?'Excellent':current):null;
  const explanation=[];
  if(!current)explanation.push('Record the current cosmetic grade before using the projection.');
  else if(full)explanation.push('Full respray projects Excellent body condition under your workshop rule.');
  else explanation.push('Without a full respray, the recorded '+current+' grade is retained: the parts list alone cannot prove the condition of all remaining surfaces.');
  if(screen)explanation.push('LCD / screen replacement is assumed to leave a scratch-free screen.');
  if(list.rows.some(r=>r.effect==='full-respray'&&/\bkeyboard\b/i.test(r.name)))explanation.push('Respray + UK Keyboard is a full respray with a keyboard task, not a keyboard-only respray.');
  if(has('partial-respray'))explanation.push('A respray of one area is included, but does not restore the whole body.');
  if(has('keyboard')||has('body-part'))explanation.push('Replacement keyboard or casing parts improve only the areas being replaced.');
  if(battery)explanation.push('Battery replacement supports battery readiness; it does not raise the cosmetic grade.');
  if(has('other'))explanation.push('Other listed parts are shown without assuming a cosmetic improvement.');
  const assumptions=[];
  if(potential==='Excellent')assumptions.push(screen?'Replacement LCD must be scratch-free.':'Existing screen must be scratch-free.');
  if(potential==='Good')assumptions.push('Existing screen must be scratch-free; remaining body marks must be invisible at 20 inches or more.');
  if(full)assumptions.push('Full respray must restore all relevant body surfaces to Excellent, including any dents or engraving; remaining keyboard and touchpad wear must also meet Excellent.');
  if(potential==='Excellent')assumptions.push('Any remaining body marks must be invisible at 8 inches or more.');
  if(potential==='Fair')assumptions.push('Any screen scratches must be light and not interfere with use; dents or engraving must not affect performance.');
  assumptions.push('All listed work is assumed completed successfully. Final visual and functional checks still apply.');
  const rawHealth=asset.batteryPercentage,health=rawHealth!==''&&rawHealth!==undefined&&rawHealth!==null&&Number.isFinite(Number(rawHealth))?Number(rawHealth):null;
  const failed=Object.values(asset.diagnosticTests||{}).some(v=>(v?.status||v)==='fail')||asset.inspection?.functional==='Issues';
  let readiness=battery?'Battery replacement planned · verify at least 80% health after fitting.':health!==null&&health<80?'Battery below 80% · no battery replacement listed.':health!==null?'Recorded battery '+health+'% · verify functionality before listing.':'Battery health not recorded · verify at least 80% before listing.';
  if(asset.inspection?.battery==='Failed'&&!battery)readiness='Battery failure recorded · no battery replacement listed.';
  if(failed)readiness+=' Recorded functional failures require repair and retesting.';
  return {current:current||clean(asset.condition)||'Not assessed',recorded:clean(asset.condition)||'Not assessed',potential,requirements:list.rows,source:list.source,explanation,assumptions,readiness,rule:full?'full-respray':current?'retain-current':'needs-assessment'};
 }
 return {project,classify,requirementsFor};
});
