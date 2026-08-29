// Air Mouse (Gyro / Hareket Tabanli 3D Fare)
// Telefonun jiroskop ve ivmeolcer sensorleri ile havada fare yonetimi

class AirMouseController {
    constructor() {
        this.active = false;
        this.isClutched = false; // "Hold-to-Move" clutch basili mi?
        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;

        // Hassasiyet ve ivme parametreleri
        this.sensitivity = 2.4;
        this.deadZone = 0.06; // El titremesini kesmek icin olu bolge
        this.velocityExponent = 1.6;

        this.initialized = false;
        this.initEvents();
    }

    // Olay dinleyicilerini baslat
    initEvents() {
        const clutchBtn = document.getElementById('clutch-btn');
        const recenterBtn = document.getElementById('recenter-btn');

        // Clutch (Tut-ve-Hareket-Ettir) mekanizmasi
        if (clutchBtn) {
            const startClutch = (e) => {
                e.preventDefault();
                this.isClutched = true;
                clutchBtn.classList.add('active');
                window.haptics.clutchEngaged();
                this.resetReference();
            };

            const endClutch = (e) => {
                e.preventDefault();
                this.isClutched = false;
                clutchBtn.classList.remove('active');
                window.haptics.clutchReleased();
            };

            clutchBtn.addEventListener('touchstart', startClutch, { passive: false });
            clutchBtn.addEventListener('touchend', endClutch, { passive: false });
            clutchBtn.addEventListener('touchcancel', endClutch, { passive: false });
            clutchBtn.addEventListener('mousedown', startClutch);
            clutchBtn.addEventListener('mouseup', endClutch);
            clutchBtn.addEventListener('mouseleave', endClutch);
        }

        // Sifirlama / Merkezleme butonu
        if (recenterBtn) {
            recenterBtn.addEventListener('click', () => {
                this.resetReference();
                window.haptics.click();
            });
        }

        // Jiroskop hareket olayini dinle
        window.addEventListener('deviceorientation', (e) => this.handleOrientation(e), true);
    }

    // iOS 13+ icin jiroskop izni iste
    async requestSensorPermission() {
        if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
            try {
                const state = await DeviceOrientationEvent.requestPermission();
                if (state === 'granted') {
                    console.log('Jiroskop izni alindi!');
                    return true;
                } else {
                    console.log('Jiroskop izni reddedildi:', state);
                    return false;
                }
            } catch (err) {
                console.log('Sensor izni alinirken hata:', err);
                return false;
            }
        }
        return true;
    }

    // Referans acilari sifirla
    resetReference() {
        this.lastBeta = null;
        this.lastGamma = null;
        this.lastAlpha = null;
    }

    // Jiroskop verisini isle
    handleOrientation(e) {
        if (!this.active) return;

        const beta = e.beta;   // X ekseni egimi (yukari / asagi) [-180, 180]
        const gamma = e.gamma; // Y ekseni egimi (saga / sola) [-90, 90]
        const alpha = e.alpha; // Z ekseni pusula [0, 360]

        if (beta === null || gamma === null) return;

        // Ilk referans acisini kaydet
        if (this.lastBeta === null || this.lastGamma === null) {
            this.lastBeta = beta;
            this.lastGamma = gamma;
            this.lastAlpha = alpha;
            return;
        }

        // Aci farklarini hesapla
        let dBeta = beta - this.lastBeta;
        let dGamma = gamma - this.lastGamma;

        this.lastBeta = beta;
        this.lastGamma = gamma;
        this.lastAlpha = alpha;

        // Eger clutch basili degilse fareyi HAREKET ETTIRME! (Drift onleme mekanizmasi)
        if (!this.isClutched) {
            return;
        }

        // 360 derece donuslerdeki ani ziplamalari onle
        if (Math.abs(dBeta) > 180) dBeta = 0;
        if (Math.abs(dGamma) > 90) dGamma = 0;

        // X ekseni = gamma hareketi, Y ekseni = beta hareketi
        let rawDx = dGamma;
        let rawDy = dBeta;

        const speed = Math.hypot(rawDx, rawDy);

        // 1. Olu Bolge (Dead-zone): El titremesini keselim
        if (speed < this.deadZone) {
            return;
        }

        // 2. Velocity-Adaptive DPI (Hiza Duyarli Dinamik Hassasiyet):
        // Yavas el hareketi = Piksel hassasiyetinde yakalama (Pixel-Snapping)
        // Hizli el hareketi = Hizli ekran gecisi (Rapid traversal)
        let multiplier = this.sensitivity;
        if (speed < 0.6) {
            multiplier *= 0.65; // Hassas piksel yakalama
        } else if (speed > 2.0) {
            multiplier *= Math.pow(speed / 2.0, this.velocityExponent - 1.0);
        }

        const finalDx = rawDx * multiplier * 12.0;
        const finalDy = rawDy * multiplier * 12.0;

        // WebSocket uzerinden PC'ye gonder
        if (window.app && window.app.ws && window.app.ws.readyState === WebSocket.OPEN) {
            window.app.send({
                type: 'move',
                dx: finalDx,
                dy: finalDy,
                t: Date.now()
            });
        }
    }

    // Modu aktif/pasif yap
    setActive(isActive) {
        this.active = isActive;
        if (isActive) {
            this.requestSensorPermission();
            this.resetReference();
        }
    }
}

window.airMouse = new AirMouseController();
