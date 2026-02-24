@echo off
set LOG_FILE=%~dp0run_app.log
echo ========================================== > "%LOG_FILE%"
echo NetVal - Network Staging Intelligence Platform >> "%LOG_FILE%"
echo Started at %DATE% %TIME% >> "%LOG_FILE%"
echo ========================================== >> "%LOG_FILE%"

REM Check for Administrator privileges
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Requesting administrative privileges...
    goto UACPrompt
) else ( goto gotAdmin )

:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B

:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo [INFO] Killing existing Python and Node processes... >> "%LOG_FILE%"
taskkill /F /IM python.exe /T >nul 2>&1
taskkill /F /IM node.exe /T >nul 2>&1
taskkill /F /IM uvicorn.exe /T >nul 2>&1

echo [INFO] Checking prerequisites... >> "%LOG_FILE%"
REM Check for Python
python --version >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. >> "%LOG_FILE%"
    echo Python is not installed or not in PATH. Please install Python 3.11+.
    pause
    exit /b 1
)

REM Check for Node.js
node --version >> "%LOG_FILE%" 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. >> "%LOG_FILE%"
    echo Node.js is not installed or not in PATH. Please install Node.js 20+.
    pause
    exit /b 1
)

echo.
echo [1/4] Setting up Backend...
echo [INFO] Setting up Backend... >> "%LOG_FILE%"
cd backend
if not exist venv (
    echo [INFO] Creating virtual environment... >> "%LOG_FILE%"
    echo Creating virtual environment...
    python -m venv venv >> "%LOG_FILE%" 2>&1
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing Python dependencies...
echo [INFO] Installing Python dependencies... >> "%LOG_FILE%"
pip install -r requirements.txt >> "%LOG_FILE%" 2>&1

echo Starting Backend Server...
echo [INFO] Starting Backend Server... >> "%LOG_FILE%"
start "NetVal Backend" cmd /k "venv\Scripts\uvicorn main:app --port 8742 --reload"

echo.
echo [2/4] Setting up Frontend...
echo [INFO] Setting up Frontend... >> "%LOG_FILE%"
cd ..\frontend
if not exist node_modules (
    echo Installing Node dependencies...
    echo [INFO] Installing Node dependencies... >> "%LOG_FILE%"
    call npm install >> "%LOG_FILE%" 2>&1
)

echo Starting Frontend Server...
echo [INFO] Starting Frontend Server... >> "%LOG_FILE%"
start "NetVal Frontend" cmd /k "npm run dev"

echo.
echo [3/4] Launching Application...
echo [INFO] Launching Application... >> "%LOG_FILE%"
timeout /t 5 >nul
start "" "http://localhost:5173"

echo.
echo ==========================================
echo NetVal is running!
echo Backend: http://localhost:8742
echo Frontend: http://localhost:5173
echo.
echo Logs are being written to %LOG_FILE%
echo Close the terminal windows to stop the application.
echo ==========================================
pause
