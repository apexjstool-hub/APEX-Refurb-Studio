'use strict';
(()=>{
 const api=window.apexInventory;
 const bar=document.getElementById('apexNativeTitlebar');
 if(!api?.nativeWindowChrome||!bar)return;
 const root=document.documentElement;
 root.setAttribute('data-apex-native-window','');
 bar.hidden=false;
 let last='';
 function sync(){const theme=root.dataset.theme==='dark'?'dark':'light';if(theme===last)return;last=theme;api.windowTheme(theme).catch(()=>{last='';});}
 new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-theme']});
 sync();
})();
