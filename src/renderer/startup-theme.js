'use strict';
try {
 const root=document.documentElement;
 if(root.dataset.layout==='evolution'&&window.ApexAppearance)window.ApexAppearance.apply(root,window.ApexAppearance.read(localStorage));
 else if(localStorage.getItem('apex-inventory-appearance-v1')==='dark'){root.dataset.theme='dark';root.dataset.apexDesign='classic';}
}catch{}
