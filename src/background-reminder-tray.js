'use strict';
/* Electron background tray helper. This is not a Windows service: the Electron
   process must remain running and signed in for live cloud reminder polling. */
const {app,Tray,Menu,Notification}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
function create({getWindow,getSettings,userDir,canNotify}){
 let tray=null,allowQuit=false,lastKey='',lastShown=0;
 const icon=path.join(__dirname,'assets',process.platform==='win32'?'apex-app.ico':'apex-app.png');
 const marker=path.join(userDir(),'reminder-notification-state.json');
 try{const saved=JSON.parse(fs.readFileSync(marker,'utf8'));lastKey=String(saved.key||'');lastShown=Number(saved.at)||0;}catch{}
 function settings(){return getSettings();}
 function ensureTray(){
  if(tray)return;
  try{tray=new Tray(icon);tray.setToolTip('APEX Management Studio — refurbishment reminders');tray.on('double-click',open);}
  catch(e){console.warn('APEX tray unavailable:',e.message);}
  updateMenu();
 }
 function open(){const win=getWindow();if(win&&!win.isDestroyed()){win.show();win.restore();win.focus();}}
 function updateMenu(){
  if(!tray)return;
  tray.setContextMenu(Menu.buildFromTemplate([
   {label:'Open APEX Management Studio',click:open},
   {label:'Reminders run while signed in',enabled:false},
   {type:'separator'},
   {label:'Exit APEX completely',click:()=>{allowQuit=true;app.quit();}}
  ]));
 }
 function applySettings(){
  const s=settings();
  if(s.keepInTray||s.desktopNotifications)ensureTray();
  else if(tray){tray.destroy();tray=null;}
  if(process.platform==='win32'&&app.isPackaged){
   try{app.setLoginItemSettings({openAtLogin:!!s.startWithWindows,args:[]});}
   catch(e){console.warn('Windows startup preference not applied:',e.message);}
  }
  return {ok:true,settings:s};
 }
 function interceptClose(event){
  if(allowQuit||!settings().keepInTray)return;
  event.preventDefault();
  const win=getWindow();if(win&&!win.isDestroyed())win.hide();
  ensureTray();
 }
 function notify(rows){
  const s=settings();
  if(!s.enabled||!s.desktopNotifications||!canNotify()||!Notification.isSupported())return {ok:true,shown:false};
  const safe=Array.isArray(rows)?rows.filter(r=>r&&typeof r.id==='string'&&r.id.length<90&&Number.isFinite(r.days)&&r.days>=0&&r.days<=3650).slice(0,100):[];
  if(!safe.length){lastKey='';return {ok:true,shown:false};}
  const key=safe.map(r=>r.id+':'+Math.floor(r.days)).sort().join('|');
  const minInterval=Math.max(1,Math.min(168,Number(s.repeatHours)||24))*3600000;
  if(key===lastKey&&Date.now()-lastShown<minInterval)return {ok:true,shown:false};
  // Avoid repeated immediate popups for changing inventories within one cycle.
  if(Date.now()-lastShown<minInterval)return {ok:true,shown:false};
  const n=new Notification({title:'APEX — Parts still need ordering',body:safe.length+' laptop'+(safe.length===1?' has':'s have')+' outstanding part orders. Open APEX to review.',silent:false});
  n.on('click',open);n.show();
  lastKey=key;lastShown=Date.now();
  try{fs.mkdirSync(path.dirname(marker),{recursive:true});fs.writeFileSync(marker,JSON.stringify({key,at:lastShown}),{mode:0o600});}catch{}
  return {ok:true,shown:true};
 }
 function dispose(){allowQuit=true;if(tray){tray.destroy();tray=null;}}
 return {applySettings,interceptClose,notify,dispose};
}
module.exports={create};
