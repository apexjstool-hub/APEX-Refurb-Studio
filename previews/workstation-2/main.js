'use strict';
const {app,BrowserWindow,shell}=require('electron');
const path=require('node:path');
app.setName('APEX Workstation 2 Preview');
app.setPath('userData',path.join(app.getPath('appData'),'APEX-Workstation-2-Preview'));
app.whenReady().then(()=>{
 const win=new BrowserWindow({width:1470,height:930,minWidth:950,minHeight:620,backgroundColor:'#101622',title:'APEX Workstation 2 Preview — DEMO ONLY',webPreferences:{preload:path.join(__dirname,'preload.js'),nodeIntegration:false,contextIsolation:true,sandbox:false,webSecurity:true}});
 win.removeMenu();
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(!url.startsWith('file://'))e.preventDefault();});
 win.loadFile(path.join(__dirname,'index.html'));
});
app.on('window-all-closed',()=>app.quit());
