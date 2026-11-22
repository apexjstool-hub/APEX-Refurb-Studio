'use strict';
const {contextBridge}=require('electron');
const {assess,REQUIRED_QC}=require('./rules');
contextBridge.exposeInMainWorld('workstationPreview',Object.freeze({assess,requiredQC:REQUIRED_QC,mode:'demo',productionAccess:false}));
