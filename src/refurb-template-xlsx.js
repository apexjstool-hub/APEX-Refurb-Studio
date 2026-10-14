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
 if(!Array.isArray(rows)||rows.length<1||rows.length>30001||rows.some(r=>!Array.isArray(r)||r.length!==15))throw Error('Invalid template export rows.');
 const entries=readArchive(Buffer.from(require('./templates/refurb-parts-template.json').base64,'base64'));
 let sheet=entries.get('xl/worksheets/sheet1.xml').toString('utf8');const row=r=>sheet.match(new RegExp('<row\\b[^>]*\\br="'+r+'"[^>]*>[\\s\\S]*?</row>'))?.[0];const header=row(1),prototype=row(2),lastBody=row(32),tail=row(34);if(!header||!prototype)throw Error('Template rows are missing.');
 const styles=source=>Object.fromEntries([...source.matchAll(/<c\b([^>]*?)\br="([A-Z]+)\d+"([^>]*?)(?:\/>|>)/g)].map(m=>[m[2],(m[1]+m[3]).match(/\bs="(\d+)"/)?.[1]||'0']));
 const regular=styles(prototype),bottom=styles(lastBody),totalStyles=styles(row(33));const count=Math.max(31,rows.length-1),total=count+2,last=count+3;
 const formula=prototype.match(/<c\b[^>]*r="O2"[^>]*>\s*<f[^>]*>([\s\S]*?)<\/f>/)?.[1];if(!formula)throw Error('Template total formula is missing.');
 const output=[header];
 for(let index=0;index<count;index++){
  const r=index+2,values=rows[index+1]||Array(15).fill(null),style=index===count-1?bottom:regular;
  output.push(`<row r="${r}" spans="1:15" ht="34" customHeight="1">`+values.map((v,c)=>{const letter=col(c),s=style[letter];if(c===14)return `<c r="${letter+r}" s="${s}"><f>SUM(H${r},J${r},L${r},N${r})</f><v>0</v></c>`;if(v===null||v===undefined||v==='')return `<c r="${letter+r}" s="${s}"/>`;return `<c r="${letter+r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${xml(String(v).slice(0,32000))}</t></is></c>`;}).join('')+'</row>');
 }
 output.push(`<row r="${total}" spans="1:15">`+Array.from({length:15},(_,c)=>{const letter=col(c);return `<c r="${letter+total}" s="${totalStyles[letter]||16}">`+([7,9,11,13,14].includes(c)?`<f>SUM(${letter}2:${letter}${count+1})</f><v>0</v>`:'')+'</c>';}).join('')+'</row>');
 if(tail)output.push(tail.replace(/r="([A-Z]*)(34)"/g,(_,l)=>`r="${l}${last}"`));
 sheet=sheet.replace(/<sheetData>[\s\S]*?<\/sheetData>/,'<sheetData>'+output.join('')+'</sheetData>').replace(/<dimension ref="[^"]*"\/>/,`<dimension ref="A1:O${last}"/>`);entries.set('xl/worksheets/sheet1.xml',Buffer.from(sheet));
 let table=entries.get('xl/tables/table1.xml').toString();table=table.replace(/<calculatedColumnFormula[^>]*>[\s\S]*?<\/calculatedColumnFormula>/g,'<calculatedColumnFormula>SUM(H2,J2,L2,N2)</calculatedColumnFormula>').replace(/ref="A1:O\d+"/,`ref="A1:O${total}"`).replace(/(<autoFilter[^>]*ref=")[^"]*(")/,`$1A1:O${total-1}$2`);entries.set('xl/tables/table1.xml',Buffer.from(table));
 // Stale calculation chains reference the old row count. Excel recalculates the preserved formulas.
 entries.delete('xl/calcChain.xml');for(const filename of ['[Content_Types].xml','xl/_rels/workbook.xml.rels'])entries.set(filename,Buffer.from(entries.get(filename).toString().replace(/<(?:Override|Relationship)\b[^>]*(?:calcChain)[^>]*\/>/g,'')));
 let wb=entries.get('xl/workbook.xml').toString();wb=wb.replace(/<calcPr\b[^>]*\/>/,'<calcPr calcMode="auto" fullCalcOnLoad="1" forceFullCalc="1"/>');entries.set('xl/workbook.xml',Buffer.from(wb));
 // Preserve the reference styles and add wrapping only to populated text body styles.
 let styleXml=entries.get('xl/styles.xml').toString();const section=styleXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/);if(section){let n=0;const textStyles=new Set([5,7,10,13,25,29]);const content=section[1].replace(/<xf\b[^>]*\/>|<xf\b[^>]*>[\s\S]*?<\/xf>/g,xf=>{const i=n++;if(!textStyles.has(i))return xf;xf=xf.replace(/numFmtId="[^"]*"/,'numFmtId="49"').replace(/\s+applyAlignment="[^"]*"/g,'').replace(/<xf\b/,'<xf applyAlignment="1"');if(xf.endsWith('/>'))return xf.slice(0,-2)+'><alignment wrapText="1" vertical="center"/></xf>';if(/<alignment\b/.test(xf))return xf.replace(/<alignment\b([^>]*?)\/>/,(_,a)=>'<alignment'+a.replace(/\s+wrapText="[^"]*"/g,'')+' wrapText="1"/>');return xf.replace('</xf>','<alignment wrapText="1" vertical="center"/></xf>');});styleXml=styleXml.replace(section[0],section[0].replace(section[1],content));entries.set('xl/styles.xml',Buffer.from(styleXml));}
 return archive([...entries]);
}
module.exports={workbook,readArchive};
