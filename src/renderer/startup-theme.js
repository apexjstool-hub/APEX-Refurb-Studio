'use strict';
try {
 if (localStorage.getItem('apex-inventory-appearance-v1') === 'dark') {
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.dataset.apexDesign = 'classic';
 }
} catch {}

try {
 if(document.documentElement.dataset.layout==='evolution'){
  const font=localStorage.getItem('apex-studio-font-v1'),accent=localStorage.getItem('apex-studio-accent-v1');
  if(['original','segoe','inter','jakarta','arial'].includes(font))document.documentElement.dataset.studioFont=font;
  if(['cobalt','indigo','teal','slate'].includes(accent))document.documentElement.dataset.studioAccent=accent;
 }
}catch{}
