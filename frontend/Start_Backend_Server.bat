@echo off
title LifeSync Backend Server
cd /d "%~dp0backend"

echo ======================================================================
echo  LifeSync Backend Server Launcher
echo ======================================================================

set VENV_PYTHON="%~dp0backend\venv\Scripts\python.exe"
set SCRATCH_VENV="C:\Users\SHANNY\.gemini\antigravity-ide\scratch\backend\venv\Scripts\python.exe"

if exist %VENV_PYTHON% (
    echo [OK] Using bundled virtual environment: %VENV_PYTHON%
    echo Starting FastAPI server on http://127.0.0.1:8000 ...
    echo API Docs available at: http://127.0.0.1:8000/docs
    echo ======================================================================
    %VENV_PYTHON% -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
    goto end
)

if exist %SCRATCH_VENV% (
    echo [OK] Using scratch virtual environment: %SCRATCH_VENV%
    echo Starting FastAPI server on http://127.0.0.1:8000 ...
    echo API Docs available at: http://127.0.0.1:8000/docs
    echo ======================================================================
    %SCRATCH_VENV% -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
    goto end
)

echo [INFO] Searching for system python or node...
where node >nul 2>nul
if %errorlevel% equ 0 (
    echo Starting Node/Express backend...
    node src/server.js
    goto end
)

python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000

:end
pause
