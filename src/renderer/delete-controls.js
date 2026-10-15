'use strict';
// One visual treatment; each screen retains its existing deletion handler and safeguards.
(function(){
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7"/></svg>';
 function decorate(root=document){
  const buttons=[...(root.matches?.('button')?[root]:[]),...root.querySelectorAll('button')];
  for(const b of buttons){
   if(b.dataset.apexDelete)continue;
   const text=b.textContent.trim(),known=b.matches('[data-delete-asset],[data-delete-location],[data-pallet-delete],[data-pl-delete],[data-pl-remove-pallet],[data-op="deleteOrder"],#v3DeleteAsset,#v32DeleteAll,#v32ConfirmDelete,#v344ConfirmDeleteLocation');
   if(!known&&!/\bdelete\b/i.test(text))continue;
   const entity=b.dataset.deleteAsset||b.dataset.deleteLocation||b.dataset.palletDelete||b.dataset.plDelete||b.dataset.plRemovePallet||b.dataset.id;
   const label=b.getAttribute('aria-label')||(entity?'Delete '+entity:text)||'Delete';
   const labelled=b.closest('.modal-body')||b.id==='v3DeleteAsset';
   b.dataset.apexDelete='1';b.classList.add('apex-delete-button','inventory-bin-delete');
   b.classList.toggle('apex-delete-labelled',!!labelled);b.setAttribute('aria-label',label);if(!b.title)b.title=label;
   b.replaceChildren();b.insertAdjacentHTML('afterbegin',icon);
   if(labelled){const span=document.createElement('span');span.textContent=text;b.append(span);}
  }
 }
 window.ApexDeleteControls={decorate};decorate();
 new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1)decorate(node);}).observe(document.body,{childList:true,subtree:true});
})();
