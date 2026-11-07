@echo off
cd /d "%~dp0"
if exist "venv\.jarvis_installed" goto run
echo JARVIS is not installed yet, running the installer first...
call "%~dp0install_windows.bat" auto
if not exist "venv\.jarvis_installed" goto end
:run
if exist "venv\.jarvis_vosk_fallback" goto launch
"venv\Scripts\python.exe" -c "import importlib.util,json,pathlib,sys; c=json.loads(pathlib.Path('jarvis_desktop/config.json').read_text(encoding='utf-8')); sys.exit(1 if c.get('stt','auto') in ('auto','whisper') and importlib.util.find_spec('faster_whisper') is None else 0)" >nul 2>nul
if errorlevel 1 goto whisper_prompt
goto launch
:whisper_prompt
echo This install is using Vosk, which may mishear long or mixed-language requests.
choice /c YN /m "Rerun setup to install Whisper for better speech recognition"
if errorlevel 2 goto launch
call "%~dp0install_windows.bat" auto
if not exist "venv\.jarvis_installed" goto end
:launch
"venv\Scripts\python.exe" "jarvis_desktop\main.py"
:end
pause
