'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const read=file=>fs.readFileSync(path.join(__dirname,'../src',file),'utf8');

test('theme is restored before the first stylesheet is loaded',()=>{
 const html=read('renderer/index.html');
 assert.match(html,/<html[^>]*data-theme="light"[^>]*data-apex-design="minimal"/);
 assert.ok(html.indexOf('src="startup-theme.js"')<html.indexOf('rel="stylesheet"'));
 const dataset={theme:'light',apexDesign:'minimal'};
 vm.runInNewContext(read('renderer/startup-theme.js'),{document:{documentElement:{dataset}},localStorage:{getItem:()=> 'dark'}});
 assert.deepEqual(dataset,{theme:'dark',apexDesign:'classic'});
});

test('expired refresh session reuses the opted-in cloud password in the main process',async()=>{
 const main=read('main.js');
 const functionSource=main.slice(main.indexOf('async function resumeRememberedCloud()'),main.indexOf('const cloudLoginPublicFile='));
 let used;
 const context={
  authenticated:false,validCloudUrl:()=>true,validPublishableKey:()=>true,
  readRememberedCloud:()=>({url:'https://test.supabase.co',anonKey:'public-test',email:'test@example.com',refreshToken:'expired',password:'test-only-password'}),
  fetch:async()=>({ok:false,status:400}),AbortSignal,
  cloudStaffLogin:async input=>{used=input;return {ok:true};},
 };
 const result=await vm.runInNewContext(functionSource+'\nresumeRememberedCloud()',context);
 assert.equal(result.ok,true);
 assert.equal(used.password,'test-only-password');
 assert.equal(used.rememberMe,true);
});
