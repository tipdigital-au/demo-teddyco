@echo off
set HOST=0.0.0.0
echo Starting Teddy & Co Cafe Menu Server...
echo Make sure you have installed dependencies by running 'npm install' if you haven't already.
node server.js
if %errorlevel% neq 0 (
    echo.
    echo Server crashed or failed to start.
    pause
)
