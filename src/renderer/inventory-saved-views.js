'use strict';
/* Inventory column sorting and local sort preference.
   Saved-view creation, selection and deletion controls have been retired. */
(function(){
 const sortKey='apex.inventory.sort.v1';
 const $=id=>document.getElementById(id);
 const read=()=>{try{const raw=localStorage.getItem(sortKey);return raw?JSON.parse(raw):null;}catch{return null;}};
 const write=value=>{try{localStorage.setItem(sortKey,JSON.stringify(value));}catch{/* Sorting still works without local persistence. */}};
 const existingSort=read();
 if(existingSort){try{window.ApexInventorySort.configure(existingSort.key,existingSort.direction);}catch{}}
 const headings=[['Device / asset','device'],['Condition','condition'],['Location','location'],['Pallet','pallet'],['Status','status'],['Repair progress','repair'],['Time waiting','waiting']];
 function decorate(){
  // Remove any old saved-view toolbar left behind by a hot-reloaded UI.
  $('inventoryViewControls')?.remove();
  const table=$('inventoryTable')?.querySelector('table');
  if(!table||table.dataset.apexSortDecorated)return;
  table.dataset.apexSortDecorated='1';
  const chosen=window.ApexInventorySort.get();
  for(const [title,key] of headings){
   const cell=[...table.tHead.rows[0].cells].find(th=>th.textContent.trim()===title);
   if(!cell)continue;
   const label=cell.textContent;cell.textContent='';cell.classList.add('apex-sort-heading');
   const button=document.createElement('button');button.type='button';button.className='apex-sort-button';button.dataset.apexSort=key;
   const isActive=chosen.key===key;
   button.textContent=label+(isActive?(chosen.direction==='asc'?' ↑':' ↓'):' ↕');
   button.title='Sort Inventory by '+label;
   cell.setAttribute('aria-sort',isActive?(chosen.direction==='asc'?'ascending':'descending'):'none');
   button.onclick=()=>{
    const current=window.ApexInventorySort.get(),dir=current.key===key&&current.direction==='asc'?'desc':'asc';
    window.ApexInventorySort.configure(key,dir);
    write(window.ApexInventorySort.get());
    inventoryPageIndex=0;render();
   };
   cell.append(button);
  }
 }
 const previousRender=render;
 render=function(...args){const result=previousRender(...args);decorate();return result;};
 document.addEventListener('DOMContentLoaded',decorate,{once:true});
 decorate();
})();
