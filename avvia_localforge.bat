@echo off

:: Controlla se lo script e' gia' in esecuzione in modalita' nascosta
if "%~1"=="hidden" goto :start
:: Se non lo e', crea un VBS temporaneo per rilanciarsi in modo invisibile ed esce
echo Set WshShell = CreateObject("WScript.Shell") > "%temp%\hide_bat.vbs"
echo WshShell.Run "cmd.exe /c """"%~f0"" hidden""", 0, False >> "%temp%\hide_bat.vbs"
cscript //nologo "%temp%\hide_bat.vbs"
del "%temp%\hide_bat.vbs"
exit /b

:start
title FileForge Server
cd /d "c:\Users\pedro\Desktop\FileForge"

echo ---------------------------------------------------
echo  Avvio LocalForge...
echo ---------------------------------------------------

:: Termina eventuali processi Node.js rimasti aperti per liberare la porta 3001
taskkill /F /IM node.exe >nul 2>&1

:: Pulisce la cache di Next.js per risolvere errori di componenti mancanti o corrotti
:: if exist ".next" rmdir /s /q ".next"
:: if exist "node_modules\.cache" rmdir /s /q "node_modules\.cache"

:: Installa eventuali nuove dipendenze mancanti
call npm run electron:dev

:: Imposta la porta a 3001 come richiesto
set PORT=3001

:: Mostra l'indirizzo IP locale per connettersi da altri dispositivi
echo ---------------------------------------------------
echo  PER ACCEDERE DA SMARTPHONE O TABLET:
echo  Usa uno degli indirizzi IPv4 elencati qui sotto:
ipconfig | findstr "IPv4"
echo  Esempio: http://192.168.1.132:3001/localforge
echo ---------------------------------------------------

:: Apre il browser automaticamente (usa http e localhost per evitare errori di certificato)
start "" "http://localhost:3001/localforge"

:: Esegue il server (la finestra CMD ora e' del tutto invisibile, quindi si puo' lanciare normalmente)
npm run dev