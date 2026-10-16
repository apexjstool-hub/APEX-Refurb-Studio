'use strict';
function fit(){document.body.style.zoom=Math.min(1,Math.max(.3,(innerWidth-4)/(271.6*96/25.4)));}
window.addEventListener('resize',fit);
window.renderMicrodreamDocument=async document=>{
 document=structuredClone(document);window.microdreamReady=false;
 window.document.getElementById('microdreamDocument').innerHTML=window.ApexMicrodreamDocuments.markup(document);
 await window.document.fonts.ready;
 await Promise.all([...window.document.images].map(img=>img.decode()));
 fit();window.microdreamReady=true;return true;
};
window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='apex-microdream-preview')return;window.renderMicrodreamDocument(event.data.document).catch(e=>{window.microdreamPreviewError=e.message;});});
