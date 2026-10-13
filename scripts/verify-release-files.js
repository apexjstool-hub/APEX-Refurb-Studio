'use strict';
const fs=require('node:fs'),crypto=require('node:crypto');
const version=process.env.APEX_RELEASE_VERSION||require('../package.json').version;
const filename=`APEX-Refurb-Studio-Setup-${version}.exe`;
const data=fs.readFileSync(`dist/${filename}`),metadata=fs.readFileSync('dist/latest.yml','utf8');
const digest=crypto.createHash('sha512').update(data).digest('base64');
if(!metadata.includes(`version: ${version}`)||!metadata.includes(filename)||!metadata.includes(digest)||!metadata.includes(`size: ${data.length}`))throw Error('latest.yml does not match the installer version, name, checksum and size.');
console.log('Installer update metadata verified.');
