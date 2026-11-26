<div align="center">

<img src="public/assets/logo.svg" alt="RemotePC+ Logo" width="88" height="88" />

# RemotePC+

**Zero-latency wireless Magic Trackpad, multi-monitor controller, and media/presentation remote for Windows.**

[![Build Android APK](https://github.com/semjhaydin/Remote-PC-Plus/actions/workflows/build-apk.yml/badge.svg)](https://github.com/semjhaydin/Remote-PC-Plus/actions/workflows/build-apk.yml)
[![Node.js](https://img.shields.io/badge/Node.js-18%2B-1C1C1E?style=flat-square&logo=nodedotjs&logoColor=30D158)](https://nodejs.org)
[![Android](https://img.shields.io/badge/Android-Native_Kotlin-1C1C1E?style=flat-square&logo=android&logoColor=0A84FF)](android/)
[![Windows](https://img.shields.io/badge/Windows-Win32_FFI_%26_Tray-1C1C1E?style=flat-square&logo=windows&logoColor=F5F5F7)](tray/)

</div>

---

## Nedir?

**RemotePC+**, akıllı telefonunuzu Windows bilgisayarınız için ultra düşük gecikmeli bir kablosuz trackpad, medya oynatıcı ve sunum kumandasına dönüştürür. Tarayıcıyla uğraşmadan doğrudan kullanılabilen **minik bir Native Android APK**, Windows saatinin yanında sessizce çalışan **26 KB Sistem Tepsisi uygulaması (`RemotePCPlus.exe`)** ve **Web/PWA** arayüzü ile eksiksiz bir ekosistem sunar.

---

## Öne Çıkan Özellikler

### 1. Native Android APK (`android/`)
- **Otomatik PC Keşfi (UDP 5055):** Wi-Fi ağındaki bilgisayarı tek dokunuşla bulur ve kalıcı olarak eşleştirir. PC'nin yerel IP'si değişse bile arka planda otomatik günceller.
- **Sıfır WebView — Tam Native Trackpad:** 120Hz dokunmatik örnekleme, dinamik ivmelenme, çift dokunup sürükleme, 2 parmak sağ tık / kaydırma / yakınlaştırma, 3 parmak orta tık ve ekranlar arası geçiş.
- **Fiziksel Ses Tuşları:** Touchpad modunda PC sesini, Kumanda modunda sunum slaytlarını değiştirir.
- **Apple Dark HIG Tasarımı:** OLED siyah zemin, vektör ikonlar ve parmak altında yumuşak temas halkası.

### 2. Windows Sistem Tepsisi (`RemotePCPlus.exe`)
- **Sessiz Çalışma:** CMD penceresi açmadan `node server.js` sunucusunu arka planda yönetir.
- **Bağımsız Kontrol Merkezi Penceresi:** Tepsi simgesine çift tıklayınca macOS System Settings stilindeki kontrol panelini adres çubuksuz masaüstü penceresi olarak açar.
- **Windows ile Başlat:** Sağ tık menüsünden tek tıkla başlangıca ekleme/çıkarma.

### 3. Win32 FFI Motoru & Çoklu Monitör
- **Doğrudan Win32 API (`koffi`):** C++ derleyicisi gerektirmeden `user32`, `gdi32` ve `kernel32` üzerinden 1–2ms gecikmeli girdi iletimi (`TCP_NODELAY`, `perMessageDeflate: false`).
- **Tam Türkçe & Unicode Yazma:** `SendInput` + `KEYEVENTF_UNICODE` ile `ç, ğ, ı, İ, ö, ş, ü` ve tüm noktalama işaretleri eksiksiz yazılır.
- **Çoklu Monitör & Sınır Direnci:** Bağlı tüm ekranların uzamsal haritasını otomatik çıkarır; ekran başına ayrı DPI ve kenar mıknatısı (Boundary Magnetism) uygular.
- **Canlı İmleç Büyüteci:** İmleç etrafındaki alanı gerçek zamanlı yakalayıp telefonda gösterir.
- **Güvenlik:** `/admin` ve ayar uçları yalnızca `localhost` erişimine açıktır; opsiyonel PIN doğrulaması kaba kuvvet (rate-limit) korumalıdır.

---

## Hızlı Başlangıç

### 1. Bilgisayarda Kurulum (Windows 10 / 11)
Gereksinim: **Node.js 18+**

```bash
git clone https://github.com/semjhaydin/Remote-PC-Plus.git
cd Remote-PC-Plus
npm install
```

- **Güvenlik Duvarı (İlk Seferde 1 Kez):** `scripts/firewall_setup.bat` dosyasına sağ tıklayıp **Yönetici olarak çalıştır** deyin (TCP `5000`, `5443` ve UDP `5055` portlarını açar).
- **Başlatma (Önerilen):** **`RemotePCPlus.exe`** dosyasına çift tıklayın. Saatin yanında simge belirir; çift tıklayarak Kontrol Merkezi'ni açabilirsiniz.
- **Alternatif (Terminal):** `npm start` veya `baslat.bat`.

### 2. Telefonda Kurulum (Android APK)
1. GitHub reposunda **Actions → Build Android APK** (veya **Releases**) sekmesinden **`RemotePC-Plus.apk`** dosyasını indirip kurun.
2. Telefon ve PC aynı Wi-Fi ağındayken uygulamayı açın — PC otomatik olarak listelenir, dokunup eşleştirin.

*(İsterseniz APK kurmadan da telefon tarayıcısından `http://<PC-IP>:5000` adresini açarak Web/PWA sürümünü kullanabilirsiniz.)*

---

## Proje Yapısı

```text
RemotePcPlus/
├── RemotePCPlus.exe          # 26 KB Windows Sistem Tepsisi uygulaması
├── server.js                 # HTTP/HTTPS, WebSocket, UDP Discovery (5055) & API
├── win32_api.js              # Koffi Win32 FFI (fare, Unicode klavye, ekran yakalama)
├── monitor_manager.js        # Çoklu monitör koordinatları, DPI ve sınır direnci
├── app_detector.js           # Aktif pencere / uygulama bağlam tespiti
├── settings.json             # Kalıcı kullanıcı ve monitör profilleri
├── test_integration.js       # Sistem entegrasyon testleri (npm test)
├── android/                  # Native Kotlin Android APK projesi
├── tray/                     # Windows Sistem Tepsisi C# kaynağı ve app.ico
├── scripts/
│   ├── firewall_setup.bat    # Windows Firewall (TCP 5000/5443, UDP 5055)
│   └── build_tray.bat        # RemotePCPlus.exe derleme betiği
├── .github/workflows/
│   └── build-apk.yml         # Otomatik Android Release APK derleme & Release
└── public/
    ├── assets/logo.svg       # Ana vektör logo
    ├── index.html            # Mobil Web/PWA Touchpad & Kumanda
    ├── admin.html            # Masaüstü Kontrol Merkezi (localhost)
    ├── css/                  # Apple HIG koyu tema stilleri (OKLCH)
    └── js/                   # Touchpad, çoklu monitör, büyüteç, medya/sunum
```

---

## Test & Geliştirme

```bash
npm test          # Win32, çoklu monitör, aktif pencere ve büyüteç testleri
npm run build:tray # RemotePCPlus.exe sistem tepsisi uygulamasını yeniden derler
```

---

## Lisans

ISC License — Semih Aydın
