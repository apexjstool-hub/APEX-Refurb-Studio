'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexAppearance=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 const KEY='apex-studio-appearance-v2';
 const defaults=Object.freeze({theme:'light',font:'original',accent:'cobalt'});
 const allowed={theme:['light','dark'],font:['original','segoe','inter','jakarta','arial'],accent:['cobalt','indigo','teal','slate']};
 const normalize=value=>Object.fromEntries(Object.keys(defaults).map(k=>[k,allowed[k].includes(value?.[k])?value[k]:defaults[k]]));
 function read(storage){try{const raw=storage.getItem(KEY);if(raw)return normalize(JSON.parse(raw));return normalize({theme:storage.getItem('apex-inventory-appearance-v1'),font:storage.getItem('apex-studio-font-v1'),accent:storage.getItem('apex-studio-accent-v1')});}catch{return {...defaults};}}
 function save(storage,value){const next=normalize(value);storage.setItem(KEY,JSON.stringify(next));return next;}
 function apply(root,value){const next=normalize(value);root.dataset.theme=next.theme;root.dataset.apexDesign=next.theme==='dark'?'classic':'minimal';root.dataset.studioFont=next.font;root.dataset.studioAccent=next.accent;return next;}
 return {KEY,defaults,allowed,normalize,read,save,apply};
});
