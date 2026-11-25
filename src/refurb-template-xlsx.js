'use strict';
const zlib=require('node:zlib');const {archive,xml,col}=require('./xlsx-export');
function readArchive(buffer){
 let end=buffer.length-22;while(end>=Math.max(0,buffer.length-65557)&&buffer.readUInt32LE(end)!==0x06054b50)end--;if(end<0)throw Error('Invalid template archive.');
 const count=buffer.readUInt16LE(end+10);let position=buffer.readUInt32LE(end+16);const entries=new Map();
 for(let i=0;i<count;i++){
  if(buffer.readUInt32LE(position)!==0x02014b50)throw Error('Invalid template directory.');const method=buffer.readUInt16LE(position+10),size=buffer.readUInt32LE(position+20),nameLength=buffer.readUInt16LE(position+28),extra=buffer.readUInt16LE(position+30),comment=buffer.readUInt16LE(position+32),offset=buffer.readUInt32LE(position+42),name=buffer.subarray(position+46,position+46+nameLength).toString('utf8');const start=offset+30+buffer.readUInt16LE(offset+26)+buffer.readUInt16LE(offset+28);const compressed=buffer.subarray(start,start+size);entries.set(name,method===8?zlib.inflateRawSync(compressed):method===0?compressed:(()=>{throw Error('Unsupported template compression.');})());position+=46+nameLength+extra+comment;
 }
 return entries;
}
function workbook(rows){
 if(!Array.isArray(rows)||rows.length<1||rows.length>30001||rows[0]?.length<16||rows[0]?.length>2008||rows[0].length%2!==0||rows.some(r=>!Array.isArray(r)||r.length!==rows[0].length))throw Error('Invalid template export rows.');
 const columns=rows[0].length,slots=(columns-8)/2,totalIndex=6+slots*2,notesIndex=totalIndex+1,lastColumn=col(columns-1);
 const entries=readArchive(Buffer.from(require('./templates/refurb-parts-template.json').base64,'base64'));
 let sheet=entries.get('xl/worksheets/sheet1.xml').toString('utf8');const row=r=>sheet.match(new RegExp('<row\\b[^>]*\\br="'+r+'"[^>]*>[\\s\\S]*?</row>'))?.[0];let header=row(1);const prototype=row(2),lastBody=row(32),tail=row(34);if(!header||!prototype)throw Error('Template rows are missing.');
 const styles=source=>Object.fromEntries([...source.matchAll(/<c\b([^>]*?)\br="([A-Z]+)\d+"([^>]*?)(?:\/>|>)/g)].map(m=>[m[2],(m[1]+m[3]).match(/\bs="(\d+)"/)?.[1]||'0']));
 const regular=styles(prototype),bottom=styles(lastBody),totalStyles=styles(row(33));const count=Math.max(31,rows.length-1),total=count+2,last=count+3;
 const sourceHeaderStyle=styles(header);
 const styleFor=(style,c)=>c<6?(style[col(c)]||'5'):c<totalIndex?(style[c%2===0?'G':'H']||'5'):c===totalIndex?(style.O||'5'):(style.P||style.G||'5');
 header='<row r="1" spans="1:'+columns+'">'+rows[0].map((name,c)=>'<c r="'+col(c)+'1" s="'+(c<6?(sourceHeaderStyle[col(c)]||'3'):(c%2===0?'22':'4'))+'" t="inlineStr"><is><t>'+xml(name)+'</t></is></c>').join('')+'</row>';

 const formula=prototype.match(/<c\b[^>]*r="O2"[^>]*>\s*<f[^>]*>([\s\S]*?)<\/f>/)?.[1];if(!formula)throw Error('Template total formula is missing.');
 const widths=[18,44,34,18,30,26];for(let i=0;i<slots;i++)widths.push(30,15);widths.push(16,55);
 const height=values=>Math.max(30,...values.map((v,i)=>{const limit=Math.max(8,Math.floor(widths[i]-4)),lines=String(v??'').split(/\r?\n/).reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/limit)),0);return Math.min(409,lines*16+10);}));
 const output=[header];
 for(let index=0;index<count;index++){
  const r=index+2,values=rows[index+1]||Array(columns).fill(null),style=index===count-1?bottom:regular;
  output.push(`<row r="${r}" spans="1:${columns}" ht="${height(values)}" customHeight="1">`+values.map((v,c)=>{const letter=col(c),s=styleFor(style,c);if(c===totalIndex)return `<c r="${letter+r}" s="${s}"><f>SUM(${Array.from({length:slots},(_,i)=>col(7+i*2)+r).join(',')})</f><v>0</v></c>`;if(c>=7&&c<totalIndex&&c%2===1&&v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v)))return `<c r="${letter+r}" s="${s}"><v>${Number(v)}</v></c>`;if(v===null||v===undefined||v==='')return `<c r="${letter+r}" s="${s}"/>`;return `<c r="${letter+r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v).slice(0,32000))}</t></is></c>`;}).join('')+'</row>');
 }
 output.push(`<row r="${total}" spans="1:${columns}">`+Array.from({length:columns},(_,c)=>{const letter=col(c);return `<c r="${letter+total}" s="${totalStyles[letter]||totalStyles[c%2===1?'H':'G']||16}">`+((c>=7&&c<totalIndex&&c%2===1)||c===totalIndex?`<f>SUM(${letter}2:${letter}${count+1})</f><v>0</v>`:'')+'</c>';}).join('')+'</row>');
 if(tail)output.push(tail.replace(/r="([A-Z]*)(34)"/g,(_,l)=>`r="${l}${last}"`));
 sheet=sheet.replace(/<sheetData>[\s\S]*?<\/sheetData>/,'<sheetData>'+output.join('')+'</sheetData>').replace(/<dimension ref="[^"]*"\/>/,`<dimension ref="A1:${lastColumn}${last}"/>`);sheet=sheet.replace(/<cols>[\s\S]*?<\/cols>/,'<cols>'+widths.map((width,i)=>'<col min="'+(i+1)+'" max="'+(i+1)+'" width="'+width+'" customWidth="1"/>').join('')+'</cols>');entries.set('xl/worksheets/sheet1.xml',Buffer.from(sheet));
 let table=entries.get('xl/tables/table1.xml').toString();
 const tableCols='<tableColumns count="'+columns+'">'+rows[0].map((name,c)=>'<tableColumn id="'+(c+1)+'" name="'+xml(name)+'"/>').join('')+'</tableColumns>';
 table=table.replace(/<tableColumns\b[^>]*>[\s\S]*?<\/tableColumns>/,tableCols).replace(/ref="A1:O\d+"/,'ref="A1:'+lastColumn+total+'"').replace(/(<autoFilter[^>]*ref=")[^"]*(")/,'$1A1:'+lastColumn+(total-1)+'$2');
 entries.set('xl/tables/table1.xml',Buffer.from(table));

 // Stale calculation chains reference the old row count. Excel recalculates the preserved formulas.
 entries.delete('xl/calcChain.xml');for(const filename of ['[Content_Types].xml','xl/_rels/workbook.xml.rels'])entries.set(filename,Buffer.from(entries.get(filename).toString().replace(/<(?:Override|Relationship)\b[^>]*(?:calcChain)[^>]*\/>/g,'')));
 let wb=entries.get('xl/workbook.xml').toString();wb=wb.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');entries.set('xl/workbook.xml',Buffer.from(wb));
 // Preserve the reference styles and add wrapping only to populated text body styles.
 let styleXml=entries.get('xl/styles.xml').toString();
 styleXml=styleXml.replace(/<name val="(?:Aptos Narrow|Arial|Calibri)"\s*\/>/g,'<name val="Aptos"/>');const section=styleXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);if(section){let n=0;const textStyles=new Set([0,1,2,3,4,5,6,8,10,12].flatMap(c=>[Number(regular[col(c)]),Number(bottom[col(c)])]));const content=section[1].replace(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g,xf=>{const i=n++;if(!textStyles.has(i))return xf;xf=xf.replace(/numFmtId="[^"]*"/,'numFmtId="49"').replace(/\s+applyAlignment="[^"]*"/g,'').replace(/<xf\b/,'<xf applyAlignment="1"');if(xf.endsWith('/>'))return xf.slice(0,-2)+'><alignment wrapText="1" vertical="center"/></xf>';if(/<alignment\b/.test(xf))return xf.replace(/<alignment\b([^>]*?)\/>/,(_,a)=>'<alignment'+a.replace(/\s+wrapText="[^"]*"/g,'')+' wrapText="1"/>');return xf.replace('</xf>','<alignment wrapText="1" vertical="center"/></xf>');});styleXml=styleXml.replace(section[0],section[0].replace(section[1],content));entries.set('xl/styles.xml',Buffer.from(styleXml));}
 // Light alternate-row shading improves legibility without altering formulas.
 const fills=styleXml.match(/<fills\b([^>]*)>([\s\S]*?)<\/fills>/);
 const xfs=styleXml.match(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/);
 if(fills&&xfs){
  const fillCount=Number(fills[1].match(/\bcount="(\d+)"/)?.[1]);
  const styles=[...xfs[2].matchAll(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g)].map(m=>m[0]);
  if(Number.isSafeInteger(fillCount)&&styles.length){
   const extra='<fill><patternFill patternType="solid"><fgColor rgb="FFF2F6FB"/><bgColor indexed="64"/></patternFill></fill>';
   styleXml=styleXml.replace(fills[0],'<fills'+fills[1].replace(/count="\d+"/,'count="'+(fillCount+1)+'"')+'>'+fills[2]+extra+'</fills>');
   const newStyles=[],mapping=new Map();
   for(const id of new Set([0,1,2,3,4,5,6,8,10,12,15].flatMap(c=>[Number(regular[col(c)]),Number(bottom[col(c)])]))){
    if(!Number.isSafeInteger(id)||id<0||!styles[id])continue;
    const derived=styles[id].replace(/\bfillId="\d+"/,'fillId="'+fillCount+'"').replace(/\bapplyFill="\d+"/,'applyFill="1"');
    mapping.set(String(id),String(styles.length+newStyles.length));newStyles.push(derived);
   }
   styleXml=styleXml.replace(xfs[0],'<cellXfs'+xfs[1].replace(/count="\d+"/,'count="'+(styles.length+newStyles.length)+'"')+'>'+xfs[2]+newStyles.join('')+'</cellXfs>');
   sheet=sheet.replace(/<row r="(\d+)"[^>]*>[\s\S]*?<\/row>/g,block=>{
    const r=Number(block.match(/<row r="(\d+)"/)?.[1]);
    if(!Number.isInteger(r)||r<2||r>count+1||r%2!==1)return block;
    return block.replace(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g,cell=>{
     const key=cell.match(/\bs="(\d+)"/)?.[1],next=mapping.get(key);
     return next?cell.replace(/\bs="\d+"/,'s="'+next+'"'):cell;
    });
   });
   entries.set('xl/worksheets/sheet1.xml',Buffer.from(sheet));
  }
 }
 entries.set('xl/styles.xml',Buffer.from(styleXml));
 return archive([...require('./xlsx-brand').brand(entries,'Refurb Parts Required')]);
}
module.exports={workbook,readArchive};
