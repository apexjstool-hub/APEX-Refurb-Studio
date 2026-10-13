'use strict';
/* Restricted diagnostic intake. This never grants read, delete, transfer, grade or status permissions. */
const core=require('./inventory-core');
const testModule=require('./diagnostic-tests');
const HARDWARE=['manufacturer','model','serial','processor','gpu','ram','storage','operatingSystem'];
const cleaned=(x,n)=>String(x??'').trim().slice(0,n);
const isValid=(str)=>!!str&&!/^(unknown|not reported|detecting|default string|n\/?a|none)$/i.test(str);
function importDiagnostic(items,payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))return {ok:false,error:'Invalid diagnostic asset payload.'};
 const id=cleaned(payload.id,80).toUpperCase(),model=cleaned(payload.model,140),serial=cleaned(payload.serial,90);
 if(!id||!model||!/^[-A-Z0-9_.\/]{2,80}$/.test(id))return {ok:false,error:'Valid asset tag and model are required.'};
 const next={id,model,manufacturer:cleaned(payload.manufacturer,90),serial,processor:cleaned(payload.processor,140),gpu:cleaned(payload.gpu,140),ram:cleaned(payload.ram,70),storage:cleaned(payload.storage,140),operatingSystem:cleaned(payload.operatingSystem,140),ramType:payload.ramType,ssdType:payload.ssdType,batteryPercentage:payload.batteryPercentage};
 if(!isValid(next.model))return {ok:false,error:'A real device model is required.'};
 const submittedTests=testModule.sanitise(payload.tests);
 const existing=items.find(x=>x.id===id);
 if(existing){
  if(serial&&existing.serial&&serial.toUpperCase()!==existing.serial.toUpperCase())return {ok:false,error:'This asset ID belongs to a different serial number. Review it in Smart Inventory before importing.'};
  const patch={};
  for(const key of HARDWARE){const value=next[key];if(isValid(value))patch[key]=value;}
  if(core.ramTypes.includes(next.ramType)&&next.ramType!=='Not specified')patch.ramType=next.ramType;
  if(core.ssdTypes.includes(next.ssdType)&&next.ssdType!=='Not specified')patch.ssdType=next.ssdType;
  if(next.batteryPercentage!==undefined&&next.batteryPercentage!==null&&/^(100|[1-9]?\d)$/.test(String(next.batteryPercentage).trim()))patch.batteryPercentage=String(next.batteryPercentage).trim();
  const changedHardware=Object.entries(patch).some(([key,value])=>String(existing[key]??'')!==String(value));
  const currentTests=existing.diagnosticTests||{};
  const testChanges=Object.entries(submittedTests).filter(([key,value])=>currentTests[key]?.status!==value.status);
  const changed=changedHardware||testChanges.length>0;
  const result=core.update(items,id,patch);
  if(!result.ok)return result;
  if(testChanges.length){
    result.item.diagnosticTests={...(result.item.diagnosticTests||{}),...submittedTests};
    result.item.updatedAt=new Date().toISOString();
    result.item.history.push({type:'Diagnostic results',detail:testChanges.map(([id,value])=>`${testModule.names[id]}: ${value.status.toUpperCase()}`).join(' · ').slice(0,450),at:result.item.updatedAt});
  }
  if(changedHardware){result.item.history.push({type:'APEX Diagnostics',detail:'Hardware specifications updated from laptop diagnostics',at:new Date().toISOString()});}
  if(changed)result.item.history=result.item.history.slice(-120);
  return {ok:true,action:changed?'updated':'unchanged',item:result.item};
 }
 const incoming={...next,diagnosticTests:submittedTests,productType:'Laptop',location:'Inspection',condition:'Not assessed',status:'Awaiting Processing'};
 const result=core.add(items,incoming);
 if(result.ok){result.action='created';result.item.history.push({type:'APEX Diagnostics',detail:'Hardware information and completed test results imported from laptop diagnostics',at:new Date().toISOString()});}
 return result;
}
module.exports={importDiagnostic};
