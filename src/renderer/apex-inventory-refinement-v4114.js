'use strict';
/* Inventory-only progressive enhancement. Moves existing controls, never changes stored assets. */
(function(){
 let updating=false;
 function decorate(){
  if(updating)return;
  const page=document.getElementById('inventoryPage');
  if(!page)return;
  updating=true;
  try{
   const toolbar=document.getElementById('selection-toolbar-inventory');
   const views=document.getElementById('inventoryViewControls');
   if(toolbar&&views&&views.parentElement!==toolbar)toolbar.appendChild(views);
   const table=document.querySelector('#inventoryTable .asset-table');
   if(!table)return;
   for(const button of table.querySelectorAll('[data-delete-asset]')){
    if(button.closest('.inventory-row-actions-menu'))continue;
    const cell=button.closest('td');
    if(!cell)continue;
    const menu=document.createElement('details');menu.className='inventory-row-actions-menu';
    const trigger=document.createElement('summary');trigger.textContent='⋯';
    trigger.setAttribute('aria-label','Actions for asset '+String(button.dataset.deleteAsset||''));
    trigger.title='Asset actions';
    const options=document.createElement('div');options.className='inventory-row-actions-panel';
    // Move the original delete button so its existing confirmation event handler remains intact.
    button.textContent='Delete asset';
    options.appendChild(button);
    menu.append(trigger,options);
    cell.appendChild(menu);
    menu.addEventListener('toggle',()=>{
     if(menu.open)for(const other of table.querySelectorAll('.inventory-row-actions-menu[open]'))if(other!==menu)other.open=false;
    });
   }
  }finally{updating=false;}
 }
 document.addEventListener('click',e=>{
  if(e.target.closest('.inventory-row-actions-menu'))return;
  for(const menu of document.querySelectorAll('#inventoryTable .inventory-row-actions-menu[open]'))menu.open=false;
 });
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape')return;
  for(const menu of document.querySelectorAll('#inventoryTable .inventory-row-actions-menu[open]'))menu.open=false;
 });
 window.ApexInventoryRefinement=Object.freeze({decorate});
})();
