// HD Haptic Titreşim Motoru (HD Haptics Engine)
// Farklı eylemler için dokunsal geri bildirimler sağlar

class HapticsEngine {
    constructor() {
        this.enabled = true;
        this.hasVibration = 'vibrate' in navigator;
    }

    // Titretme fonksiyonu
    vibrate(pattern) {
        if (!this.enabled || !this.hasVibration) return;
        try {
            navigator.vibrate(pattern);
        } catch (e) {
            // bazi tarayicilar izin vermeyebilir
        }
    }

    // Fare Sol Tik (Kısa net klik - 15ms)
    click() {
        this.vibrate(15);
    }

    // Fare Sag Tik (Biraz daha dolgun klik - 25ms)
    rightClick() {
        this.vibrate(25);
    }

    // Orta Tik (Cift hafif tik - [10ms, 20ms, 10ms])
    middleClick() {
        this.vibrate([10, 20, 10]);
    }

    // Fare Tekerlek Cizgisi / Dişlisi (Mikro tıkırtı - 6ms)
    scrollDetent() {
        this.vibrate(6);
    }

    // Monitor Siniri Carpmasi / Kenar Direnci (Tok carpma - 45ms)
    boundaryHit() {
        this.vibrate(45);
    }

    // Monitorler Arasi Isinlanma (Cift darbe - [15ms, 30ms, 15ms])
    monitorJump() {
        this.vibrate([15, 30, 15]);
    }

    // Air Mouse Clutch Basildi (Hafif baslama hissi - 10ms)
    clutchEngaged() {
        this.vibrate(10);
    }

    // Air Mouse Clutch Birakildi (12ms)
    clutchReleased() {
        this.vibrate(12);
    }

    // Radial Menu Dilim Gecisi (Mikro secim darbesi - 8ms)
    radialSelect() {
        this.vibrate(8);
    }

    // Mod Degisimi (Artan titreşim dalgası - [15ms, 25ms, 40ms])
    modeSwitch() {
        this.vibrate([15, 25, 40]);
    }

    // Basarili Makro / Islem Onayi (Basari melodisi - [20ms, 40ms, 20ms])
    success() {
        this.vibrate([20, 40, 20]);
    }
}

window.haptics = new HapticsEngine();
