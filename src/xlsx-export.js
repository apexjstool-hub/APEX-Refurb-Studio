'use strict';
// APEX: standards-compliant, self-contained Office Open XML workbook writer.
// Does not require Excel or an internet connection. All user text is stored as
// inline strings, never as executable spreadsheet formulas.
const zlib = require('node:zlib');
const xml = value => String(value ?? '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF]/g, '')
  .replace(/[&<>"']/g, ch => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&apos;'}[ch]));
const crcTable = Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++) c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);return c>>>0;});
function crc32(buffer){let c=0xffffffff;for (const b of buffer) c=crcTable[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function archive(files){
  let offset=0;const local=[],central=[];
  for(const [filePath,xmlText] of files){
    const filename=Buffer.from(filePath,'utf8'),data=Buffer.from(xmlText,'utf8');
    const packed=zlib.deflateRawSync(data),checksum=crc32(data);
    // IMPORTANT: GP bit 3 MUST be clear when CRC and sizes are stored in the
    // local file header. Older APEX exports incorrectly set this to 8, which
    // claims a data descriptor will follow although none is written. Some
    // Excel versions and Excel Online reject those archives as corrupted.
    const hdr=Buffer.alloc(30);hdr.writeUInt32LE(0x04034b50,0);
    hdr.writeUInt16LE(20,4);hdr.writeUInt16LE(0,6);hdr.writeUInt16LE(8,8);
    hdr.writeUInt16LE(0,10);hdr.writeUInt16LE(0x21,12); // DOS date 1980-01-01
    hdr.writeUInt32LE(checksum,14);hdr.writeUInt32LE(packed.length,18);
    hdr.writeUInt32LE(data.length,22);hdr.writeUInt16LE(filename.length,26);
    local.push(hdr,filename,packed);
    const dir=Buffer.alloc(46);dir.writeUInt32LE(0x02014b50,0);
    dir.writeUInt16LE(20,4);dir.writeUInt16LE(20,6);
    dir.writeUInt16LE(0,8);dir.writeUInt16LE(8,10);
    dir.writeUInt16LE(0,12);dir.writeUInt16LE(0x21,14);
    dir.writeUInt32LE(checksum,16);dir.writeUInt32LE(packed.length,20);
    dir.writeUInt32LE(data.length,24);dir.writeUInt16LE(filename.length,28);
    dir.writeUInt32LE(offset,42);central.push(dir,filename);
    offset+=hdr.length+filename.length+packed.length;
  }
  const directory=Buffer.concat(central),end=Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(files.length,8);
  end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);
  end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}
function col(i){let value='';for(i++;i>0;i=Math.floor((i-1)/26))value=String.fromCharCode(65+(i-1)%26)+value;return value;}
function workbook(rows,title='APEX Parts Needed'){
  if(!Array.isArray(rows)||rows.length<1||rows.length>30001)throw Error('Invalid Excel rows.');
  const width=rows[0].length;
  if(width<1||width>24||rows.some(row=>!Array.isArray(row)||row.length!==width))throw Error('Each row must have the same number of columns.');
  const sheetName=String(title||'Export').replace(/[\\\/*?:\[\]]/g,' ').slice(0,31)||'Export';
  const bounds=`A1:${col(width-1)}${rows.length}`;
  const rowHeight=row=>Math.max(24,...row.map((value,i)=>String(value??'').split(/\r?\n/).reduce((n,line)=>n+Math.max(1,Math.ceil(line.length/(i===1?36:i===2?20:18))),0)*16+8));
  const sheetRows=rows.map((row,index)=>`<row r="${index+1}" ht="${index===0?32:Math.min(409,rowHeight(row))}" customHeight="1">${row.map((value,i)=>{
    // Everything is text on purpose: long Asset IDs and leading zeros survive.
    const cell=col(i)+(index+1),safe=xml(String(value??'').slice(0,32000));
    return `<c r="${cell}" s="${index===0?1:0}" t="inlineStr"><is><t xml:space="preserve">${safe}</t></is></c>`;
  }).join('')}</row>`).join('');
  const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${bounds}"/><sheetViews><sheetView workbookViewId="0" tabSelected="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${rows[0].map((_,i)=>`<col min="${i+1}" max="${i+1}" width="${i===1?40:i===2?24:22}" customWidth="1"/>`).join('')}</cols><sheetData>${sheetRows}</sheetData><autoFilter ref="${bounds}"/><pageMargins left="0.5" right="0.5" top="0.65" bottom="0.65" header="0.3" footer="0.3"/></worksheet>`;
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="0"/><fonts count="2"><font><sz val="11"/><name val="Aptos"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1967C2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment wrapText="1" vertical="top"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const files=[
    ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`],
    ['_rels/.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`],
    ['docProps/core.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>APEX Refurb Management Studio</dc:creator></cp:coreProperties>`],
    ['docProps/app.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>APEX Refurb Management Studio</Application></Properties>`],
    ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets><sheet name="${xml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',sheet]
  ];
  return archive([...require('./xlsx-brand').brand(new Map(files.map(([name,value])=>[name,Buffer.from(value)])),title)]);
}
module.exports={workbook,archive,xml,col};
