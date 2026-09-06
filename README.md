<div align="center">

# 🎮 Universal Wireless Control Hub (Remote-PC-Plus) 📱

**Turn any smartphone into a zero-latency, context-aware precision touchpad & multi-monitor desktop controller via Win32 FFI and WebSockets.**

[![Status](https://img.shields.io/badge/Status-Active_Development-orange?style=for-the-badge)](https://github.com/semjhaydin/Remote-PC-Plus)
[![GitHub Stars](https://img.shields.io/github/stars/semjhaydin/Remote-PC-Plus?style=for-the-badge&logo=github&logoColor=white&color=0891b2)](https://github.com/semjhaydin/Remote-PC-Plus)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://github.com/semjhaydin/Remote-PC-Plus)
[![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://github.com/semjhaydin/Remote-PC-Plus)
[![Win32 FFI](https://img.shields.io/badge/Win32_API-koffi_FFI-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/semjhaydin/Remote-PC-Plus)

</div>

> **Özet:** Akıllı telefonunuzu (iOS / Android) sıfır gecikmeli, bağlam duyarlı (context-aware), çoklu monitör destekli kablosuz dokunmatik fare (Precision Touchpad) ve medya/sunum kontrol merkezine dönüştürün.

Bu proje, fiziksel kablosuz fareleri ve sunum kumandalarını ortadan kaldırarak herhangi bir mobil tarayıcıyı (iOS Safari / Android Chrome vb.) Windows masaüstünüz için ultra düşük gecikmeli, zengin jestlere ve akıllı kısayollara sahip güçlü bir kontrol ekosistemine dönüştürmek için geliştirilmiştir.

---

## 🌟 Öne Çıkan Yetenekler

### 1. Hassas Dokunmatik Yüzey (Precision Touchpad & Gestures)
- **`requestAnimationFrame` (rAF) Batching:** 120Hz/240Hz dokunmatik ekran tarama hızına tam senkron, TCP soket şişmesini önleyen mikro paket toplayıcı.
- **Hıza Duyarlı Dinamik İvmelenme (Power Curve):** Yavaş parmak hareketlerinde 1 piksel hassasiyetinde mikro hedefleme; hızlı savurmalarda geniş çift monitörleri (3840px+) tek hamlede aşma ivmesi.
- **Zengin Çoklu Dokunma Jestleri:**
  - **1 Parmak:** Yumuşak imleç hareketi ve dokunarak **Sol Tık**.
  - **2 Parmak Dokunuş:** **Sağ Tık** (Bağlam Menüsü).
  - **3 Parmak Dokunuş:** **Orta Tık** (Bağlantıyı yeni sekmede açma / sekme kapatma).
  - **2 Parmak Kaydırma (Kinetic Inertial Scroll):** Hem dikey hem yatay yönde GPU senkronlu ataletli sayfa kaydırma.
  - **2 Parmak Kıstırma (Pinch-to-Zoom):** Ctrl+Wheel tabanlı yakınlaştırma ve uzaklaştırma.
  - **3 Parmak Sağa/Sola Fırlatma (Flick Jump):** Monitörler arası anında ışınlanma.
  - **Akıllı Çift Dokunarak Sürükleme:** Pencereleri ve dosyaları güvenli sürükleyip bırakma (arka plana geçişte otomatik güvenlik kilidi çözücü ile).
  - **Özel Dikey Kaydırma Şeridi:** Sağ kenarda tek parmakla mikro hassas kaydırma rayı.

### 2. Gelişmiş Çoklu Monitör Yönetimi (Multi-Monitor Engine)
- **Uzamsal Düzen Tespiti (Spatial Layout Awareness):** Windows Win32 `EnumDisplayMonitors` API'si ile bağlı tüm ekranların (1080p, 2K, 4K) koordinatlarını ve çözünürlüklerini otomatik tespit eder.
- **Canlı Monitör Seçim Çubuğu:** Üst çubukta ekran butonları (`[Ekran 1] [Ekran 2]`) ile tek dokunuşta istenen monitörün merkezine ışınlanma.
- **Monitör Sınır Direnci (Boundary Magnetism):** Ekran kenarlarında manyetik direnç uygulayarak hassas köşelerde imlecin yanlışlıkla yan monitöre kaymasını engeller (hızlı itişte sınırı kırıp geçer).

### 3. Dinamik Bağlam Kartları (Context-Aware Overlays)
Bilgisayarda açık olan aktif uygulamanın başlığını ve sürecini arka planda analiz ederek mobil arayüzü dinamik olarak uyarlar:
- 🎵 **Medya Modu (Spotify, YouTube, VLC):** Oynat/Duraklat, İleri/Geri parça, Ses çubuğu, Sessize Alma.
- 📊 **Sunum Modu (PowerPoint, PDF, Google Slides):** Büyük Slayt İleri/Geri butonları, F5 Sunumu Başlat, Esc Çık, Siyah Ekran ve **Canlı Sunum Kronometresi**.
- 🌐 **Tarayıcı & Üretkenlik:** Geri/İleri, Yenile, Yeni Sekme, Sekmeyi Kapat, Pencereyi Kapat.
- 💻 **Geliştirici Modu (VS Code, Editörler):** Kaydet (Ctrl+S), Bul (Ctrl+F), Terminal (Ctrl+\`), Yorum Satırı (Ctrl+/).

### 4. Hızlı Araçlar, Sesle Yazma & Canlı Büyüteç
- **🎙️ Web Speech API ile Sesle Yazma (Voice-to-Text):** Mikrofona konuşulan Türkçe metinleri anında algılayıp bilgisayara yazar.
- **⌨️ Sanal Klavye & Hızlı Pano:** Mobil klavyeden Windows'a doğrudan metin veya Enter/Backspace iletimi.
- **🔍 Canlı İmleç Büyüteci (Magnifier Loupe):** Bilgisayardaki fare imlecinin etrafındaki 100x100 piksellik alanı gerçek zamanlı yakalayıp hedef retikülüyle telefonda gösterir.
- **📱 Tam Ekran & Yatay Mod (Landscape):** Tek dokunuşla geniş ekran oranına (16:9 / 32:9) tam oturan devasa trackpad modu.
- **📳 HD Haptic Engine:** Tıklamalarda, tekerlek tıkırtılarında ve ekran sınır çarpmalarında dokunsal titreşim geri bildirimi.

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- **Node.js:** v18 veya üzeri
- **İşletim Sistemi:** Windows 10 / 11 (Win32 API doğrudan `koffi` C-FFI ile bağlanır, C++ derleyicisi gerektirmez)

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Sunucuyu Başlatın
```bash
npm start
# veya doğrudan Windows için:
baslat.bat
```

### 3. Telefonunuzla Bağlanın
1. Sunucu başlatıldığında terminalde yerel IP adresiniz ve QR kod bağlantıları listelenir:
   - **HTTPS Portu (Önerilen - Sesle Yazma ve Tam Ekran İzinleri İçin):** `https://192.168.x.x:5443`
   - **HTTP Portu:** `http://192.168.x.x:5000`
2. Telefonunuzun kamerasıyla QR kodu taratın veya tarayıcınızda bağlantıyı açın.
3. Masaüstü yönetim ve telemetri paneline tarayıcınızdan `http://localhost:5000/admin` adresinden erişebilirsiniz.

---

## 🏗️ Mimari & Dosya Düzeni

```
RemotePcPlus/
├── server.js               # Express HTTP/HTTPS & WebSocket sunucusu, PFX TLS, Telemetri API
├── win32_api.js            # Koffi C-FFI ile User32/GDI32/Kernel32 yerel girdi ve ekran yakalama
├── monitor_manager.js      # Çoklu monitör koordinatları, ekran ışınlanması ve kenar direnci
├── app_detector.js         # Aktif pencere / süreç analizi ve bağlam tespiti
├── settings.json           # Kalıcı kullanıcı ve donanım ayarları
├── baslat.bat              # Windows tek tıkla başlatma betiği
├── PRE_LAUNCH_CHECKLIST.md # Yayına alma ve test kontrol listesi
└── public/
    ├── index.html          # Mobil Touchpad & Kumanda Tek Sayfa Uygulaması (PWA)
    ├── admin.html          # Masaüstü Kontrol Merkezi & Canlı Test Paneli
    ├── css/
    │   ├── style.css       # Mobil Touchpad ve Medya Kartları stilleri
    │   └── admin.css       # Masaüstü kontrol paneli stilleri
    └── js/
        ├── app.js          # Mobil istemci orkestrasyonu, WebSocket, Modallar, Toast, Sesle Yazma
        ├── touchpad.js     # rAF toplayıcılı dokunmatik yüzey, kinetik kaydırma, jestler
        ├── context_cards.js# Medya, Sunum (kronometre), Tarayıcı ve Geliştirici kartları
        ├── multi_monitor.js# Çoklu ekran istemci yönetimi ve seçim çubukları
        ├── magnifier.js    # İmleç çevresi canlı büyüteç tuvali
        ├── haptics.js      # HD Haptic titreşim motoru
        └── admin.js        # Masaüstü yönetim paneli ve monitör tuvali
```

---

## 📜 Lisans
ISC License - Geliştirici: Semih Aydın
