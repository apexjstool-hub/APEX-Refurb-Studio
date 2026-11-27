'use strict';
// Use real renderer markup and styles, with every application script removed.
// No production preload, credentials, database, network or account is accessed.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-palette-smoke-'));
app.setPath('userData',dir);
app.disableHardwareAcceleration();
const renderer=path.join(__dirname,'../src/renderer');
const fixture=path.join(renderer,'.appearance-smoke.html');
let win;
const timer=setTimeout(()=>finish(1,Error('Renderer smoke timed out')),45000);
function finish(code,error){clearTimeout(timer);if(error)console.error(error);if(win&&!win.isDestroyed())win.destroy();try{fs.rmSync(fixture,{force:true});}catch{}app.exit(code);}
app.whenReady().then(async()=>{
 const html=fs.readFileSync(path.join(renderer,'index-evolution.html'),'utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 fs.writeFileSync(fixture,html);
 win=new BrowserWindow({show:false,width:1536,height:900,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
 await win.loadFile(fixture);
 const result=await win.webContents.executeJavaScript('('+(()=>{
  const out=[];
  for(const theme of ['light','dark'])for(const accent of ['cobalt','indigo','teal','slate']){
   const root=document.documentElement;root.dataset.theme=theme;root.dataset.apexDesign=theme==='dark'?'classic':'minimal';root.dataset.studioAccent=accent;
   const style=selector=>getComputedStyle(document.querySelector(selector));
   out.push({theme,accent,button:style('#loginForm button[type="submit"]').backgroundColor,art:style('#loginPage .login-left').backgroundImage,sidebar:style('#apexSidebar').backgroundColor,primary:style('#dashAdd').backgroundColor});
  }
  return out;
 }).toString()+')()');
 const expected={cobalt:'rgb(40, 87, 181)',indigo:'rgb(81, 69, 184)',teal:'rgb(8, 123, 120)',slate:'rgb(71, 85, 105)'};
 for(const row of result){assert.equal(row.button,expected[row.accent],JSON.stringify(row));assert.equal(row.primary,expected[row.accent],JSON.stringify(row));assert.match(row.art,/gradient/);}
 for(const theme of ['light','dark']){const rows=result.filter(r=>r.theme===theme);assert.equal(new Set(rows.map(r=>r.art)).size,4,'login artwork must change');assert.equal(new Set(rows.map(r=>r.sidebar)).size,4,'sidebar must change');}
 console.log(JSON.stringify(result));finish(0);
}).catch(error=>finish(1,error));
