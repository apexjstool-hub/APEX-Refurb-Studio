'use strict';
try {
 if (localStorage.getItem('apex-inventory-appearance-v1') === 'dark') {
  document.documentElement.dataset.theme = 'dark';
  document.documentElement.dataset.apexDesign = 'classic';
 }
} catch {}
