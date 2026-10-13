@echo off
setlocal
cd /d "%~dp0"
title APEX Cloud Auto Sync - Independent Worker
where node.exe >nul 2>nul
if errorlevel 1 (echo Node.js LTS is required.& pause& exit /b 1)
echo This will use existing APEX cloud settings and the Hub admin token on this computer.
echo Close Management Studio's manual Cloud Sync before starting this service.
node "cloud\auto-sync.js"
pause
