@echo off
title RemotePC+ Tray Derleyici
set CSC=C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe

if not exist "%CSC%" (
    echo [HATA] .NET C# derleyicisi bulunamadi: %CSC%
    pause
    exit /b 1
)

echo [BILGI] RemotePCPlus.exe derleniyor...
"%CSC%" /nologo /target:winexe /optimize+ /utf8output /win32icon:"%~dp0..\tray\app.ico" /out:"%~dp0..\RemotePCPlus.exe" /r:System.Windows.Forms.dll /r:System.Drawing.dll "%~dp0..\tray\RemotePCPlusTray.cs"

if %errorlevel% equ 0 (
    echo [BASARILI] RemotePCPlus.exe olusturuldu!
) else (
    echo [HATA] Derleme basarisiz oldu.
)
pause
