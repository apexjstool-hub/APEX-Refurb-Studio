'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('apexIntakeNotification',Object.freeze({open:()=>ipcRenderer.send('apex:intake-notification','open'),dismiss:()=>ipcRenderer.send('apex:intake-notification','dismiss')}));
