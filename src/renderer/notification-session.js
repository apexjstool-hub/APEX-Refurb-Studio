'use strict';
(function(root,factory){
 const policy=factory();
 if(typeof module==='object'&&module.exports){module.exports=policy;return;}
 root.ApexNotificationPolicy=policy;
 const session=policy.create(()=>root.document.getElementById('loginPage')?.classList.contains('hidden')===true&&root.document.getElementById('appPage')?.classList.contains('hidden')===false,active=>{
  root.document.documentElement.dataset.apexNotificationSession=active?'active':'inactive';
  root.dispatchEvent(new Event('apex:notification-session'));
 });
 root.document.documentElement.dataset.apexNotificationSession='inactive';
 root.ApexNotificationSession=session;
})(typeof window!=='undefined'?window:globalThis,function(){
 function create(workspaceVisible,changed=()=>{}){
  let authenticated=false,generation=0;
  const active=()=>authenticated&&workspaceVisible();
  return Object.freeze({active,ticket:()=>generation,current:ticket=>ticket===generation&&active(),
   start(ticket=generation){if(ticket!==generation||!workspaceVisible())return false;if(!authenticated){authenticated=true;changed(true);}return true;},
   stop(){authenticated=false;generation++;changed(false);}
  });
 }
 function unreadMessages(me,latest,reads){
  if(!me)return [];
  return (latest||[]).filter(m=>m&&m.sender_id&&m.sender_id!==me&&(m.recipient_id===null||m.recipient_id===me)&&Number(m.id)>Number(reads.get(m.recipient_id===null?'team':'dm:'+String(m.sender_id).toLowerCase())||0));
 }
 function describe(rows,members){
  const names=[...new Set(rows.map(m=>members.find(person=>person.user_id===m.sender_id)?.display_name||'Team member'))];
  const targets=[...new Set(rows.map(m=>m.recipient_id===null?'team':m.sender_id))];
  return {count:rows.length,senders:names.slice(0,3),extra:Math.max(0,names.length-3),target:targets.length===1?targets[0]:null};
 }
 return Object.freeze({create,unreadMessages,describe});
});
