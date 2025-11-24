@echo off
echo ==========================================
echo Holokai Desktop Update Script
echo ==========================================
echo.

REM Change to the desktop directory (go up one level from scripts)
cd /d "%~dp0.."

echo Step 1: Pulling latest changes from GitHub...
git pull origin main
if errorlevel 1 (
    echo ERROR: Failed to pull latest changes. Please check your internet connection.
    pause
    exit /b 1
)
echo ✓ Latest code downloaded successfully!
echo.

echo Step 2: Installing/updating dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: Failed to install dependencies.
    pause
    exit /b 1
)
echo ✓ Dependencies updated successfully!
echo.

echo Step 3: Building Svelte application...
call npm run build
if errorlevel 1 (
    echo ERROR: Failed to build Svelte application.
    pause
    exit /b 1
)
echo ✓ Svelte application built successfully!
echo.

echo Step 4: Building Electron application...
call npm run build:electron
if errorlevel 1 (
    echo ERROR: Failed to build Electron application.
    pause
    exit /b 1
)
echo ✓ Electron application built successfully!
echo.

echo ==========================================
echo Update Complete!
echo ==========================================
echo.
echo The Holokai Desktop app has been updated to the latest version.
echo.
echo Press any key to launch the app, or close this window to launch it manually later.
pause

echo.
echo Launching Holokai Desktop...
call npm run electron
