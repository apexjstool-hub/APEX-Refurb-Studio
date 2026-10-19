'use strict';
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ApexLabelDesigner=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
 const sizes={'2x1':[50.8,25.4],'50x25':[50,25],'50x30':[50,30],'60x40':[60,40],'40x30':[40,30],'80x30':[80,30]};
 const fonts=['Arial','Segoe UI','Verdana','Tahoma','Trebuchet MS','Georgia','Times New Roman','Courier New'];
 const fields={assetId:'id',manufacturer:'manufacturer',model:'model',serial:'serial',grade:'condition',pallet:'pallet'};
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const text=(v,n=1000)=>{const s=String(v??'');if(s.length>n||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(s))throw Error('Label text exceeds the allowed length or contains unsupported characters.');return s;};
 const num=(v,min,max,label)=>{const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)throw Error(label+' is outside its allowed range.');return Math.round(n*1000)/1000;};
 function normalise(raw={}){
  if(!sizes[raw.size||'2x1'])throw Error('Choose a supported label size.');const size=raw.size||'2x1',[w,h]=sizes[size];
  if(!Array.isArray(raw.elements)||raw.elements.length>40)throw Error('Use up to 40 label elements.');const ids=new Set();
  const elements=raw.elements.map((e,i)=>{if(!e||!['text','barcode','qr','line','box'].includes(e.type))throw Error('Unsupported label element.');const id=String(e.id||'element-'+i);if(!/^[a-zA-Z0-9_-]{1,80}$/.test(id)||ids.has(id))throw Error('Each label element needs a different ID.');ids.add(id);
   const out={id,type:e.type,x:num(e.x,0,w,'X'),y:num(e.y,0,h,'Y'),w:num(e.w,.3,w,'Width'),h:num(e.h,.3,h,'Height'),value:text(e.value),font:fonts.includes(e.font)?e.font:'Arial',fontSize:num(e.fontSize??10,4,72,'Font size'),bold:e.bold===true,italic:e.italic===true,align:['left','center','right'].includes(e.align)?e.align:'center',human:e.human!==false,payload:e.payload==='refurb'?'refurb':'text',stroke:num(e.stroke??.25,.1,2,'Stroke')};
   if(out.x+out.w>w+.005||out.y+out.h>h+.005)throw Error('Element '+(i+1)+' extends beyond the label. Move or resize it to fit.');return out;
  });
  return {designerVersion:2,name:text(raw.name||'My label',60).trim(),size,dpi:[203,300,600].includes(Number(raw.dpi))?Number(raw.dpi):203,elements};
 }
 function value(source,record={}){return text(source).replace(/\{(assetId|manufacturer|model|serial|grade|pallet)\}/g,(_,key)=>String(record[fields[key]]??''));}
 function geometry(e,record,dpi,encoders=globalThis){
  const content=e.type==='qr'&&e.payload==='refurb'?encoders.ApexAssetLabelQR.makePayload(record):value(e.value,record);if(!String(content).trim())throw Error('Enter a value for the '+e.type+'.');
  let svg=e.type==='barcode'?encoders.ApexAssetBarcode.code128Svg(content,{preserveCase:true}):encoders.ApexAssetLabelQR.qrCodeSvg(content);
  const box=svg.match(/viewBox="0 0 (\d+) (\d+)"/);if(!box)throw Error('Unable to build the code.');const units=Number(box[1]),dot=25.4/dpi,human=e.type==='barcode'&&e.human?e.fontSize*25.4/72*1.2+.5:0;
  const available=e.type==='qr'?Math.min(e.w,e.h):e.w,dots=Math.floor((available+.00001)/(units*dot));if(dots<1)throw Error('Code is too dense. Make it wider, increase DPI or shorten its value.');const width=units*dots*dot,height=e.type==='qr'?width:e.h-human;
  if(height<(e.type==='barcode'?3:.3))throw Error('Make the barcode taller or reduce its caption font size.');
  svg=svg.replace('<svg ',`<svg width="${width.toFixed(5)}mm" height="${height.toFixed(5)}mm" `);return {svg,width,height,dots,content,human};
 }
 function markup(raw,record={},dpi,encoders=globalThis){const t=normalise(raw);return '<div class="apex-label-stock designer-label">'+t.elements.map(e=>{
  let content='';if(e.type==='text')content='<div class="ld-text">'+esc(value(e.value,record))+'</div>';
  else if(['barcode','qr'].includes(e.type)){const g=geometry(e,record,dpi||t.dpi,encoders);content='<div class="ld-code">'+g.svg+'</div>'+(e.type==='barcode'&&e.human?'<div class="ld-human">'+esc(g.content)+'</div>':'');}
  else content='<div class="ld-shape"></div>';
  return '<div class="ld-object ld-'+e.type+'-object" data-ld-id="'+esc(e.id)+'">'+content+'</div>';
 }).join('')+'</div>';}
 function applyLayout(root,raw){const t=normalise(raw),paper=root.matches?.('.designer-label')?root:root.querySelector('.designer-label');if(!paper)throw Error('Label canvas is missing.');
  const [w,h]=sizes[t.size];Object.assign(paper.style,{width:w+'mm',height:h+'mm'});
  for(const e of t.elements){const node=[...paper.children].find(n=>n.dataset.ldId===e.id);if(!node)continue;Object.assign(node.style,{left:e.x+'mm',top:e.y+'mm',width:e.w+'mm',height:e.h+'mm',fontFamily:'"'+e.font+'", '+(e.font==='Courier New'?'monospace':'sans-serif'),fontSize:e.fontSize+'pt',fontWeight:e.bold?'700':'400',fontStyle:e.italic?'italic':'normal',textAlign:e.align});
   const shape=node.querySelector('.ld-shape');if(shape)Object.assign(shape.style,e.type==='line'?{height:e.stroke+'mm',background:'#000'}:{height:'100%',border:e.stroke+'mm solid #000'});
  }return paper;
 }
 function mount(root,raw,record={},dpi){root.innerHTML=markup(raw,record,dpi);return applyLayout(root,raw);}
 function problems(root){const paper=root.matches?.('.designer-label')?root:root.querySelector('.designer-label');if(!paper)return ['No label to print.'];const errors=[];for(const node of paper.children){if(!node.matches('.ld-object'))continue;for(const text of node.querySelectorAll('.ld-text,.ld-human'))if(text.scrollWidth>text.clientWidth+1||text.scrollHeight>text.clientHeight+1)errors.push('Text does not fit in its box. Enlarge the box or reduce its font size.');}return [...new Set(errors)];}
 function element(type,w,h,id){return {id,type,x:1,y:1,w:Math.min(30,w-2),h:Math.min(type==='text'?6:14,h-2),value:type==='text'?'Your text':type==='barcode'?'1234567890':type==='qr'?'Your QR text':'',font:'Arial',fontSize:10,bold:false,italic:false,align:'center',human:true,payload:'text',stroke:.25};}
 function preset(kind='text-barcode',size='2x1'){
  const [w,h]=sizes[size],elements=[];let e;
  if(kind==='text'){e=element('text',w,h,'text-1');Object.assign(e,{x:1,y:(h-8)/2,w:w-2,h:8,fontSize:16});elements.push(e);}
  if(kind==='barcode'){e=element('barcode',w,h,'barcode-1');Object.assign(e,{x:1,y:(h-14)/2,w:w-2,h:14});elements.push(e);}
  if(kind==='text-barcode'){const total=Math.min(h-2,20),top=(h-total)/2;e=element('text',w,h,'text-1');Object.assign(e,{x:1,y:top,w:w-2,h:5,fontSize:12});elements.push(e);e=element('barcode',w,h,'barcode-1');Object.assign(e,{x:1,y:top+6,w:w-2,h:total-6});elements.push(e);}
  return normalise({name:'My label',size,dpi:203,elements});
 }
 function fromLegacy(raw){if(raw.designerVersion===2)return normalise(raw);const t=preset('blank',raw.size||'2x1'),[w,h]=sizes[t.size];t.name=raw.name||'Imported template';t.dpi=raw.dpi||203;
  if(raw.heading)t.elements.push({...element('text',w,h,'heading'),value:raw.heading,x:1,y:1,w:w-2,h:3,fontSize:7,bold:true});
  const code=raw.code||'qr',offset=code==='qr'?Math.min(h-6,w*.45)+2:1,fields=raw.fields||['id','model','serial'],map={id:'assetId',condition:'grade'};
  if(code==='qr')t.elements.push({...element('qr',w,h,'code'),x:1,y:5,w:Math.min(h-6,w*.45),h:Math.min(h-6,w*.45),payload:'refurb'});
  if(code==='barcode')t.elements.push({...element('barcode',w,h,'code'),x:1,y:5,w:w-2,h:8,value:'{assetId}',fontSize:6});
  const start=code==='barcode'?14:5,step=(h-start-1)/fields.length;
  fields.forEach((field,i)=>t.elements.push({...element('text',w,h,'field-'+i),x:offset,y:start+i*step,w:w-offset-1,h:step-.2,value:'{'+(map[field]||field)+'}',fontSize:7,align:'left'}));return normalise(t);
 }
 return {sizes,fonts,fields,normalise,value,geometry,markup,applyLayout,mount,problems,element,preset,fromLegacy};
});
