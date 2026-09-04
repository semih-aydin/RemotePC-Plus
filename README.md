<div align="center">

# 🎮 Universal Wireless Control Hub (Remote-PC-Plus) 📱

**Turn any smartphone into a zero-latency, context-aware air mouse & multi-monitor desktop trackpad via Win32 FFI and WebSockets.**

[![Status](https://img.shields.io/badge/Status-Active_Development-orange?style=for-the-badge)](https://github.com/semjhaydin/Remote-PC-Plus)
[![GitHub Stars](https://img.shields.io/github/stars/semjhaydin/Remote-PC-Plus?style=for-the-badge&logo=github&logoColor=white&color=0891b2)](https://github.com/semjhaydin/Remote-PC-Plus)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://github.com/semjhaydin/Remote-PC-Plus)
[![NodeJS](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://github.com/semjhaydin/Remote-PC-Plus)
[![Win32 FFI](https://img.shields.io/badge/Win32_API-koffi_FFI-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/semjhaydin/Remote-PC-Plus)

</div>

> **Özet:** Akıllı telefonunuzu (iOS / Android) sıfır gecikmeli, çok modlu, bağlam duyarlı (context-aware) kablosuz hava faresi (Air Mouse) ve çoklu monitör masaüstü kontrol merkezine dönüştürün.

Bu proje, fiziksel kablosuz fareleri ve medya kumandalarını ortadan kaldırarak herhangi bir akıllı telefonu (iOS / Android) gelişmiş çoklu monitör desteğine ve sezgisel hareket kontrollerine sahip güçlü bir giriş ekosistemine dönüştürmek için geliştirilmiştir.

---

## 🌟 Öne Çıkan Özellikler

### 1. Çok Modlu Giriş Motoru (Multi-Mode Input Engine)
- **Air Mouse (Jiroskop Tabanlı 3D Fare)**: Telefonu havada hareket ettirerek fare kontrolü.
  - *Hıza Duyarlı Dinamik DPI*: Yavaş el hareketinde piksel hassasiyetinde yakalama; hızlı savurmada ekranlar arası hızlı geçiş.
  - *Clutch (Tut-ve-Hareket-Ettir)*: İstenmeyen imleç kaymasını (drift) önlemek için ekrandaki debriyaj butonuna basılı tutarak hareket ettirme veya fiziksel ses tuşları ile kontrol.
  - *Sıfırlama (Recenter)*: Tek dokunuşla referans açısını kalibre etme.
- **Precision Touchpad**: Tek, çift ve 3 parmak jestleri destekleyen dokunmatik yüzey.
  - 1 Parmak: İmleç hareketi ve Sol Tık (Tap to click), Çift tıkla ve sürükle (Drag Lock).
  - 2 Parmak: Sağ Tık, Ataletli / Momentum Kaydırma (Inertial Scrolling) ve İki parmakla Yakınlaştırma (Pinch-to-Zoom).
  - 3 Parmak: Orta Tık ve Ekranlar arası hızlı fırlatma (Screen-Jump).
  - *Hassas Kaydırma Şeridi (Dedicated Scroll Strip)*: Dokunsal tıkırtı geri bildirimli dikey ve yatay kaydırma rayları.
- **Dinamik Bağlam Kartları (Contextual Overlays)**:
  - Bilgisayarda açık olan aktif programa göre mobil arayüzün otomatik şekil değiştirmesi:
    - 🎵 **Medya Modu** (Spotify, YouTube, VLC): Oynat/Duraklat, İleri/Geri parça, Ses çubuğu, Mini-trackpad.
    - 📊 **Sunum Modu** (PowerPoint, Keynote, PDF): Büyük Slayt İleri/Geri tuşları, Sunum Kronometresi, Siyah/Beyaz ekran, Ses tuşlarıyla slayt geçişi.
    - 🌐 **Tarayıcı Modu** (Chrome, Edge, Firefox): Sekme aç/kapat, ileri/geri, sayfa yenileme, adres çubuğu odağı.
    - 💻 **Kodlama Modu** (VS Code, Visual Studio): Kaydet, Terminal, Run/Debug, Komut paleti.

### 2. Gelişmiş Çoklu Monitör Yönetimi
- **Uzamsal Düzen Farkındalığı (Spatial Layout Aware)**: Birden fazla ekranın sanal masaüstü koordinatlarını ve çözünürlüklerini otomatik tespit eder.
- **Ekran Bazlı Hassasiyet Profilleri (Per-Display DPI)**: 1080p ve 4K monitörler için bağımsız hız ve ivme ayarları.
- **Anında Ekran Işınlanması (Instant Screen-Jump)**: 3 parmak hareketi veya ekran seçici ile imleci doğrudan istenen monitörün merkezine ışınlama.
- **Monitör Sınır Direnci (Boundary Magnetism)**: Monitörler arası sınırda hafif manyetik direnç uygulayarak hassas işlerde imlecin yanlışlıkla diğer ekrana kaymasını engeller (hızlı itişte sınırı kırıp geçer).

### 3. Kenar Çekmeceleri ve Jest Sistemi (Edge System)
- **Sol Kenar Çekmecesi**: Tam QWERTY sanal klavye + **Web Speech API ile Sesle Yazma (Voice-to-Text)** + Hızlı Pano.
- **Sağ Kenar Çekmecesi**: Tam Numpad + Makro Paleti (Kopyala, Yapıştır, Geri Al, Ekran Alıntısı, Görev Görünümü, Kilitle).
- **Alt Kenar Çekmecesi**: Ekranlar arası ışınlanma çubukları, Canlı DPI kaydırıcı ve bağlantı istatistikleri.
- **8 Yönlü Hızlı Çark Menüsü (8-Way Radial Macro Menu)**: Uzun basarak açılan, parmak yönüne göre anında kısayol çalıştıran radyal tekerlek.
- **Canlı İmleç Büyüteci (Magnifier Loupe)**: Bilgisayardaki fare imlecinin etrafındaki piksel alanını gerçek zamanlı büyüterek telefonda gösterir.

### 4. Dokunsal Geri Bildirim ve Ergonomi
- **HD Haptic Engine**: Tıklamalar (15ms), tekerlek adımları (6ms), ekran sınır direnci çarpması (45ms) ve monitör ışınlanması ([15, 30, 15]ms) için farklı titreşim desenleri.
- **Akıllı Tıklama Alanları**: Sol tık, Orta tık, Sağ tık ve Sürükleme Kilidi (Drag Lock).
- **Ekran Kapanma Engeli (Screen Wake Lock)**: Kullanım sırasında telefon ekranının uykuya geçmesini engeller.

---

## 🚀 Kurulum ve Çalıştırma

### Gereksinimler
- Node.js (v18 veya üzeri)
- Windows (Win32 API doğrudan `koffi` FFI ile çalışır, ek derleyici gerektirmez)

### 1. Bağımlılıkları Yükleyin
```bash
npm install
```

### 2. Sunucuyu Başlatın
```bash
npm start
# veya
node server.js
```

### 3. Telefonunuzla Bağlanın
1. Sunucu başladığında terminalde ve masaüstü yönetim panelinde bir **QR Kod** görüntülenecektir.
2. Telefonunuzun kamerasıyla QR kodu taratın veya tarayıcınızda görüntülenen `https://192.168.x.x:5443` adresini açın.
3. Tarayıcıda açılan arayüzü dilerseniz *"Ana Ekrana Ekle"* diyerek tam ekran PWA olarak kullanabilirsiniz.
4. Masaüstü yönetim paneline `http://localhost:5000/admin` adresinden erişebilirsiniz.

---

## 🏗️ Mimari & Dosya Yapısı

```
RemotePcPlus/
├── server.js               # Express, HTTPS/HTTP & WebSocket sunucusu, QR kod üretimi
├── win32_api.js            # Koffi ile Windows User32/GDI32 FFI girdileri (Mouse, Klavye, Loupe)
├── monitor_manager.js      # Çoklu monitör koordinatları, ekran ışınlanması ve kenar direnci
├── app_detector.js         # Aktif pencere ve uygulama tespiti (Medya/Sunum/Tarayıcı kuralları)
├── settings.json           # Kalıcı konfigürasyon (DPI, monitör profilleri, makrolar)
└── public/
    ├── index.html          # Mobil Kumanda Tek Sayfa Uygulaması (PWA)
    ├── admin.html          # Masaüstü Kontrol Merkezi & Canlı Test Paneli
    ├── manifest.json       # PWA Web App Manifest
    ├── sw.js               # Service Worker
    ├── css/
    │   ├── style.css       # Mobil Cyberpunk/Titanium UI tasarımı
    │   └── admin.css       # Masaüstü yönetim paneli stilleri
    └── js/
        ├── app.js          # Mobil istemci orkestrasyonu, WebSocket, WakeLock
        ├── airmouse.js     # Jiroskop 3D takip, debriyaj (clutch) & dinamik DPI
        ├── touchpad.js     # Çoklu dokunma, ataletli kaydırma, pinch zoom
        ├── context_cards.js# Medya, Sunum (kronometre), Tarayıcı ve Kod modları
        ├── edge_drawers.js # Sol Klavye+Ses, Sağ Numpad+Makro, Alt Ayarlar
        ├── radial_menu.js  # 8 Yönlü Dairesel Makro Menüsü
        ├── magnifier.js    # İmleç çevresi canlı büyüteç
        ├── multi_monitor.js# Çoklu ekran istemci yönetimi
        ├── haptics.js      # HD Haptic titreşim motoru
        └── admin.js        # Masaüstü yönetim paneli ve monitör tuvali
```

---

## 📜 Lisans
ISC License - Geliştirici: Semih Aydın
