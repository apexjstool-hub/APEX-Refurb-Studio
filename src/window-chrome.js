'use strict';
const HEIGHT=30;
const palettes={light:{color:'#F3F5F8',symbolColor:'#18263A',height:HEIGHT},dark:{color:'#111923',symbolColor:'#EDF3FB',height:HEIGHT}};
function validTheme(theme){return theme==='light'||theme==='dark';}
function overlay(theme){return {...palettes[theme==='dark'?'dark':'light']};}
function options(platform){return platform==='win32'?{titleBarStyle:'hidden',titleBarOverlay:overlay('light'),autoHideMenuBar:true}:{};}
function configure(win,platform){if(platform==='win32')win.setMenu(null);}
function apply(win,platform,theme){if(platform!=='win32'||!validTheme(theme)||!win||win.isDestroyed())return false;win.setTitleBarOverlay(overlay(theme));return true;}
module.exports={HEIGHT,validTheme,overlay,options,configure,apply};
