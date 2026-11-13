'use strict';
/* Concept B Device Details quick actions. No new persistence or mutation path. */
(function(){
 const $=id=>document.getElementById(id);
 const toolbar=$('apexDeviceActions');
 if(!toolbar)return;
 const back=$('apexDeviceBack'),print=$('apexDevicePrint'),parts=$('apexDeviceParts');
 const heading=$('apexDeviceActionTitle'),subtitle=$('apexDeviceActionSubtitle');
 back?.addEventListener('click',()=>$('deviceReturnInventory')?.click());
 print?.addEventListener('click',()=>{
  const existing=$('assetPrintLabel');
  if(existing&&!existing.disabled)existing.click();
  else if(!existing)window.notify?.('Open a saved asset to print its QR or barcode label.');
 });
 parts?.addEventListener('click',()=>{
  const tab=$('v3AssetTabs')?.querySelector('[data-asset-tab="parts"]');
  tab?.click();
 });
 function update(){
  if(!heading||!subtitle)return;
  const isNew=!activeAssetId;
  const name=$('assetSummary')?.querySelector('.device-card-heading h2')?.textContent?.trim();
  heading.textContent=isNew?'New device intake':name||'Device details';
  subtitle.textContent=isNew?'Complete device identity and save to inventory.':'Edit specifications, track refurbishment and review the audit trail.';
  if(print)print.disabled=isNew;
  if(parts)parts.disabled=isNew;
 }
 const assetSection=$('assetPage');
 const observer=new MutationObserver(update);
 observer.observe($('assetSummary'),{childList:true,subtree:true});
 observer.observe(assetSection,{attributes:true,attributeFilter:['data-section','class']});
 update();
})();
