'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const settings=require('../src/reminder-settings');
test('desktop alerts and tray are opt-in with safe defaults',()=>{
 assert.equal(settings.defaults.desktopNotifications,false);
 assert.equal(settings.defaults.keepInTray,false);
 assert.equal(settings.defaults.startWithWindows,false);
 assert.equal(settings.defaults.checkMinutes,15);
});
test('desktop notifications require background tray mode',()=>{
 assert.throws(()=>settings.validate({...settings.defaults,desktopNotifications:true}));
 assert.throws(()=>settings.validate({...settings.defaults,startWithWindows:true}));
 assert.equal(settings.validate({...settings.defaults,keepInTray:true,desktopNotifications:true}).desktopNotifications,true);
});
test('configured schedule persists across application restart',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'apex-tray-reminder-'));
 try{
  const filename=path.join(dir,'reminder.json');
  const saved=settings.write(filename,{...settings.defaults,keepInTray:true,desktopNotifications:true,startWithWindows:true,checkMinutes:10,repeatHours:12,ordering:2});
  assert.deepEqual(settings.read(filename),saved);
  assert.equal(saved.ordering,2);
  assert.equal(saved.repeatHours,12);
 }finally{fs.rmSync(dir,{force:true,recursive:true});}
});
test('invalid intervals are rejected without overwriting preferences',()=>{
 for(const patch of [{checkMinutes:0},{checkMinutes:121},{repeatHours:0},{repeatHours:169},{keepInTray:false,desktopNotifications:true}]){
  assert.throws(()=>settings.validate({...settings.defaults,...patch}));
 }
});
