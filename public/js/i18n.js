// RemotePC+ Automatic System Language Localization (EN default for non-TR locales, TR for Turkish)
(function () {
    const lang = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
    const isTurkish = lang.startsWith('tr');
    window.rpcLang = isTurkish ? 'tr' : 'en';
    if (isTurkish) return;

    document.documentElement.lang = 'en';

    const DICT = {
        // Common & Mobile Top Bar
        'Kumanda': 'Remote',
        'Ekran:': 'Display:',
        'Büyüteç': 'Loupe',
        'Ses': 'Voice',
        'Klavye': 'Keyboard',
        'Kopyala': 'Copy',
        'Yapıştır': 'Paste',
        'Geri Al': 'Undo',
        'Masaüstü': 'Desktop',
        'Kırp': 'Snip',
        'Görevler': 'Task View',
        'SÜRÜKLENİYOR': 'DRAGGING',
        'Hassas Dokunmatik Alan': 'Precision Trackpad',
        '• 1 Parmak: Tık / Hareket   • 2 Parmak: Sağ Tık / Kaydır   • 3 Parmak: Ekran Değiştir': '1 Finger: Tap / Move  •  2 Fingers: Right Click / Scroll  •  3 Fingers: Switch Display',
        'İmleç Büyüteci': 'Cursor Loupe',
        'Sol Tık': 'Left Click',
        'Orta Tık': 'Middle Click',
        'Sürükle': 'Drag',
        'Sağ Tık': 'Right Click',

        // Media, Presentation, Tools
        'Aktif Pencere': 'Active Window',
        'MEDYA OYNATICI': 'Media Player',
        'SUNUM KONTROLÜ (PowerPoint / PDF)': 'Presentation',
        'Başlat': 'Start',
        'Sıfırla': 'Reset',
        'Önceki Slayt': 'Previous',
        'Sonraki Slayt': 'Next Slide',
        'F5 Başlat': 'F5 Start',
        'Esc Bitir': 'Esc Exit',
        'Siyah Ekran': 'Black Screen',
        'TARAYICI & GENEL KISAYOLLAR': 'Browser & Shortcuts',
        'Geri': 'Back',
        'İleri': 'Forward',
        'Yenile': 'Reload',
        'Yeni Sekme': 'New Tab',
        'Sekmeyi Kapat': 'Close Tab',
        'Pencereyi Kapat': 'Close Window',
        'Pencere & Masaüstü': 'Window & Desktop',
        'Sola Yasla': 'Snap Left',
        'Sağa Yasla': 'Snap Right',
        'Tam Ekran': 'Maximize',
        'Küçült': 'Minimize',
        'Önceki Masaüstü': 'Prev Desktop',
        'Sonraki Masaüstü': 'Next Desktop',
        'Geliştirici & Editör': 'Developer & Editor',
        'Kaydet': 'Save',
        'Bul': 'Find',
        'Yorum': 'Comment',
        'Pano Paylaşımı': 'Clipboard Sync',
        'PC\'den Al': 'Get from PC',
        'Hızlı Başlatıcı': 'Quick Launcher',
        'Tarayıcı': 'Browser',
        'Dosyalar': 'Files',
        'Ayarlar': 'Settings',
        'Sistem & Güç': 'System & Power',
        'Kilitle': 'Lock',
        'Ekranı Kapat': 'Display Off',
        'Uyku': 'Sleep',

        // Modals
        'Touchpad & Sistem Ayarları': 'Touchpad & Settings',
        'İmleç Hassasiyeti': 'Cursor Sensitivity',
        'Doğal Kaydırma (Natural Scroll)': 'Natural Scroll',
        'Parmak yukarı çekildiğinde içerik yukarı kayar.': 'Content tracks finger movement.',
        'Çift Dokunarak Sürükleme (Tap-Drag)': 'Double-Tap to Drag',
        'Hızlı çift dokunup parmağı kaydırarak pencereleri taşır.': 'Double-tap and hold to drag windows.',
        'Titreşim Geri Bildirimi (HD Haptics)': 'Haptic Feedback',
        'Tıklamalarda ve sınır geçişlerinde dokunsal titreşim.': 'Tactile feedback on clicks and display edges.',
        'Masaüstü Kontrol Merkezini Aç (/admin)': 'Open Desktop Control Center (/admin)',
        'Dokunmatik Jest Rehberi': 'Touchpad Gestures',
        'Güvenlik PIN Doğrulaması': 'PIN Verification',
        'Bu bilgisayara bağlanmak için 4 haneli PIN kodunu girin:': 'Enter the 4-digit PIN code to connect:',
        'Bağlantıyı Doğrula': 'Verify',

        // Desktop Admin Control Center
        'RemotePC+ Kontrol Merkezi': 'RemotePC+ Control Center',
        'Bağlı Telefon:': 'Connected:',
        'Aktif Uygulama:': 'Active App:',
        'Telefon Eşleştirme (QR Kod)': 'Pair Phone (QR Code)',
        'Telefonunuzun kamerasını okutun veya tarayıcıda açın:': 'Scan with your phone camera or open in browser:',
        'HTTPS (Önerilen - Gyro ve Titreşim İzni İçin):': 'HTTPS (Recommended):',
        'HTTP (Alternatif):': 'HTTP (Direct):',
        'Çoklu Monitör Uzamsal Yerleşimi (Spatial Layout)': 'Display Arrangement',
        'Seçili Monitör:': 'Selected Display:',
        'Monitör DPI Çarpanı:': 'Display DPI Multiplier:',
        'Hız İvmesi (Acceleration Curve):': 'Acceleration Curve:',
        'Monitör Sınır Direnci (Boundary Magnetism)': 'Display Edge Magnetism',
        'Monitörler arası geçişte yumuşak sınır kilidi (İstem dışı taşmayı önler)': 'Soft edge resistance between displays to prevent accidental overshoot',
        'Direnç Bölgesi Genişliği (Piksel):': 'Resistance Zone Width (px):',
        'Güvenlik & PIN Eşleştirme': 'Security & PIN Pairing',
        'Yeni telefon bağlantılarında PIN doğrulaması zorunlu olsun': 'Require PIN verification for new connections',
        '4 Haneli PIN Kodu:': 'PIN Code:',
        'Canlı Giriş Test Alanı (Diagnostics)': 'Live Input Test Pad',
        'Telefondan fareyi hareket ettirip tıklamaları burada test edebilirsiniz.': 'Move cursor and click from your phone to test input latency.',
        'Değişiklikleri Kaydet': 'Save Changes'
    };

    function translateTree(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
        let node;
        while ((node = walker.nextNode())) {
            const raw = node.nodeValue;
            if (!raw) continue;
            const trimmed = raw.trim();
            if (!trimmed) continue;
            if (DICT[trimmed]) {
                node.nodeValue = raw.replace(trimmed, DICT[trimmed]);
            }
        }
        root.querySelectorAll('[placeholder]').forEach(el => {
            const ph = el.getAttribute('placeholder');
            if (ph && ph.includes('PC\'ye göndermek')) {
                el.setAttribute('placeholder', 'Text or URL to send or paste to PC...');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (document.title.includes('Kontrol Merkezi')) {
            document.title = 'RemotePC+ Control Center';
        }
        translateTree(document.body);
    });
})();
