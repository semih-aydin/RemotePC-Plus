@echo off
:: Windows Guvenlik Duvari Otomatik Kural Ekleme Betigi (Port 5000 & 5443)
title RemotePC+ Guvenlik Duvari Yapilandirici
color 0a

:: Yonetici Yetkisi Kontrolu
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [BILGI] Yonetici haklari isteniyor...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo ================================================================
echo       RemotePC+ Windows Guvenlik Duvari (Firewall) Ayari         
echo ================================================================
echo.
echo [1/3] Port 5000 (HTTP/WebSocket) icin gelen kural ekleniyor...
netsh advfirewall firewall add rule name="RemotePC+ HTTP Server (Port 5000)" dir=in action=allow protocol=TCP localport=5000 >nul

echo [2/3] Port 5443 (HTTPS/WSS) icin gelen kural ekleniyor...
netsh advfirewall firewall add rule name="RemotePC+ HTTPS Server (Port 5443)" dir=in action=allow protocol=TCP localport=5443 >nul

echo [3/3] Port 5055 (UDP Otomatik PC Kesfi) icin gelen kural ekleniyor...
netsh advfirewall firewall add rule name="RemotePC+ UDP Discovery (Port 5055)" dir=in action=allow protocol=UDP localport=5055 >nul

echo.
echo ================================================================
echo [BASARILI] Port 5000, 5443 (TCP) ve 5055 (UDP) basariyla eklendi!
echo Artik Android APK ve tarayici yerel agdan sorunsuz baglanabilir.
echo ================================================================
echo.
pause
