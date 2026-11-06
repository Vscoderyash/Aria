@echo off
cd /d "%~dp0"
if exist "venv\.jarvis_installed" goto run
echo JARVIS is not installed yet, running the installer first...
call "%~dp0install_windows.bat" auto
if not exist "venv\.jarvis_installed" goto end
:run
"venv\Scripts\python.exe" "jarvis_desktop\main.py"
:end
pause
