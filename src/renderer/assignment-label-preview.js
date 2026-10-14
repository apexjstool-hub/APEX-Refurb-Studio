'use strict';
try{
 const input=JSON.parse(new URLSearchParams(location.search).get('label')||'{}');document.body.className=input.size==='4x2'?'large':'';document.body.innerHTML=window.ApexAssignmentDocuments.labelMarkup(input,input.size,Number(input.dpi));
 if(input.preview){const [w,h]=window.ApexAssignmentDocuments.sizes[input.size],sheet=document.querySelector('.assignment-label');document.documentElement.style.width='100%';document.documentElement.style.height='100%';document.documentElement.style.overflow='hidden';document.body.style.width='100%';document.body.style.height='100%';document.body.style.overflow='hidden';const resize=()=>{sheet.style.transformOrigin='top left';sheet.style.transform='scale('+Math.min(innerWidth/(w*96/25.4),innerHeight/(h*96/25.4))+')';};resize();window.addEventListener('resize',resize);}
 window.assignmentLabelPreviewReady=true;
}catch(e){document.body.textContent=e.message;window.assignmentLabelPreviewError=e.message;}
