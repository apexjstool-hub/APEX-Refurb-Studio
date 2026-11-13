'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('Microdream pallet status displays on separate line under pallet number, with compact breathing space',()=>{
 const css=read('src/renderer/pallet-location-compact-v4122.css');
 const selector='#palletLocationDetailPage .pl-pallet-row .pl-microdream-status';
 const block=css.slice(css.indexOf(selector)).split('}')[0];
 assert.ok(block.startsWith(selector),'missing scoped status style');
 assert.match(block,/display:flex!important/,'block-level flex element must begin on a new line after the pallet name');
 assert.match(block,/width:max-content!important/,'badge must not fill the entire column');
 assert.match(block,/margin:6px 0 0!important/,'status should have six-pixel separation above');
 assert.match(block,/font-size:9\.5px!important/,'badge stays compact');
 assert.match(block,/max-width:100%!important/,'long labels should not overflow');
 assert.doesNotMatch(block,/display:inline-flex!important/,'badge must not sit against pallet number');
});
test('Badge stays derived from existing Microdream records, not a new database field',()=>{
 const src=read('src/renderer/pallets-microdream-status-v4118.js');
 const html=read('src/renderer/index.html');
 assert.match(src,/palletCell\?\.appendChild\(badge\)/);
 assert.match(src,/Sent for respray/);
 assert.match(src,/Returned — inspect/);
 assert.match(src,/Respray completed/);
 assert.match(html,/href="pallet-location-compact-v4122\.css"/);
 assert.doesNotMatch(src,/workflowAction\(|api\.update\(/);
});
