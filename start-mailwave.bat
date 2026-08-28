@echo off
REM ===========================================================================
REM  MailWave chalane ke liye — bas is file par double-click karo.
REM
REM  Yeh do cheezein chalati hai:
REM    1. Backend  (API + database)  -> http://localhost:4000
REM    2. Frontend (website)         -> http://localhost:5173
REM
REM  Dono apni alag window me khulenge. Band karna ho to woh windows band kar do.
REM ===========================================================================

title MailWave - starting

REM --- Node kahan hai ---------------------------------------------------------
REM Agar aapne Node theek se install kiya hai to yeh line ki zarurat nahi.
REM Abhi Node ek downloaded folder me hai, isliye uska rasta yahan jod rahe hain.
set "NODE_DIR=C:\Users\Nitesh\Downloads\node-v20.20.2-win-x64\node-v20.20.2-win-x64"
if exist "%NODE_DIR%\node.exe" set "PATH=%NODE_DIR%;%PATH%"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   [X] Node nahi mila.
  echo.
  echo   Node install karo: https://nodejs.org  ^(LTS version^)
  echo   Ya is file me upar NODE_DIR ka rasta theek karo.
  echo.
  pause
  exit /b 1
)

cd /d "%~dp0"

echo.
echo   Node mil gaya:
node --version
echo.

REM --- Pehli baar chalane par packages install ho jayenge ---------------------
if not exist "node_modules" (
  echo   [1/3] Frontend ke packages install ho rahe hain... ^(ek baar hi lagega^)
  call npm install
)

if not exist "server\node_modules" (
  echo   [2/3] Backend ke packages install ho rahe hain... ^(ek baar hi lagega^)
  cd server
  call npm install
  cd ..
)

REM --- Pehli baar database bhi bhar dete hain --------------------------------
if not exist "server\data\pgdata" (
  echo   [3/3] Database ban raha hai aur sample data bhara ja raha hai...
  cd server
  call npm run seed
  cd ..
)

echo.
echo   Sab taiyar hai. Do windows khul rahi hain...
echo.

REM --- Dono alag window me chalu -------------------------------------------
start "MailWave API"      cmd /k "set PATH=%NODE_DIR%;%PATH% && cd /d "%~dp0server" && npm run dev"
start "MailWave Website"  cmd /k "set PATH=%NODE_DIR%;%PATH% && cd /d "%~dp0" && npm run dev"

REM Server ko thoda time do, phir browser khol do.
timeout /t 6 /nobreak >nul
start "" http://localhost:5173

echo.
echo   Website:  http://localhost:5173
echo   API:      http://localhost:4000
echo.
echo   Login:    rohit@gowebkart.com
echo   Password: mailwave
echo.
echo   Yeh window band kar sakte ho. Baaki do windows chalti rehni chahiye.
echo.
pause
