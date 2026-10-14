'use strict';
const {BrowserWindow,ipcMain,screen}=require('electron'),path=require('node:path');
function createDesktopIntakeNotification(owner,onOpen){
 let popup=null,timer=null;const pending=new Map();
 const close=()=>{clearTimeout(timer);if(popup&&!popup.isDestroyed())popup.destroy();popup=null;pending.clear();};
 ipcMain.on('apex:intake-notification',(event,action)=>{
  if(!popup||popup.isDestroyed()||event.sender!==popup.webContents)return;
  if(action==='open'){const parent=owner();if(parent&&!parent.isDestroyed()){if(parent.isMinimized())parent.restore();parent.show();parent.focus();onOpen([...pending.keys()]);}}
  if(action==='open'||action==='dismiss')close();
 });
 async function show(assets){
  for(const a of assets)pending.set(a.id,a);
  const parent=owner();if(!parent||parent.isDestroyed())return;
  const area=screen.getDisplayMatching(parent.getBounds()).workArea,width=Math.min(380,area.width-24),height=172;
  if(!popup||popup.isDestroyed()){
   popup=new BrowserWindow({width,height,x:area.x+area.width-width-16,y:area.y+area.height-height-16,frame:false,resizable:false,alwaysOnTop:true,skipTaskbar:true,show:false,backgroundColor:'#101b24',title:'APEX - New inventory received',webPreferences:{preload:path.join(__dirname,'notification-preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,backgroundThrottling:false}});
   popup.setAlwaysOnTop(true,'floating');popup.webContents.setWindowOpenHandler(()=>({action:'deny'}));popup.webContents.on('will-navigate',event=>event.preventDefault());
   popup.on('closed',()=>{popup=null;clearTimeout(timer);pending.clear();});
  }
  const current=popup,ids=[...pending.keys()],count=ids.length;
  await current.loadFile(path.join(__dirname,'renderer','inventory-notification.html'),{query:{count:String(count),ids:ids.slice(0,3).join(' · ')}});
  if(current!==popup||current.isDestroyed())return;
  current.setBounds({width,height,x:area.x+area.width-width-16,y:area.y+area.height-height-16});current.showInactive();clearTimeout(timer);timer=setTimeout(close,12000);
 }
 return {show,close};
}
module.exports={createDesktopIntakeNotification};
