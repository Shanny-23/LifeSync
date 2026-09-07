@echo off
title LifeSync Vite Dev Server
cd /d "%~dp0"

echo ======================================================================
echo  Starting LifeSync React + Vite Development Server...
echo ======================================================================

set "NODE_DIR=%~dp0..\node\node-v20.18.0-win-x64"
if exist "%NODE_DIR%\node.exe" (
    set "PATH=%NODE_DIR%;%PATH%"
)

npm run dev
pause
