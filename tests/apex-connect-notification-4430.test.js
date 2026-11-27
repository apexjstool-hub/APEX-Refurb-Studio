'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-connect.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-connect.css'),'utf8');
const html=fs.readFileSync(path.join(__dirname,'../src/renderer/index.html'),'utf8');
const maint=fs.readFileSync(path.join(__dirname,'../src/renderer/apex-connect-maintenance.js'),'utf8');
const UUID1='11111111-1111-4111-8111-111111111111',UUID2='22222222-2222-4222-8222-222222222222';
function harness(){
 const elements={},handlers={},timers=[],calls=[];
 const make=(id)=>elements[id]||=(Object.assign({
  id,hidden:id==='apexConnectDrawer',innerHTML:'',textContent:'',value:'',scrollTop:0,clientHeight:100,scrollHeight:100,
  classList:{contains(name){return this._classes?.has(name)||false;},add(name){this._classes??=new Set();this._classes.add(name);},remove(name){this._classes?.delete(name);}},
  setAttribute(name,value){this[name]=value;},getAttribute(name){return this[name]},append(node){node.parentNode=this;},
  addEventListener(name,fn){handlers[id+':'+name]=fn;},querySelectorAll(){return[];},
  after(){},focus(){},click(){return this.onclick?.()},offsetWidth:36
 },id==='connectPage'?{classList:{contains:()=>true}}:{}));
 const doc={visibilityState:'visible',getElementById:make,
  createElement(tag){return {innerHTML:'',className:'',parentNode:null,append(){},querySelectorAll(){return[];},setAttribute(){}};},
  addEventListener(name,fn){handlers['document:'+name]=fn;}};
 const api={async connectList(){calls.push('list');return {ok:true,userId:UUID1,members:[{user_id:UUID1,display_name:'You'},{user_id:UUID2,display_name:'Office'}],latest:api.messages||[],reads:api.reads||[]};},
  async connectHistory(){return {ok:true,messages:[]};},async connectRead(){return {ok:true,lastRead:1}},async connectSend(){return {ok:true}}};
 const policy=require('../src/renderer/notification-session');const notices=[];let signedIn=true;const gate=policy.create(()=>signedIn);gate.start();const context={document:doc,window:null,ApexNotificationSession:gate,ApexNotificationPolicy:policy,ApexMessageNotices:{show(data){notices.push(data);},hide(){}},setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},setInterval(){},
  MutationObserver:class{observe(){}},Date,Math,Number,Set,Map,String,console};
 context.window=context;context.addEventListener=(name,fn)=>handlers['window:'+name]=fn;
 context.apexInventory=api;
 vm.createContext(context);vm.runInContext(source,context);
 return {context,api,make,calls,timers,handlers,notices,logout(){signedIn=false;gate.stop();handlers['window:apex:notification-session']?.();},flush:async()=>{
  await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();await Promise.resolve();
 }};
}
test('Unread badges are based on actual recipient and new IDs, not sender echo',async()=>{
 const h=harness();h.api.messages=[{id:1,sender_id:UUID1,recipient_id:UUID2}];
 await h.context.ApexConnect.refresh();await h.flush();
 assert.equal(h.make('apexConnectUnread').hidden,true,'outgoing message should not notify sender');
 h.api.messages.push({id:2,sender_id:UUID2,recipient_id:UUID1});
 await h.context.ApexConnect.refresh();await h.flush();
 assert.equal(h.make('apexConnectUnread').hidden,false);
 assert.equal(h.make('apexConnectUnread').textContent,'1');
 assert.equal(h.make('apexConnectToggle').classList.contains('apex-connect-notify'),true);
});
test('Read receipts make badge disappear, and recipient re-notifies when next message arrives',async()=>{
 const h=harness();h.api.messages=[{id:10,sender_id:UUID2,recipient_id:UUID1}];
 await h.context.ApexConnect.refresh();await h.flush();
 assert.equal(h.make('apexConnectUnread').textContent,'1');
 h.api.reads=[{conversation_key:'dm:'+UUID2,last_read_id:10}];
 await h.context.ApexConnect.refresh();await h.flush();
 assert.equal(h.make('apexConnectUnread').hidden,true);
 h.api.messages.push({id:11,sender_id:UUID2,recipient_id:UUID1});
 await h.context.ApexConnect.refresh();await h.flush();
 assert.equal(h.make('apexConnectUnread').textContent,'1');
});
test('Preview shows example badge without saving a message or changing actual counts',async()=>{
 const h=harness();await h.context.ApexConnect.refresh();await h.flush();
 const calls=h.calls.length;
 assert.equal(h.context.ApexConnect.testNotification(),true);
 assert.equal(h.make('apexConnectUnread').hidden,false);
 assert.equal(h.make('apexConnectUnread').textContent,'1');
 assert.equal(h.calls.length,calls,'Preview is local and sends no database action');
 assert(h.timers.some(t=>t.ms===2350),'Badge preview restores real count');
});
test('Notifications refresh on foreground return and use a quicker poll timer',()=>{
 assert.match(source,/setInterval\(\(\)=>poll\(\),6500\)/);
 assert.match(source,/visibilitychange/);
 assert.match(source,/addEventListener\('focus'/);
 assert.match(source,/const newest=inbound\.reduce/);
 assert.match(source,/lastInboundId/);
 assert.match(source,/count>0/);
 assert.match(html,/id="apexConnectTestNotification"/);
 assert.match(maint,/ApexConnect\?\.testNotification/);
 assert.match(css,/@keyframes apex-connect-shake/);
 assert.match(css,/prefers-reduced-motion:reduce/);
});

test('popups group unread senders, ignore outgoing messages and do not repeat on unchanged polls',async()=>{
 const h=harness();h.api.messages=[{id:1,sender_id:UUID2,recipient_id:UUID1},{id:2,sender_id:UUID2,recipient_id:UUID1},{id:3,sender_id:UUID1,recipient_id:UUID2}];
 await h.context.ApexConnect.refresh();assert.equal(h.notices.length,1);assert.equal(h.notices[0].count,2);assert.equal(h.notices[0].senders[0],'Office');
 await h.context.ApexConnect.refresh();assert.equal(h.notices.length,1);
});
test('sign-out suppresses an outstanding messaging response and clears the unread badge',async()=>{
 const h=harness();let finish;h.api.connectList=()=>new Promise(resolve=>{finish=resolve;});const task=h.context.ApexConnect.refresh();
 h.logout();finish({ok:true,userId:UUID1,members:[{user_id:UUID2,display_name:'Office'}],latest:[{id:2,sender_id:UUID2,recipient_id:UUID1}],reads:[]});await task;
 assert.equal(h.notices.length,0);assert.equal(h.make('apexConnectUnread').hidden,true);assert.equal(h.context.ApexConnect.testNotification(),false);
});
