/* Offline Code128-B encoder, valid checksum and white quiet-zones, no external service. */
(function(global){'use strict';
const PATTERNS=["BaBbBb","BbBaBb","BbBbBa","AbAbBc","AbAcBb","AcAbBb","AbBbAc","AbBcAb","AcBbAb","BbAbAc","BbAcAb","BcAbAb","AaBbCb","AbBaCb","AbBbCa","AaCbBb","AbCaBb","AbCbBa","BbCbAa","BbAaCb","BbAbCa","BaCbAb","BbCaAb","CaBaCa","CaAbBb","CbAaBb","CbAbBa","CaBbAb","CbBaAb","CbBbAa","BaBaBc","BaBcBa","BcBaBa","AaAcBc","AcAaBc","AcAcBa","AaBcAc","AcBaAc","AcBcAa","BaAcAc","BcAaAc","BcAcAa","AaBaCc","AaBcCa","AcBaCa","AaCaBc","AaCcBa","AcCaBa","CaCaBa","BaAcCa","BcAaCa","BaCaAc","BaCcAa","BaCaCa","CaAaBc","CaAcBa","CcAaBa","CaBaAc","CaBcAa","CcBaAa","CaDaAa","BbAdAa","DcAaAa","AaAbBd","AaAdBb","AbAaBd","AbAdBa","AdAaBb","AdAbBa","AaBbAd","AaBdAb","AbBaAd","AbBdAa","AdBaAb","AdBbAa","BdAbAa","BbAaAd","DaCaAa","BdAaAb","AcDaAa","AaAbDb","AbAaDb","AbAbDa","AaDbAb","AbDaAb","AbDbAa","DaAbAb","DbAaAb","DbAbAa","BaBaDa","BaDaBa","DaBaBa","AaAaDc","AaAcDa","AcAaDa","AaDaAc","AaDcAa","DaAaAc","DaAcAa","AaCaDa","AaDaCa","CaAaDa","DaAaCa","BaAdAb","BaAbAd","BaAbCb","BcCaAaB"];
function escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function code128Svg(value,options={}){
 const raw=String(value??''),text=options.preserveCase?raw:raw.trim().toUpperCase();
 if(!text||![...text].every(c=>c.charCodeAt(0)>=32&&c.charCodeAt(0)<=126))throw Error('Asset ID contains characters unsupported by Code 128.');
 const values=[104,...[...text].map(c=>c.charCodeAt(0)-32)];
 let sum=104;for(let i=1;i<values.length;i++)sum+=values[i]*i;
 values.push(sum%103,106);
 let x=12,rects='';const height=50;
 for(const v of values){const p=PATTERNS[v];for(let i=0;i<p.length;i++){const c=p[i],w=c.toUpperCase().charCodeAt(0)-64;if(c===c.toUpperCase())rects+='<rect x="'+x+'" y="0" width="'+w+'" height="'+height+'"/>';x+=w;}}
 const width=x+12;
 return '<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Code 128 barcode for asset '+escape(text)+'" viewBox="0 0 '+width+' '+height+'" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="'+width+'" height="'+height+'" fill="white"/><g fill="black">'+rects+'</g></svg>';
}
global.ApexAssetBarcode=Object.freeze({code128Svg});
})(typeof window!=='undefined'?window:globalThis);

