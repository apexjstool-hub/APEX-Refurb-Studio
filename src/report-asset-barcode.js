/* Printed reports: Code 128-B asset barcodes. QR labels and underlying IDs stay unchanged. */
(function(root,factory){
 const value=factory();
 if(typeof module==='object'&&module.exports)module.exports=value;
 else root.ApexReportBarcode=value;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function inline(id,encoder){
  const text=String(id??'').trim();
  if(!text)return '';
  let bars='';
  try{bars=encoder?.code128Svg(text,{preserveCase:true})||'';}catch{}
  const units=Number(bars.match(/viewBox="0 0 ([0-9.]+)/)?.[1]);
  // Preserve a minimum module width for reliable printing instead of squeezing long IDs.
  const width=Number.isFinite(units)&&units>0?Math.max(24,Math.ceil(units*0.254)):30;
  // Explicit SVG dimensions survive print-preview CSP blocking inline styles.
  const sizedBars=bars.replace('<svg ', '<svg width="'+width+'mm" height="7mm" ');
  return '<div class="apex-report-asset-code"><span class="apex-report-asset-id">'+esc(text)+'</span>'+(bars?'<span class="apex-report-bars">'+sizedBars+'</span>':'')+'</div>';
 }
 function td(id,encoder){return '<td class="apex-report-asset-cell">'+inline(id,encoder)+'</td>';}
 const printStyles=`<style id="apexReportBarcodeStyles">
 .apex-report-asset-code{display:inline-flex;flex-direction:column;align-items:flex-start;gap:0;break-inside:avoid;page-break-inside:avoid;max-width:100%;vertical-align:middle}
 .apex-report-asset-id{display:block;font-weight:700;color:#111;white-space:nowrap;font:700 9pt Arial,sans-serif}
 .apex-report-bars{display:block;width:max-content;height:7mm;max-width:none;background:white;overflow:visible}
 .apex-report-bars svg{width:auto!important;height:7mm!important;display:block!important;background:white!important}
 .apex-report-asset-cell{vertical-align:middle}
 @media print{.apex-report-asset-code,.apex-report-bars{break-inside:avoid!important;print-color-adjust:exact!important;-webkit-print-color-adjust:exact!important}}
 </style>`;
 return Object.freeze({inline,td,printStyles});
});
