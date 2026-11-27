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
 const result=await win.webContents.executeJavaScript('('+(async()=>{
  const remember=document.querySelector('#apexRememberCloudBox'),forget=document.querySelector('#apexForgetCloud');remember.classList.remove('hidden');forget.classList.remove('hidden');document.querySelector('#apexCloudCredentials').classList.remove('hidden');document.querySelector('#apexLocalUsername').classList.add('hidden');const dash=document.querySelector('#dashboardPage');const shortcut=document.createElement('nav');shortcut.className='apex-b-dashboard-actions';shortcut.innerHTML='<div class="apex-b-dashboard-actions-links"><button>Open work queue</button><button>Parts required</button></div>';dash.append(shortcut);const out=[];
  for(const theme of ['light','dark'])for(const accent of ['cobalt','indigo','teal','slate','emerald','burgundy','ocean']){
   const root=document.documentElement;root.dataset.theme=theme;root.dataset.apexDesign=theme==='dark'?'classic':'minimal';root.dataset.studioAccent=accent;
   // Force style resolution, then allow inherited legacy transitions to settle before asserting.
   void document.body.offsetHeight;await new Promise(resolve=>setTimeout(resolve,300));
   const style=selector=>getComputedStyle(document.querySelector(selector));
   out.push({theme,accent,button:style('#loginForm button[type="submit"]').backgroundColor,art:style('#loginPage .login-left').backgroundImage,sidebar:style('#apexSidebar').backgroundColor,primary:style('#dashAdd').backgroundColor,shortcut:style('.apex-b-dashboard-actions-links button').backgroundColor,secondary:style('.apex-b-dashboard-actions-links button:nth-child(2)').color,rememberDisplay:style('.studio-login-remember').display,checkbox:style('#apexRememberCloud').accentColor,themeRemoved:!document.querySelector('#previewLoginTheme'),inline:Math.abs((remember.getBoundingClientRect().top+remember.getBoundingClientRect().bottom)/2-(forget.getBoundingClientRect().top+forget.getBoundingClientRect().bottom)/2)<3,forgetBackground:style('#apexForgetCloud').backgroundColor});
  }
  return out;
 }).toString()+')()');
 const expected={cobalt:'rgb(40, 87, 181)',indigo:'rgb(81, 69, 184)',teal:'rgb(8, 123, 120)',slate:'rgb(71, 85, 105)',emerald:'rgb(35, 115, 77)',burgundy:'rgb(148, 59, 96)',ocean:'rgb(23, 109, 155)'};
 for(const row of result){assert.equal(row.button,expected[row.accent],JSON.stringify(row));assert.equal(row.primary,expected[row.accent],JSON.stringify(row));assert.equal(row.shortcut,expected[row.accent],JSON.stringify(row));assert.match(row.art,/gradient/);assert.equal(row.rememberDisplay,'flex');assert.equal(row.checkbox,expected[row.accent],JSON.stringify(row));assert.equal(row.themeRemoved,true);assert.equal(row.inline,true,JSON.stringify(row));assert.equal(row.forgetBackground,'rgba(0, 0, 0, 0)',JSON.stringify(row));}
 for(const theme of ['light','dark']){const rows=result.filter(r=>r.theme===theme);assert.equal(new Set(rows.map(r=>r.art)).size,7,'login artwork must change');assert.equal(new Set(rows.map(r=>r.sidebar)).size,7,'sidebar must change');}
 console.log(JSON.stringify(result));finish(0);
}).catch(error=>finish(1,error));
