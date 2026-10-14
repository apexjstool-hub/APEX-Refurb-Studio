'use strict';
const {app,BrowserWindow}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{pathToFileURL}=require('node:url');
app.whenReady().then(async()=>{
 let win;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-login-ui-'));
 try{
  const renderer=path.resolve(__dirname,'../src/renderer');
  let html=fs.readFileSync(path.join(renderer,'index.html'),'utf8').replace(/<script\b[\s\S]*?<\/script>/g,'').replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/,'').replace(/href="([^"]+\.css)"/g,(_,p)=>'href="'+pathToFileURL(path.join(renderer,p)).href+'"');
  fs.writeFileSync(path.join(dir,'index.html'),html);
  win=new BrowserWindow({show:false,width:1366,height:900,webPreferences:{contextIsolation:true,nodeIntegration:false}});
  await win.loadFile(path.join(dir,'index.html'));
  await win.webContents.executeJavaScript("var $=id=>document.getElementById(id);var calls={resume:0,cloud:0,local:0};var api={cloudLoginInfo:async()=>({ok:true,configured:true}),cloudRememberedInfo:async()=>({remembered:true,email:'test@example.com'}),cloudResume:async()=>{calls.resume++;return {ok:false,error:'Test only'}},cloudStaffLogin:async c=>{calls.cloud++;return {ok:false,error:'Test only'}},login:async c=>{calls.local++;return {ok:false,error:'Test only'}}};document.documentElement.dataset.theme='light';");
  const source=fs.readFileSync(path.join(renderer,'app.js'),'utf8'),start=source.indexOf("let apexLoginMode="),end=source.indexOf("$('sidebarUser').onclick",start);
  if(start<0||end<0)throw Error('Login source boundaries missing.');
  await win.webContents.executeJavaScript(source.slice(start,end));
  await new Promise(r=>setTimeout(r,100));
  let r=await win.webContents.executeJavaScript("(()=>{const box=$('apexRememberCloudBox'),input=$('apexRememberCloud'),label=box.querySelector('span'),a=input.getBoundingClientRect(),b=label.getBoundingClientRect();return {mode:apexLoginMode,automatic:calls.resume+calls.cloud+calls.local,checkboxWidth:a.width,checkboxHeight:a.height,gap:b.left-a.right,aligned:Math.abs(a.top+a.height/2-b.top-b.height/2),saved:!$('loginSavedHint').classList.contains('hidden'),sharedTab:getComputedStyle($('loginCloudMode')).display,alternate:getComputedStyle($('loginLocalMode')).display,remember:getComputedStyle(box).display};})()");
  if(r.mode!=='cloud'||r.automatic!==0||r.checkboxWidth>20||r.checkboxHeight>20||r.gap<0||r.gap>12||r.aligned>3||!r.saved||r.sharedTab!=='none'||r.alternate==='none'||r.remember!=='flex')throw Error('Shared login layout failed: '+JSON.stringify(r));
  await win.webContents.executeJavaScript("$('loginForm').dispatchEvent(new Event('submit',{cancelable:true}));");
  await new Promise(r=>setTimeout(r,50));
  if(!await win.webContents.executeJavaScript("calls.resume===1&&calls.cloud===0&&calls.local===0&&$('loginPass').required"))throw Error('Saved sign-in did not wait for manual submit or failed to require password on expired session.');
  await win.webContents.executeJavaScript("$('loginLocalMode').click();$('loginUser').value='test';$('loginPass').value='test-password';$('loginForm').dispatchEvent(new Event('submit',{cancelable:true}));");
  await new Promise(r=>setTimeout(r,50));
  if(!await win.webContents.executeJavaScript("apexLoginMode==='local'&&calls.local===1&&getComputedStyle($('apexRememberCloudBox')).display==='none'&&getComputedStyle($('loginLocalMode')).display==='none'&&getComputedStyle($('loginCloudMode')).display!=='none'"))throw Error('Alternate local administrator sign-in failed.');
  await win.webContents.executeJavaScript("$('loginCloudMode').click();$('loginCloudEmail').value='staff@example.com';$('loginPass').value='test-password';$('loginForm').dispatchEvent(new Event('submit',{cancelable:true}));");
  await new Promise(r=>setTimeout(r,50));
  if(!await win.webContents.executeJavaScript("calls.cloud===1&&apexLoginMode==='cloud'"))throw Error('Shared account password route failed.');
  console.log('PASS: Remember me aligns, one sign-in form retains both account routes, saved sign-in waits for manual submit.');
  win.destroy();fs.rmSync(dir,{recursive:true,force:true});app.exit(0);
 }catch(e){console.error(e);if(win&&!win.isDestroyed())win.destroy();fs.rmSync(dir,{recursive:true,force:true});app.exit(1);}
});
