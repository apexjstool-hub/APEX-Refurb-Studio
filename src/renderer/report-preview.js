'use strict';
window.addEventListener('message',event=>{
 if(event.source!==parent||event.data?.type!=='apex-report-preview')return;
 const {markup,format}=event.data;if(typeof markup!=='string')return;
 document.documentElement.dataset.format=format;document.getElementById('manifestPreviewStyles').disabled=format!=='manifest';
 const host=document.getElementById('previewContent');host.replaceChildren();
 const pane=document.createElement('div');pane.id=format==='inventory'?'printPane':format==='manifest'?'manifestPreview':'opsPrintArea';pane.innerHTML=markup;host.appendChild(pane);window.ApexReportBrand.apply(pane);
 window.apexReportPreviewReady=true;
});
