@echo off
chcp 65001 >nul
rem ============================================================
rem  Lobar Parda: o'zgarishlarni hammaga yetkazish
rem  1) brauzer versiyasini yig'adi  2) internetga joylaydi
rem  3) Android ilovalarga havo orqali yangilanish yuboradi
rem  Ishlatish: shu faylni ikki marta bosing.
rem ============================================================
cd /d "%~dp0"
set EAS_NO_VCS=1
set EAS_PROJECT_ROOT=%cd%

echo.
echo [1/3] Brauzer versiyasi yig'ilmoqda...
call npx.cmd expo export -p web
if errorlevel 1 goto xato

echo.
echo [2/3] Brauzer versiyasi internetga joylanmoqda...
call npx.cmd eas-cli@latest deploy --prod
if errorlevel 1 goto xato

echo.
echo [3/3] Android ilovalarga yangilanish yuborilmoqda...
call npx.cmd eas-cli@latest update --channel preview --environment preview --message "Yangilanish %date% %time:~0,5%" --non-interactive
if errorlevel 1 goto xato

echo.
echo ==========================================
echo  TAYYOR! Brauzerda sahifani yangilang,
echo  telefonda ilovani ikki marta qayta oching.
echo ==========================================
pause
exit /b 0

:xato
echo.
echo ==========================================
echo  XATO chiqdi. Yuqoridagi yozuvlarning
echo  rasmini Claude'ga yuboring.
echo ==========================================
pause
exit /b 1
