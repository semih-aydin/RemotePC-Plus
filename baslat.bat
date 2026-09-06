@echo off
title RemotePC+ Kablosuz Kontrol Merkezi
color 0b

echo ======================================================
echo           RemotePC+ Kablosuz Kontrol Merkezi          
echo ======================================================
echo.

:: Yonetici Yetkisi Kontrolu ve Bilgilendirmesi
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [IPUCU] Gorev Yoneticisi veya Yonetici pencerelerini kontrol etmek icin
    echo         bu dosyaya sag tiklayip 'Yonetici olarak calistir' diyebilirsiniz.
    echo.
)

:: Node.js kurulu mu kontrol et
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [HATA] Node.js bulunamadi! Lutfen https://nodejs.org adresinden yukleyin.
    pause
    exit /b
)

:: node_modules var mi kontrol et
if not exist "node_modules\" (
    echo [BILGI] Bagimliliklar yukleniyor, lutfen bekleyin...
    call npm install
)

echo [BILGI] Sunucu baslatiliyor...
echo.

:: 2 saniye sonra yonetim panelini tarayicida ac
start "" cmd /c "timeout /t 2 /nobreak >nul && start http://localhost:5000/admin"

:: Sunucuyu calistir
node server.js

pause
