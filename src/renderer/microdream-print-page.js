'use strict';
let currentDocument=null,editable=false;
function fit(){document.body.style.zoom=Math.min(1,Math.max(.3,(innerWidth-4)/(271.6*96/25.4)));}
window.addEventListener('resize',fit);
window.getMicrodreamEdits=()=>{
 if(!currentDocument)return null;
 const edits=window.ApexMicrodreamDocuments.editable(currentDocument);
 for(const cell of document.querySelectorAll('[data-md-field]')){
  const field=cell.dataset.mdField,value=cell.textContent;
  if(field==='jobRef')edits.jobRef=value;else edits.rows[Number(cell.dataset.mdRow)][field]=value;
 }
 return edits;
};
window.setMicrodreamEditing=enabled=>{
 editable=!!enabled;
 for(const cell of document.querySelectorAll('[data-md-field]')){
  cell.contentEditable=enabled?'plaintext-only':'false';cell.spellcheck=false;
  cell.setAttribute('role','textbox');cell.setAttribute('aria-label',cell.dataset.mdField==='jobRef'?'Job Ref':`Row ${Number(cell.dataset.mdRow)+1} ${cell.dataset.mdField}`);
  if(enabled)cell.tabIndex=0;else cell.removeAttribute('tabindex');
  if(['quantity','received'].includes(cell.dataset.mdField))cell.setAttribute('inputmode','numeric');
 }
};
window.setMicrodreamJobRef=value=>{for(const cell of document.querySelectorAll('[data-md-field="jobRef"]'))cell.textContent=value;};
document.addEventListener('keydown',event=>{if(editable&&event.target.closest('[data-md-field]')&&event.key==='Enter')event.preventDefault();});
document.addEventListener('input',event=>{
 if(!editable||!event.target.closest('[data-md-field]'))return;
 const cell=event.target.closest('[data-md-field]');
 if(cell.dataset.mdField==='jobRef')window.setMicrodreamJobRef(cell.textContent);
 window.onMicrodreamEdit?.(window.getMicrodreamEdits());
});
window.renderMicrodreamDocument=async (input,options={})=>{
 currentDocument=structuredClone(input);window.microdreamReady=false;
 document.getElementById('microdreamDocument').innerHTML=window.ApexMicrodreamDocuments.markup(currentDocument,options);
 window.setMicrodreamEditing(!!options.editable);
 await document.fonts.ready;
 await Promise.all([...document.images].map(img=>img.decode()));
 fit();window.microdreamReady=true;return true;
};
window.addEventListener('message',event=>{if(event.source!==parent||event.data?.type!=='apex-microdream-preview')return;window.renderMicrodreamDocument(event.data.document).catch(e=>{window.microdreamPreviewError=e.message;});});
