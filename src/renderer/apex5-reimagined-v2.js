'use strict';
/* APEX 5 preview 2: new layouts reuse the existing navigation event handlers.
   This file never invokes database writes. */
(function(){
 const routes={inventory:'inventory',scan:'bulk',parts:'parts',qc:'qc'};
 document.querySelectorAll('[data-ap5-action]').forEach(button=>{
  button.addEventListener('click',()=>{
   const route=routes[button.dataset.ap5Action];
   if(route&&typeof setPage==='function')setPage(route);
  });
 });
 const summary=document.getElementById('assetSummary');
 const rail=document.querySelector('.ap5-v2-device-rail');
 if(summary&&rail)summary.setAttribute('aria-label','Selected device overview');
})();
