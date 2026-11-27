'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {withDeadline,printWithDeadline}=require('../src/label-print-recovery');
test('missing printer callback times out rather than locking the renderer',async()=>{let cb;await assert.rejects(printWithDeadline({print(_,callback){cb=callback;}},{},10),/check the Windows print queue/);cb(true);});
test('native cancellation, failure and success settle without retrying automatically',async()=>{for(const [ok,why,expected] of [[false,'cancelled',{ok:false,cancelled:true}],[false,'Printer offline',{ok:false,error:'Printer offline'}],[true,'',{ok:true}]]){let calls=0;assert.deepEqual(await printWithDeadline({print(_,callback){calls++;callback(ok,why);}}, {},100),expected);assert.equal(calls,1);}});
test('render deadline rejects hung preparation',async()=>{await assert.rejects(withDeadline(new Promise(()=>{}),10,'Preparation timed out'),/Preparation timed out/);});
