'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexReportBrand=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const logo="<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><rect x=\"8\" y=\"8\" width=\"496\" height=\"496\" rx=\"116\" fill=\"#171829\"/><rect x=\"32\" y=\"32\" width=\"448\" height=\"448\" rx=\"96\" fill=\"none\" stroke=\"#4c4568\" stroke-width=\"3\"/><path d=\"M256 86 430 398H330L256 258 182 398H82Z\" fill=\"#ad9aff\"/><path d=\"m256 340 46 82h-92Z\" fill=\"#cef578\"/></svg>";
 const styles='.apex-report-brand{display:flex;align-items:center;gap:12px;break-inside:avoid;margin-bottom:16px}.apex-report-logo{flex:0 0 36px;display:block}.apex-report-logo svg{display:block;width:36px!important;height:36px!important}.apex-report-wordmark{font:700 11px Arial,sans-serif;letter-spacing:.8px;color:#28384b}.apex-report-wordmark small{display:block;font:400 9px Arial,sans-serif;letter-spacing:0;color:#65738a;margin-top:4px}';
 function header(){return '<div class="apex-report-brand"><span class="apex-report-logo">'+logo+'</span><div class="apex-report-wordmark">APEX<small>Refurb Management Studio</small></div></div>';}
 function apply(root){for(const sheet of root.querySelectorAll('.ops-sheet')){if(sheet.querySelector('.apex-report-brand'))continue;const target=sheet.querySelector('header>div')||sheet;target.insertAdjacentHTML('afterbegin',header());}}
 return {logo,styles,header,apply};
});
