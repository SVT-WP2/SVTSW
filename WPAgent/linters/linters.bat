@echo off
:: run_lint.bat  —  Run all static analysis on WPAgent
::
:: Usage:
::   run_lint.bat             flake8 + pylint + contract checker
::   run_lint.bat --all       + mypy type checking
::   run_lint.bat --fix       auto-format with black first
setlocal
set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%.."
set ERRORS=0

:: Find the best available Python
set PY=
py -3 --version >nul 2>&1 && set PY=py -3
if "%PY%"=="" python3 --version >nul 2>&1 && set PY=python3
if "%PY%"=="" python --version >nul 2>&1 && set PY=python
if "%PY%"=="" (
    echo [ERROR] No Python found.
    exit /b 1
)
for /f "tokens=*" %%v in ('%PY% --version 2^>^&1') do echo Using: %%v
echo.

:: optional: auto-format with black first
if "%1"=="--fix" (
    %PY% -m black --version >nul 2>&1
    if errorlevel 1 (
        echo [black] Not installed. Run: %PY% -m pip install black
    ) else (
        echo [black] Auto-formatting...
        %PY% -m black .
    )
    echo.
)

:: flake8
echo ========================================
echo  flake8  (style + obvious errors)
echo ========================================
%PY% -m flake8 --version >nul 2>&1
if errorlevel 1 (
    echo [SKIP] flake8 not installed. Run: %PY% -m pip install flake8
) else (
    %PY% -m flake8 . --exclude=__pycache__,.idea,.git,venv,build,dist
    if errorlevel 1 set ERRORS=1
)
echo.

:: pylint
echo ========================================
echo  pylint  (deep static analysis)
echo ========================================
%PY% -m pylint --version >nul 2>&1
if errorlevel 1 (
    echo [SKIP] pylint not installed. Run: %PY% -m pip install pylint
) else (
    %PY% -m pylint WPAgent.py WPCmdMap.py WPCommandHandler.py WPKafkaClient.py actions drivers globals interfaces sequencer services stateMachine utilities --score=no
    if errorlevel 1 set ERRORS=1
)
echo.

:: contract checker
echo ========================================
echo  contracts  (naming + ResponseBuilder)
echo ========================================
%PY% linters\check_contracts.py
if errorlevel 1 set ERRORS=1
echo.

:: Kafka convention
echo ========================================
echo  Kafka conventions  (topics/headers/status)
echo ========================================
%PY% linters\check_kafka_conventions.py --no-color
if errorlevel 1 set ERRORS=1
echo.

:: mypy (only with --all)
if "%1"=="--all" (
    echo ========================================
    echo  mypy  (type checking)
    echo ========================================
    %PY% -m mypy --version >nul 2>&1
    if errorlevel 1 (
        echo [SKIP] mypy not installed. Run: %PY% -m pip install mypy
    ) else (
        %PY% -m mypy . --ignore-missing-imports --exclude "venv|build|dist|__pycache__"
        if errorlevel 1 set ERRORS=1
    )
    echo.
)

:: summary
echo ========================================
if %ERRORS%==0 (
    echo  [PASS] All linters passed cleanly.
) else (
    echo  [FAIL] Issues found - see output above.
)
echo ========================================
exit /b %ERRORS%
