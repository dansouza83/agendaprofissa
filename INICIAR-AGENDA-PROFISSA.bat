@echo off
title Agenda Profissa - Servidor Local
cd /d "%~dp0"

set "AGENDA_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
set "AGENDA_CLI=%~dp0node_modules\vinext\dist\cli.js"

if not exist "%AGENDA_NODE%" (
  echo Nao foi possivel encontrar o Node.js instalado.
  echo Volte ao Codex e informe esta mensagem.
  pause
  exit /b 1
)

if not exist "%AGENDA_CLI%" (
  echo As dependencias do projeto nao foram encontradas.
  echo Volte ao Codex e informe esta mensagem.
  pause
  exit /b 1
)

start "" /min "%~dp0ABRIR-AGENDA-PROFISSA.bat"
echo.
echo Agenda Profissa iniciando em http://localhost:3000
echo Mantenha esta janela aberta enquanto estiver usando o sistema.
echo Para encerrar, pressione Ctrl+C e confirme com S.
echo.
"%AGENDA_NODE%" "%AGENDA_CLI%" dev --host 127.0.0.1 --port 3000

if errorlevel 1 (
  echo.
  echo ERRO: o servidor nao conseguiu iniciar.
  echo Tire uma foto desta janela e envie ao Codex.
)

echo.
echo O servidor foi encerrado.
pause
