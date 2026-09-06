# 🚀 RemotePC+ Yayına Almadan Önce Yapılacaklar Listesi (Pre-Launch Checklist)

Bu kontrol listesi, projenin günlük kullanımda ve genel yayında hatasız, güvenli, ultra hızlı ve sorunsuz çalışmasını sağlamak için adım adım takip edeceğimiz kontrol maddelerini içerir.

---

## 📌 Faz 1: Güvenlik, Ağ ve İzinler (Network & Security)
- [x] **Çift Port Desteği (HTTP 5000 & HTTPS 5443):** Web Speech API, WakeLock ve Tam Ekran API'leri için TLS desteği hazır.
- [x] **Windows Otomatik PFX Sertifikası:** PowerShell ile modern tarayıcı uyumlu self-signed TLS sertifikası üretimi.
- [x] **Windows Güvenlik Duvarı (Firewall) Kolaylığı:** 5000 ve 5443 portlarını tek tıkla açan `scripts/firewall_setup.bat` betiği eklendi.
- [x] **İsteğe Bağlı PIN / Eşleştirme Güvenliği:** Aynı Wi-Fi ağındaki yabancı cihazların izinsiz bağlanmasını önleyen opsiyonel 4 haneli PIN doğrulama mekanizması (Admin paneli & Mobil UI entegrasyonu tamamlandı).

---

## 📌 Faz 2: Performans, Gecikme ve Kararlılık (Performance & Resilience)
- [x] **`requestAnimationFrame` (rAF) Batching:** 120Hz/240Hz ekranlarda ağ şişmesini önleyen mikro paket toplayıcı entegre edildi.
- [x] **TCP_NODELAY Aktif:** İşletim sistemi Nagle tamponu kapatılarak 1-2ms anlık paket iletimi sağlandı.
- [x] **Kinetik Ataletli Kaydırma (Kinetic Scroll):** GPU senkronlu 60/120 FPS akıcı sayfa kaydırma.
- [x] **Bellek ve Kaynak Yönetimi:** GDI32 BitBlt ve DC nesnelerinin her loupe karesi sonrası temizlenmesi (`DeleteDC`, `DeleteObject`).
- [x] **Otomatik Yeniden Bağlanma (Auto-reconnect):** Bağlantı koptuğunda arkaplanda 2 saniyede bir otomatik yeniden bağlanma döngüsü.

---

## 📌 Faz 3: Windows Uyumluluğu & Özel Durumlar (Windows OS Compatibility)
- [x] **Çoklu Monitör Otomatik Tespiti:** 1080p, 2K, 4K ekranların sanal koordinat alanlarının doğru haritalanması.
- [x] **Monitör Sınır Direnci (Boundary Magnetism):** Hassas pencerelerde imlecin yan ekrana kaçmasını engelleyen eşik sistemi.
- [x] **Sanal Tuş (VK) Haritası:** Enter, Return, Backspace, Ctrl, Alt, Win ve medya tuşlarının tam uyumluluğu.
- [x] **Güvenli Sürükleme Kilidi (Drag Protection):** Sayfa odağını kaybettiğinde veya parmak kalktığında farenin kilitli kalmaması için otomatik bırakma garantisi.
- [x] **Yönetici Hakları (Elevated Processes / UAC):** `baslat.bat` içinde yönetici haklarıyla çalıştırma ipucu ve UAC pencereleriyle uyumluluk.
- [x] **Arka Planda Sessiz Çalışma (`baslat_arkaplanda.vbs`):** Konsol penceresi olmadan arka planda başlatabilme desteği.

---

## 📌 Faz 4: Çapraz Cihaz ve Kullanıcı Deneyimi (Cross-Device UX)
- [x] **Hassas Touchpad Modu:** Tek/çift/üç parmak jestleri ve tıklama alanları.
- [x] **Gelişmiş Ayarlar Modalı:** İmleç hızı, doğal kaydırma, çift tıkla sürükleme ve titreşim ayarlarının anlık değiştirilebilmesi.
- [x] **Dahili Jest Rehberi:** Yeni kullanıcılar için dokunmatik hareketlerin şık modalda gösterilmesi.
- [x] **Tam Ekran & Yatay (Landscape) Modu:** Tek dokunuşla geniş ekran oranında rahat kullanım.
- [x] **Görsel Toast Bildirimleri:** Bağlantı, kısayol ve mod değişimlerinde mikro bildirimler.
- [x] **Sesle Yazma & Sanal Klavye:** Web Speech API ve sanal metin girişi desteği.

---

## 📌 Faz 5: Paketleme ve Tek Tıkla Dağıtım (Packaging & Distribution)
- [x] **Tek Tıkla Başlatma Dosyası (`baslat.bat`):** Bağımlılıkları kontrol edip sunucuyu ve tarayıcıyı açan başlatıcı.
- [x] **Sessiz Başlatıcı (`baslat_arkaplanda.vbs`):** CMD penceresi göstermeden arka planda başlatan betik.
- [x] **QR Kodun Masaüstünde Otomatik Açılması:** Sunucu başladığında `http://localhost:5000/admin` sayfasının varsayılan tarayıcıda otomatik açılması.
