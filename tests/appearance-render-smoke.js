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
 const card=require('../src/device-summary');
 const asset={id:'DEMO-01',serial:'DEMO',manufacturer:'HP',productType:'Laptop',status:'Processed',location:'Demo shelf',pallet:'DEMO-PALLET'};
 const cardMarkup=card.card(asset,{labels:['Final checks / QC']},{value:'B',source:'Demo'},String,'Demo laptop');
 const cards=await win.webContents.executeJavaScript('('+(async(markup)=>{
  const root=document.documentElement;
  root.classList.add('apex-v34');
  const summary=document.querySelector('#assetSummary');summary.innerHTML=markup;
  document.querySelector('#loginPage').classList.add('hidden');
  document.querySelector('#appPage').classList.remove('hidden');
  document.querySelector('#dashboardPage').classList.add('hidden');
  const page=document.querySelector('#assetPage');page.classList.remove('hidden');page.dataset.section='overview';
  const out=[];
  for(const theme of ['light','dark'])for(const accent of ['cobalt','indigo','teal','slate','emerald','burgundy','ocean']){
   root.dataset.theme=theme;root.dataset.apexDesign=theme==='dark'?'classic':'minimal';root.dataset.studioAccent=accent;
   void document.body.offsetHeight;await new Promise(resolve=>setTimeout(resolve,300));
   const style=s=>getComputedStyle(summary.querySelector(s));
   const status=summary.querySelector('.device-card-status');
   status.classList.remove('is-awaiting');status.classList.add('is-processed');
   const processed=style('.device-card-status').backgroundColor;
   status.classList.remove('is-processed');status.classList.add('is-awaiting');
   const awaiting=style('.device-card-status').backgroundColor;
   out.push({theme,accent,background:getComputedStyle(summary).backgroundColor,button:style('#assetPrintLabel').backgroundColor,buttonInk:style('#assetPrintLabel').color,location:style('.device-card-location').backgroundColor,art:style('.device-card-art').backgroundColor,processed,awaiting,heading:style('.device-card-heading h2').color});
  }
  return out;
 }).toString()+')('+JSON.stringify(cardMarkup)+')');
 const cardExpected={light:{cobalt:'rgb(32, 58, 91)',indigo:'rgb(48, 39, 93)',teal:'rgb(19, 70, 77)',slate:'rgb(50, 70, 91)',emerald:'rgb(24, 74, 53)',burgundy:'rgb(82, 36, 60)',ocean:'rgb(24, 72, 95)'},dark:{cobalt:'rgb(24, 43, 67)',indigo:'rgb(28, 24, 57)',teal:'rgb(16, 46, 51)',slate:'rgb(26, 41, 56)',emerald:'rgb(16, 45, 32)',burgundy:'rgb(52, 23, 42)',ocean:'rgb(17, 45, 65)'}};
 for(const row of cards){
  const detail=JSON.stringify(row);
  assert.equal(row.background,cardExpected[row.theme][row.accent],detail);
  assert.equal(row.button,row.location,detail);
  assert.equal(row.art,row.location,detail);
  assert.equal(row.processed,'rgb(22, 71, 56)',detail);
  assert.equal(row.awaiting,'rgb(81, 65, 39)',detail);
 }
 for(const theme of ['light','dark']){
  const rows=cards.filter(r=>r.theme===theme);
  assert.equal(new Set(rows.map(r=>r.button)).size,7,'print buttons must follow all seven schemes');
  assert.equal(new Set(rows.map(r=>r.buttonInk)).size,7,'print button text must follow all seven schemes');
 }
 // Use the real notification code and loaded styles on the isolated renderer fixture.
 for(const script of ['notification-session.js','message-notification-preferences.js','message-notifications.js']){
  await win.webContents.executeJavaScript(fs.readFileSync(path.join(renderer,script),'utf8'));
 }
 const notice=await win.webContents.executeJavaScript('('+(async()=>{
  document.documentElement.dataset.studioMotion='reduced'; // measure settled placement, not the entrance animation
  window.ApexNotificationSession.start();
  const preferences={...window.ApexMessageNoticePreferences.defaults,mode:'manual'};
  const data={count:2,senders:['Example colleague'],extra:0,target:'demo'};
  const get=id=>document.getElementById(id);
  window.ApexMessageNotices.show(data,null,true,{preferences});
  const preview=get('apexMessagePopupPreview'),bar=document.querySelector('#appPage .topbar');
  const bounds=el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,right:r.right,width:r.width,height:r.height};};
  const before=bounds(preview),header=bounds(bar);
  window.ApexMessageNotices.show(data,()=>{});
  const popup=get('apexMessagePopup');
  window.ApexMessageNotices.show({...data,count:4},()=>{});
  const real=bounds(popup);
  const same=popup===get('apexMessagePopup'),single=document.querySelectorAll('.apex-message-popup').length===1;
  const title=popup.querySelector('[data-notice-title]').textContent;
  window.ApexNotificationSession.stop();
  return {before,header,real,same,single,title,viewport:innerWidth,cleared:!get('apexMessagePopup')&&!get('apexMessagePopupPreview')};
 }).toString()+')()');
 assert.ok(notice.before.top>=notice.header.bottom+8,JSON.stringify(notice));
 assert.ok(notice.real.top>=notice.header.bottom+8,JSON.stringify(notice));
 assert.ok(Math.abs(notice.before.top-notice.real.top)<2,JSON.stringify(notice));
 assert.ok(notice.before.width<=312&&notice.before.height<=125,JSON.stringify(notice));
 assert.ok(Math.abs(notice.viewport-notice.real.right-16)<3,JSON.stringify(notice));
 assert.equal(notice.same,true);assert.equal(notice.single,true);assert.equal(notice.title,'4 unread messages');assert.equal(notice.cleared,true);
 console.log(JSON.stringify({appearance:result,deviceCards:cards,notice}));finish(0);
}).catch(error=>finish(1,error));
