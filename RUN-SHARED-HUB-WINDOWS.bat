@echo off
setlocal
cd /d "%~dp0"
title APEX Smart Inventory - Shared Hub
color 0F
echo.
echo ========================================================
echo             APEX SMART INVENTORY - SHARED HUB
echo ========================================================
echo.
where node.exe >nul 2>nul
if errorlevel 1 (
 echo [ERROR] Node.js was not found.
 echo Install Node.js LTS, restart Command Prompt, then run this file again.
 goto :end
)
set "APEX_HUB_HOST=0.0.0.0"
set "APEX_HUB_PORT=4217"
echo Starting inventory hub on TCP port 4217 and UDP discovery port 4218...
echo.
echo Once you see HUB: ONLINE, open this link ON THIS COMPUTER:
echo       http://localhost:4217/
echo.
echo To confirm it works, open:
echo       http://localhost:4217/health
echo.
echo Keep this black window open while the hub is needed.
echo If browser says 'site can't be reached', run CHECK-SHARED-HUB-WINDOWS.bat.
echo Only connect over a trusted private LAN or VPN.
echo.
rem Start one independent auto-sync worker after the hub begins listening.
rem It only activates after an administrator has already completed the first safe sync.
start "APEX Cloud Auto Sync" /min "%ComSpec%" /c ""%~dp0RUN-AUTO-CLOUD-SYNC-SILENT.bat""
echo Starting automatic Hub-to-Supabase sync in a separate window...
rem The worker reads the private settings saved on this Hub PC.
rem If a bridge is already active, its PID lock stops duplicates.
rem Keep the Hub and automatic sync windows open while receiving devices.
start "APEX Cloud Auto Sync" /MIN cmd /k "node cloud\auto-sync.js"
echo.
node "hub\server.js"
echo.
echo [STOPPED] The hub stopped or failed to start.
echo See any errors above. If port 4217 is in use, an older hub may still run.
:end
echo.
pause
