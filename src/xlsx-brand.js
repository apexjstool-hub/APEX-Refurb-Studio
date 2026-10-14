'use strict';
const fs=require('node:fs'),path=require('node:path');
const shift=value=>String(value).replace(/(\$?[A-Z]{1,3}\$?)(\d+)/g,(_,c,r)=>c+(Number(r)+2));
function brand(entries,title){
 const xml=require('./xlsx-export').xml;
 const file='xl/worksheets/sheet1.xml';let sheet=entries.get(file).toString();
 // Reserve two rows above the existing table. All table/formula coordinates move together.
 sheet=sheet.replace(/<row\b([^>]*?)r="(\d+)"/g,(_,a,r)=>'<row'+a+'r="'+(Number(r)+2)+'"').replace(/(<c\b[^>]*\br=")([A-Z]+\d+)(")/g,(_,a,r,b)=>a+shift(r)+b).replace(/<f([^>]*)>([\s\S]*?)<\/f>/g,(_,a,f)=>'<f'+a+'>'+shift(f)+'</f>');
 sheet=sheet.replace(/(ref|sqref|activeCell|topLeftCell)="([^"]*)"/g,(_,a,v)=>a+'="'+shift(v)+'"').replace(/(<dimension ref=")A3:/,'$1A1:');
 let styles=entries.get('xl/styles.xml').toString(),fonts=Number(styles.match(/<fonts count="(\d+)"/)[1]),xfs=Number(styles.match(/<cellXfs count="(\d+)"/)[1]);
 styles=styles.replace(/<fonts count="\d+"/,'<fonts count="'+(fonts+1)+'"').replace('</fonts>','<font><b/><sz val="14"/><color rgb="FF17263A"/><name val="Arial"/></font></fonts>').replace(/<cellXfs count="\d+"/,'<cellXfs count="'+(xfs+1)+'"').replace('</cellXfs>','<xf numFmtId="0" fontId="'+fonts+'" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="center"/></xf></cellXfs>');
 entries.set('xl/styles.xml',Buffer.from(styles));
 sheet=sheet.replace('<sheetData>','<sheetData><row r="1" ht="38" customHeight="1"><c r="B1" s="'+xfs+'" t="inlineStr"><is><t>'+xml('APEX - '+title)+'</t></is></c></row><row r="2" ht="12" customHeight="1"/>');
 sheet=sheet.replace(/<sheetViews>[\s\S]*?<\/sheetViews>/,'<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A4" sqref="A4"/></sheetView></sheetViews>');
 sheet=sheet.replace(/<row r="3"([^>]*)>/,(_,a)=>'<row r="3"'+a.replace(/\s+(?:ht|customHeight)="[^"]*"/g,'')+' ht="32" customHeight="1">');
 if(!sheet.includes('xmlns:r='))sheet=sheet.replace('<worksheet ','<worksheet xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ');
 const relationship='rIdApexBrand';
 sheet=sheet.replace(/(<tableParts\b|<extLst\b|<\/worksheet>)/,'<drawing r:id="'+relationship+'"/>$1');entries.set(file,Buffer.from(sheet));
 for(const [name,buffer] of entries){
  if(/^xl\/tables\/.*\.xml$/.test(name))entries.set(name,Buffer.from(buffer.toString().replace(/ref="([^"]+)"/g,(_,v)=>'ref="'+shift(v)+'"').replace(/<calculatedColumnFormula([^>]*)>([\s\S]*?)<\/calculatedColumnFormula>/g,(_,a,f)=>'<calculatedColumnFormula'+a+'>'+shift(f)+'</calculatedColumnFormula>')));
 }
 const rels='xl/worksheets/_rels/sheet1.xml.rels';let relations=entries.has(rels)?entries.get(rels).toString():'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
 relations=relations.replace('</Relationships>','<Relationship Id="'+relationship+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/apex-brand.xml"/></Relationships>');entries.set(rels,Buffer.from(relations));
 entries.set('xl/media/apex-brand.png',fs.readFileSync(path.join(__dirname,'renderer','assets','apex-icon.png')));
 entries.set('xl/drawings/apex-brand.xml',Buffer.from('<?xml version="1.0"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>76200</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>38100</xdr:rowOff></xdr:from><xdr:ext cx="400050" cy="400050"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="1" name="APEX logo" descr="APEX"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr><xdr:blipFill><a:blip xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="400050" cy="400050"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>'));
 entries.set('xl/drawings/_rels/apex-brand.xml.rels',Buffer.from('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/apex-brand.png"/></Relationships>'));
 let types=entries.get('[Content_Types].xml').toString();if(!types.includes('Extension="png"'))types=types.replace('</Types>','<Default Extension="png" ContentType="image/png"/></Types>');types=types.replace('</Types>','<Override PartName="/xl/drawings/apex-brand.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>');entries.set('[Content_Types].xml',Buffer.from(types));
 let workbook=entries.get('xl/workbook.xml').toString();workbook=workbook.replace(/<definedName([^>]*name="_xlnm.Print_Area"[^>]*)>([\s\S]*?)<\/definedName>/g,(_,a,v)=>'<definedName'+a+'>'+shift(v).replace(/\$A\$3:/,'$A$1:')+'</definedName>');entries.set('xl/workbook.xml',Buffer.from(workbook));
 return entries;
}
module.exports={brand};
