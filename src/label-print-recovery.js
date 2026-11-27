'use strict';
function withDeadline(promise,ms,message){
 let timer;
 return Promise.race([Promise.resolve(promise),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));
}
function printWithDeadline(contents,options,ms){
 const task=new Promise(resolve=>contents.print(options,(success,reason)=>{
  if(success)resolve({ok:true});
  else if(!reason||/cancel/i.test(reason))resolve({ok:false,cancelled:true});
  else resolve({ok:false,error:String(reason)});
 }));
 return withDeadline(task,ms,'Printer did not respond. Close any printer dialog and check the Windows print queue before retrying, to avoid duplicate stickers.');
}
module.exports={withDeadline,printWithDeadline};
